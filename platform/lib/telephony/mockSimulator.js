// Drives a mock outbound Call through its lifecycle by writing directly to the
// store — mirrors what Twilio's status + recording webhooks would do, but with no
// network and no cost. Imported lazily from lib/telephony/index.js
// (maybeSimulateCall) so the provider modules stay store-free.

import {
  addCallEvent,
  createOutreachEvent,
  getTenantTelephony,
  updateCall,
  updateLead
} from "../store.js";
import { MOCK_RECORDING_URL } from "./mockProvider.js";

// Timings (ms) for the live, setTimeout-driven demo. Tests use
// runMockCallLifecycle for a deterministic, timer-free run.
const RING_MS = 1500;
const TALK_MS = 6000;

// 25s–180s of "talk time" for a believable demo log.
function randomDuration() {
  return 25 + Math.floor(Math.random() * 156);
}

// Canned transcript + summary used only in mock mode (no Twilio CI / Claude calls).
const MOCK_TRANSCRIPT = [
  "Speaker 1: Hi, this is the team at DGTL — is now an okay time for a quick minute?",
  "Speaker 2: Sure, what's this about?",
  "Speaker 1: We help local brands tighten up their content and checkout funnel. I noticed a couple of quick wins on your site and wanted to see if it's worth a deeper look.",
  "Speaker 2: We've been meaning to redo our landing pages, actually. Send me something and let's talk next week.",
  "Speaker 1: Perfect — I'll email a short proposal and follow up Tuesday."
].join("\n");

const MOCK_SUMMARY = [
  "Prospect was receptive to a content/checkout funnel refresh and mentioned they've been meaning to redo their landing pages.",
  "Outcome: Interested — wants a proposal.",
  "Next step: Email a short proposal and follow up Tuesday.",
  "Key points:\n- Open to a deeper review\n- Landing-page redo already on their radar\n- Prefers to talk again next week"
].join("\n\n");

async function markInProgress(call) {
  const nowIso = new Date().toISOString();
  await updateCall(call.id, { status: "in_progress", startedAt: nowIso });
  await addCallEvent(call.id, "status_update", { status: "in_progress", simulated: true });
}

async function markCompleted(call, { durationSeconds } = {}) {
  const nowIso = new Date().toISOString();
  const tel = await getTenantTelephony(call.tenantId);
  const duration = durationSeconds ?? randomDuration();

  const updates = { status: "completed", durationSeconds: duration, endedAt: nowIso };
  if (tel.recordingEnabled) updates.recordingUrl = MOCK_RECORDING_URL;

  // Mock parity for transcription: canned transcript + summary so the demo shows
  // the full pipeline without calling Twilio CI or Claude (keeps the demo free).
  if (tel.transcriptionEnabled) {
    updates.transcript = MOCK_TRANSCRIPT;
    updates.aiSummary = MOCK_SUMMARY;
  }

  await updateCall(call.id, updates);
  await addCallEvent(call.id, "status_update", { status: "completed", simulated: true });
  if (tel.transcriptionEnabled) {
    await addCallEvent(call.id, "transcription", { simulated: true, chars: MOCK_TRANSCRIPT.length });
  }

  if (tel.recordingEnabled) {
    await addCallEvent(call.id, "recording", {
      recordingUrl: MOCK_RECORDING_URL,
      durationSeconds: duration,
      consentMode: tel.recordingConsentMode,
      simulated: true
    });
  }

  if (call.leadId) {
    await updateLead(
      call.leadId,
      { lastCallAt: nowIso, lastContactedAt: nowIso, callStatus: "completed" },
      { teamId: call.teamId }
    );
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    await createOutreachEvent({
      teamId: call.teamId,
      leadId: call.leadId,
      type: "call",
      metadata: {
        summary: `Outbound call completed (mock) — ${mins}m${String(secs).padStart(2, "0")}s${
          tel.recordingEnabled ? " · recorded" : ""
        }`,
        callId: call.id,
        direction: "outbound",
        simulated: true
      }
    });
  }
}

// Live demo: schedule the transitions and return immediately. Safe in a
// long-lived Node server (next start); not used in tests.
export function scheduleMockCallLifecycle(call) {
  setTimeout(() => {
    markInProgress(call).catch(() => {});
  }, RING_MS);
  setTimeout(() => {
    markCompleted(call).catch(() => {});
  }, RING_MS + TALK_MS);
}

// Deterministic, timer-free run for tests and synchronous callers.
export async function runMockCallLifecycle(call, opts = {}) {
  await markInProgress(call);
  await markCompleted(call, opts);
}
