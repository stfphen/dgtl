import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import twilio from "twilio";

// Isolate the JSON fallback store in a temp file and force file-store mode BEFORE
// importing the data layer. Pure telephony modules below import no store, so
// their (hoisted) static imports are safe.
const STORE_PATH = path.join(os.tmpdir(), `telephony-test-store-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
delete process.env.DATABASE_URL;
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "telephony_test_token";
process.env.TELEPHONY_WEBHOOK_BASE_URL = "https://test.example.com";

import { decideRoute } from "../lib/telephony/routing.js";
import { twilioProvider } from "../lib/telephony/twilioProvider.js";
import { toE164US, isValidE164US } from "../lib/telephony/phone.js";
import { normalizeTenantTelephony, defaultTenantTelephony } from "../lib/telephony/constants.js";
import { checkOutboundLead } from "../lib/telephony/outboundGuards.js";
import { buildCallMetrics, formatTalkTime } from "../lib/telephony/metrics.js";
import { mockProvider, MOCK_RECORDING_URL } from "../lib/telephony/mockProvider.js";
import { runMockCallLifecycle } from "../lib/telephony/mockSimulator.js";
import { inAppTranscriptionAvailable, transcribeAudio } from "../lib/telephony/transcribeRecording.js";

// Note: the inbound/status routes use the standard web Response and load under
// node --test. The outbound route imports next/server (NextResponse), which only
// resolves inside the Next build, so its lead/tenant authorization is tested via
// the pure checkOutboundLead guard it delegates to; session auth (requireRole)
// is covered by the build + manual smoke.
const store = await import("../lib/store.js");
const { POST: inboundPOST } = await import("../app/api/telephony/inbound/route.js");
const { POST: statusPOST } = await import("../app/api/telephony/status/route.js");
const { POST: recordingPOST } = await import("../app/api/telephony/recording/route.js");
const { POST: transcriptionPOST } = await import("../app/api/telephony/transcription/route.js");

const TEAM = "team_default";

function webhookRequest(routePath, params) {
  const url = `https://test.example.com${routePath}`;
  const body = new URLSearchParams(params).toString();
  const signature = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
    body
  });
}

function unsignedRequest(routePath, params) {
  const url = `https://test.example.com${routePath}`;
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
}

test.after(async () => {
  await rm(STORE_PATH, { force: true });
});

// --- Pure units --------------------------------------------------------------

test("toE164US normalizes +1 numbers and rejects invalid", () => {
  assert.equal(toE164US("4165550123"), "+14165550123");
  assert.equal(toE164US("(416) 555-0123"), "+14165550123");
  assert.equal(toE164US("14165550123"), "+14165550123");
  assert.equal(toE164US("+14165550123"), "+14165550123");
  assert.equal(toE164US("12345"), "");
  assert.equal(toE164US(""), "");
  assert.ok(isValidE164US("+14165550123"));
  assert.ok(!isValidE164US("4165550123"));
});

test("normalizeTenantTelephony applies safe defaults (recording OFF)", () => {
  const defaults = defaultTenantTelephony();
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.recordingEnabled, false);
  assert.equal(defaults.voicemailEnabled, true);
  assert.equal(defaults.provider, "twilio");
  assert.equal(defaults.routingMode, "single_rep");

  const merged = normalizeTenantTelephony({ enabled: "true", provider: "telnyx", routingMode: "bogus" });
  assert.equal(merged.enabled, true);
  assert.equal(merged.provider, "telnyx");
  assert.equal(merged.routingMode, "single_rep"); // invalid -> default
});

test("decideRoute: assigned owner -> single_rep default -> fallback -> voicemail/reject", () => {
  const reps = [
    { id: "u1", phoneNumber: "+14165550111" },
    { id: "u2", phoneNumber: "+14165550222" }
  ];
  const tel = { routingMode: "single_rep", defaultRepId: "u2", fallbackNumber: "+14165559999", voicemailEnabled: true };

  assert.deepEqual(decideRoute({ assignedToUserId: "u1" }, tel, reps), {
    type: "rep",
    destinationNumber: "+14165550111",
    repId: "u1",
    reason: "assigned_rep"
  });
  assert.equal(decideRoute({}, tel, reps).destinationNumber, "+14165550222");
  assert.equal(decideRoute({}, { routingMode: "single_rep", fallbackNumber: "+14165559999" }, []).type, "fallback");
  assert.equal(decideRoute({}, { routingMode: "single_rep", voicemailEnabled: true }, []).type, "voicemail");
  assert.equal(decideRoute({}, { routingMode: "single_rep" }, []).type, "reject");
});

test("handleCallStatusUpdate maps Twilio statuses (no-answer -> missed)", () => {
  assert.equal(twilioProvider.handleCallStatusUpdate({ CallStatus: "completed", CallDuration: "73" }).status, "completed");
  assert.equal(twilioProvider.handleCallStatusUpdate({ CallStatus: "completed", CallDuration: "73" }).durationSeconds, 73);
  assert.equal(twilioProvider.handleCallStatusUpdate({ CallStatus: "in-progress" }).status, "in_progress");
  assert.equal(twilioProvider.handleCallStatusUpdate({ CallStatus: "no-answer" }).status, "missed");
  assert.equal(twilioProvider.handleCallStatusUpdate({ CallStatus: "busy" }).status, "missed");
  assert.ok(twilioProvider.handleCallStatusUpdate({ CallStatus: "completed" }).isTerminal);
});

test("buildInboundResponse renders Dial / Record / Hangup TwiML", async () => {
  const dial = await twilioProvider.buildInboundResponse({
    action: "dial",
    destinationNumber: "+14165550111",
    tenantNumber: "+14165550100"
  });
  assert.match(dial, /<Dial callerId="\+14165550100"/);
  assert.match(dial, /<Number>\+14165550111<\/Number>/);

  const vm = await twilioProvider.buildInboundResponse({ action: "voicemail" });
  assert.match(vm, /<Record/);

  const reject = await twilioProvider.buildInboundResponse({ action: "reject" });
  assert.match(reject, /<Hangup\/>/);
});

test("verifyWebhook rejects invalid signature and accepts a valid one", async () => {
  const url = "https://test.example.com/api/telephony/inbound";
  const params = { To: "+14165550100", From: "+14165551234", CallSid: "CAverify" };
  const valid = twilio.getExpectedTwilioSignature(process.env.TWILIO_AUTH_TOKEN, url, params);

  assert.equal(await twilioProvider.verifyWebhook({ url, signature: "wrong", params }), false);
  assert.equal(await twilioProvider.verifyWebhook({ url, signature: "", params }), false);
  assert.equal(await twilioProvider.verifyWebhook({ url, signature: valid, params }), true);
});

test("createOutboundCall degrades gracefully without credentials", async () => {
  const savedSid = process.env.TWILIO_ACCOUNT_SID;
  const savedToken = process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  try {
    const result = await twilioProvider.createOutboundCall({
      tenantNumber: "+14165550100",
      repNumber: "+14165550111",
      leadNumber: "+14165550123"
    });
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
  } finally {
    process.env.TWILIO_ACCOUNT_SID = savedSid;
    process.env.TWILIO_AUTH_TOKEN = savedToken;
  }
});

test("buildOutboundResponse records when enabled; announces only for two-party modes", async () => {
  const oneParty = await twilioProvider.buildOutboundResponse({
    tenantNumber: "+14165550100",
    leadNumber: "+14165550123",
    recording: { enabled: true, consentMode: "one_party" },
    recordingStatusCallbackUrl: "https://test.example.com/api/telephony/recording"
  });
  assert.match(oneParty, /record="record-from-answer-dual"/);
  assert.match(oneParty, /recordingStatusCallback="https:\/\/test\.example\.com\/api\/telephony\/recording"/);
  assert.doesNotMatch(oneParty, /<Say>/); // one-party (Canada) = no announcement
  assert.match(oneParty, /<Number>\+14165550123<\/Number>/);

  const disclaimer = await twilioProvider.buildOutboundResponse({
    tenantNumber: "+14165550100",
    leadNumber: "+14165550123",
    recording: { enabled: true, consentMode: "play_disclaimer" }
  });
  assert.match(disclaimer, /<Say>This call may be recorded/);

  const off = await twilioProvider.buildOutboundResponse({
    tenantNumber: "+14165550100",
    leadNumber: "+14165550123",
    recording: { enabled: false }
  });
  assert.doesNotMatch(off, /record=/);
  assert.doesNotMatch(off, /<Say>/);
});

test("mock provider places a simulated call (no creds) and logs a recorded, completed call", async () => {
  // Mock provider needs no credentials.
  const placed = mockProvider.createOutboundCall({
    tenantNumber: "+14165550100",
    repNumber: "+14165550111",
    leadNumber: "+14165550123"
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.configured, true);
  assert.match(placed.data.providerCallId, /^mock_/);

  // Tenant with recording enabled (one-party) so the simulator attaches a recording.
  const tenant = await store.getTenantByIdOrSlug("tenant_dgtlmag", { teamId: TEAM });
  await store.upsertTenantConfig(
    {
      ...tenant,
      telephony: normalizeTenantTelephony({
        enabled: true,
        phoneNumber: "+14165550100",
        recordingEnabled: true,
        recordingConsentMode: "one_party"
      })
    },
    { teamId: TEAM }
  );

  const lead = await store.createLead({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    businessName: "Mock Co",
    phone: "+14165550123"
  });
  const call = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    leadId: lead.id,
    direction: "outbound",
    status: "ringing",
    provider: "mock",
    providerCallId: placed.data.providerCallId
  });

  await runMockCallLifecycle(call, { durationSeconds: 60 });

  const done = await store.getCallById(call.id);
  assert.equal(done.status, "completed");
  assert.equal(done.durationSeconds, 60);
  assert.equal(done.recordingUrl, MOCK_RECORDING_URL);
  assert.ok(done.startedAt);
  assert.ok(done.endedAt);

  const refreshedLead = await store.getLeadById(lead.id);
  assert.equal(refreshedLead.callStatus, "completed");
});

test("recording webhook stores the recording URL when the tenant has recording enabled", async () => {
  const tenant = await store.getTenantByIdOrSlug("tenant_dgtlmag", { teamId: TEAM });
  await store.upsertTenantConfig(
    { ...tenant, telephony: normalizeTenantTelephony({ enabled: true, phoneNumber: "+14165550100", recordingEnabled: true }) },
    { teamId: TEAM }
  );

  const seeded = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    direction: "outbound",
    status: "completed",
    providerCallId: "CArec1"
  });
  const response = await recordingPOST(
    webhookRequest("/api/telephony/recording", {
      CallSid: "CArec1",
      RecordingUrl: "https://api.twilio.com/2010-04-01/Recordings/RE123",
      RecordingDuration: "42",
      RecordingSid: "RE123"
    })
  );
  assert.equal(response.status, 200);

  const updated = await store.getCallById(seeded.id);
  assert.match(updated.recordingUrl, /RE123\.mp3$/);
  assert.equal(updated.durationSeconds, 42);
});

test("recording webhook rejects an unsigned request (403)", async () => {
  const response = await recordingPOST(
    unsignedRequest("/api/telephony/recording", { CallSid: "CArec1", RecordingUrl: "https://x/REC" })
  );
  assert.equal(response.status, 403);
});

test("createRecordingTranscript reports not-configured without an Intelligence Service SID", async () => {
  const saved = process.env.TWILIO_INTELLIGENCE_SERVICE_SID;
  delete process.env.TWILIO_INTELLIGENCE_SERVICE_SID;
  try {
    const result = await twilioProvider.createRecordingTranscript({ recordingSid: "RE123", customerKey: "CAx" });
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
  } finally {
    if (saved !== undefined) process.env.TWILIO_INTELLIGENCE_SERVICE_SID = saved;
  }
});

test("mock simulator attaches a transcript + AI summary when transcription is enabled", async () => {
  const tenant = await store.getTenantByIdOrSlug("tenant_dgtlmag", { teamId: TEAM });
  await store.upsertTenantConfig(
    {
      ...tenant,
      telephony: normalizeTenantTelephony({
        enabled: true,
        phoneNumber: "+14165550100",
        recordingEnabled: true,
        transcriptionEnabled: true
      })
    },
    { teamId: TEAM }
  );
  const lead = await store.createLead({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    businessName: "Transcribe Co",
    phone: "+14165550123"
  });
  const call = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    leadId: lead.id,
    direction: "outbound",
    status: "ringing",
    provider: "mock"
  });
  await runMockCallLifecycle(call, { durationSeconds: 45 });
  const done = await store.getCallById(call.id);
  assert.equal(done.status, "completed");
  assert.ok(done.transcript && done.transcript.length > 0, "expected a transcript");
  assert.ok(done.aiSummary && /Next step/.test(done.aiSummary), "expected an AI summary");
});

test("in-app transcription is gated on a transcription key (Deepgram or OpenAI)", async () => {
  const savedDg = process.env.DEEPGRAM_API_KEY;
  const savedOai = process.env.OPENAI_API_KEY;
  delete process.env.DEEPGRAM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.equal(inAppTranscriptionAvailable(), false);
    assert.equal(await transcribeAudio("https://api.twilio.com/REC.mp3"), "");
    process.env.DEEPGRAM_API_KEY = "dg-test";
    assert.equal(inAppTranscriptionAvailable(), true);
  } finally {
    if (savedDg === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = savedDg;
    if (savedOai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOai;
  }
});

test("transcription webhook ignores unmatched customer_key (200, no write)", async () => {
  const response = await transcriptionPOST(
    webhookRequest("/api/telephony/transcription", {
      event_type: "voice_intelligence_transcript_available",
      transcript_sid: "GT999",
      customer_key: "CA_does_not_exist"
    })
  );
  assert.equal(response.status, 200);
});

test("transcription webhook rejects a bad signature when one is supplied (403)", async () => {
  const url = "https://test.example.com/api/telephony/transcription";
  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "wrong" },
    body: new URLSearchParams({ transcript_sid: "GT1", customer_key: "CAx" }).toString()
  });
  const response = await transcriptionPOST(request);
  assert.equal(response.status, 403);
});

test("buildCallMetrics aggregates direction, status, outcomes, and talk time", () => {
  const calls = [
    { direction: "inbound", status: "completed", outcome: "connected_interested", durationSeconds: 90 },
    { direction: "outbound", status: "completed", outcome: "booked_call", durationSeconds: 120 },
    { direction: "outbound", status: "missed", outcome: "", durationSeconds: null },
    { direction: "inbound", status: "completed", outcome: "no_answer", durationSeconds: 5 }
  ];
  const m = buildCallMetrics(calls);
  assert.equal(m.total, 4);
  assert.equal(m.inbound, 2);
  assert.equal(m.outbound, 2);
  assert.equal(m.completed, 3);
  assert.equal(m.missed, 1);
  assert.equal(m.booked, 1);
  assert.equal(m.connected, 2); // connected_interested + booked_call
  assert.equal(m.totalTalkTimeSeconds, 215);
  assert.equal(m.byOutcome.booked_call, 1);
  assert.equal(m.byOutcome.no_answer, 1);

  // Empty + formatter edge cases.
  assert.equal(buildCallMetrics([]).total, 0);
  assert.equal(formatTalkTime(0), "0s");
  assert.equal(formatTalkTime(75), "1m 15s");
  assert.equal(formatTalkTime(3660), "1h 01m");
});

// --- Store + tenant lookup ---------------------------------------------------

test("tenant telephony settings persist and resolve by phone number", async () => {
  const tenant = await store.getTenantByIdOrSlug("tenant_dgtlmag", { teamId: TEAM });
  await store.upsertTenantConfig(
    {
      ...tenant,
      telephony: normalizeTenantTelephony({
        enabled: true,
        phoneNumber: "+14165550100",
        defaultRepId: "u1",
        fallbackNumber: "+14165550199"
      })
    },
    { teamId: TEAM }
  );

  const tel = await store.getTenantTelephony("tenant_dgtlmag");
  assert.equal(tel.enabled, true);
  assert.equal(tel.phoneNumber, "+14165550100");

  const matched = await store.getTenantByPhoneNumber("+1 (416) 555-0100");
  assert.equal(matched?.id, "tenant_dgtlmag");
  const unknown = await store.getTenantByPhoneNumber("+19998887777");
  assert.equal(unknown, null);
});

// --- Routes ------------------------------------------------------------------

test("inbound webhook rejects invalid signature (403)", async () => {
  const response = await inboundPOST(
    unsignedRequest("/api/telephony/inbound", { To: "+14165550100", From: "+14165551234", CallSid: "CAx" })
  );
  assert.equal(response.status, 403);
});

test("inbound webhook with valid signature logs a Call and returns TwiML", async () => {
  const params = { To: "+14165550100", From: "+14165551234", CallSid: "CAinbound1" };
  const response = await inboundPOST(webhookRequest("/api/telephony/inbound", params));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /xml/);
  const body = await response.text();
  assert.match(body, /<Response>/);

  const call = await store.getCallByProviderId("CAinbound1");
  assert.equal(call.direction, "inbound");
  assert.equal(call.tenantId, "tenant_dgtlmag");

  // Timeline entry was appended for the call.
  const events = await store.listOutreachEvents({ teamId: TEAM });
  assert.ok(events.some((event) => event.leadId === call.leadId && /Inbound call/.test(event.metadata?.summary || "")));
});

test("status webhook updates the matching Call (status + duration)", async () => {
  // Seed a known call, then post a completed status for it.
  const seeded = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    leadId: "",
    direction: "outbound",
    status: "ringing",
    providerCallId: "CAstatus1"
  });
  const response = await statusPOST(
    webhookRequest("/api/telephony/status", { CallSid: "CAstatus1", CallStatus: "completed", CallDuration: "85" })
  );
  assert.equal(response.status, 200);

  const updated = await store.getCallById(seeded.id);
  assert.equal(updated.status, "completed");
  assert.equal(updated.durationSeconds, 85);
  assert.ok(updated.endedAt);
});

test("missed inbound status creates an urgent callback task + timeline entry", async () => {
  const lead = await store.createLead({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    businessName: "Missed Inc",
    phone: "+14165552222"
  });
  await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    leadId: lead.id,
    direction: "inbound",
    status: "ringing",
    providerCallId: "CAmissed1"
  });

  const response = await statusPOST(
    webhookRequest("/api/telephony/status", { CallSid: "CAmissed1", CallStatus: "no-answer" })
  );
  assert.equal(response.status, 200);

  const tasks = await store.listTasks({ teamId: TEAM, status: "open" });
  const task = tasks.find((item) => item.leadId === lead.id);
  assert.ok(task, "expected a callback task");
  assert.equal(task.priority, "urgent");
  assert.match(task.title, /Call back/);

  const refreshed = await store.getLeadById(lead.id);
  assert.equal(refreshed.callStatus, "missed");
});

test("outbound guard rejects do-not-call, foreign-team, and disabled tenants", () => {
  const enabledTenant = { telephony: { enabled: true } };

  // Happy path.
  assert.equal(
    checkOutboundLead({ lead: { teamId: TEAM }, teamId: TEAM, tenant: enabledTenant }).ok,
    true
  );
  // do-not-call / do-not-contact.
  assert.equal(
    checkOutboundLead({ lead: { teamId: TEAM, doNotCall: true }, teamId: TEAM, tenant: enabledTenant }).status,
    409
  );
  assert.equal(
    checkOutboundLead({ lead: { teamId: TEAM, doNotContact: true }, teamId: TEAM, tenant: enabledTenant }).status,
    409
  );
  // Lead from another team.
  assert.equal(
    checkOutboundLead({ lead: { teamId: "team_other" }, teamId: TEAM, tenant: enabledTenant }).status,
    404
  );
  // Telephony disabled.
  assert.equal(
    checkOutboundLead({ lead: { teamId: TEAM }, teamId: TEAM, tenant: { telephony: { enabled: false } } }).status,
    409
  );
});

test("canDeleteCalls is restricted to the configured owner email", async () => {
  const { canDeleteCalls, DELETE_ADMIN_EMAIL } = await import("../lib/permissions.js");
  assert.equal(DELETE_ADMIN_EMAIL, "stephen@dgtlgroup.io");
  assert.equal(canDeleteCalls({ role: "owner", email: "stephen@dgtlgroup.io" }), true);
  assert.equal(canDeleteCalls({ role: "owner", email: "STEPHEN@DGTLGROUP.IO" }), true); // case-insensitive
  assert.equal(canDeleteCalls({ role: "owner", email: "someoneelse@dgtlgroup.io" }), false);
  assert.equal(canDeleteCalls({ role: "admin", email: "stephen@dgtlgroup.io" }), true); // email is the gate
  assert.equal(canDeleteCalls({}), false);
});

test("deleteCall removes the call and its events", async () => {
  const call = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    direction: "outbound",
    status: "completed",
    providerCallId: "CAdelete1"
  });
  await store.addCallEvent(call.id, "status_update", { status: "completed" });
  assert.ok(await store.getCallById(call.id), "call exists before delete");

  const removed = await store.deleteCall(call.id);
  assert.equal(removed, true);
  assert.equal(await store.getCallById(call.id), null);
  const events = await store.getCallEventsForCall(call.id);
  assert.equal(events.length, 0);
});

test("saving a 'do_not_call' outcome flips the lead flag", async () => {
  const lead = await store.createLead({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    businessName: "Outcome Inc",
    phone: "+14165553333"
  });
  const call = await store.createCall({
    teamId: TEAM,
    tenantId: "tenant_dgtlmag",
    leadId: lead.id,
    direction: "outbound",
    status: "completed"
  });

  await store.updateCall(call.id, { outcome: "do_not_call" });
  await store.updateLead(lead.id, { doNotCall: true }, { teamId: TEAM });

  const updatedCall = await store.getCallById(call.id);
  const updatedLead = await store.getLeadById(lead.id);
  assert.equal(updatedCall.outcome, "do_not_call");
  assert.equal(updatedLead.doNotCall, true);
});
