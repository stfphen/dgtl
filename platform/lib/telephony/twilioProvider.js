// Real Twilio implementation of the telephony provider contract.
// The `twilio` SDK is imported lazily (dynamic import) so the module loads with
// zero cost when telephony is not configured — mirroring the Stripe/pg pattern
// (lib/payments/stripe.js, lib/store.js). Secrets come from env only; never from
// tenant config, never logged.

import { providerFailure, providerNotConfigured, providerSuccess } from "../integrations/providerResponse.js";

const PROVIDER = "twilio";

// Twilio CallStatus -> our callStatuses union. busy/no-answer/canceled collapse
// to "missed" (the spec calls this out for inbound; it is also correct for a
// missed outbound attempt).
const STATUS_MAP = {
  queued: "ringing",
  initiated: "ringing",
  ringing: "ringing",
  "in-progress": "in_progress",
  in_progress: "in_progress",
  completed: "completed",
  failed: "failed",
  busy: "missed",
  "no-answer": "missed",
  canceled: "missed",
  cancelled: "missed"
};

function mapTwilioStatus(value) {
  return STATUS_MAP[String(value || "").toLowerCase()] || "failed";
}

export function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

let cachedClient;
async function getClient() {
  const { default: twilio } = await import("twilio");
  if (!cachedClient) {
    cachedClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return cachedClient;
}

async function getVoiceResponse() {
  const { default: twilio } = await import("twilio");
  return new twilio.twiml.VoiceResponse();
}

/**
 * Build the bridge TwiML that runs once the REP answers: optionally announce a
 * recording disclaimer, then dial the lead presenting the tenant number as caller
 * ID. Extracted (and exported) so the recording/consent behaviour is unit-testable
 * without placing a real call. `recording`: { enabled, consentMode }.
 */
async function buildOutboundResponse({ tenantNumber, leadNumber, recording, recordingStatusCallbackUrl } = {}) {
  const twiml = await getVoiceResponse();

  // Consent announcement only for jurisdictions that require notice. One-party
  // consent (e.g. Canada) needs no announcement, so "one_party" is skipped.
  if (
    recording?.enabled &&
    (recording.consentMode === "play_disclaimer" || recording.consentMode === "two_party_notice")
  ) {
    twiml.say("This call may be recorded for quality and training purposes.");
  }

  const dialOpts = { callerId: tenantNumber };
  if (recording?.enabled) {
    // Record both legs from the moment the lead answers.
    dialOpts.record = "record-from-answer-dual";
    if (recordingStatusCallbackUrl) {
      dialOpts.recordingStatusCallback = recordingStatusCallbackUrl;
      dialOpts.recordingStatusCallbackEvent = "completed";
      dialOpts.recordingStatusCallbackMethod = "POST";
    }
  }
  const dial = twiml.dial(dialOpts);
  dial.number(leadNumber);
  return twiml.toString();
}

/**
 * Click-to-call: dial the rep first, then bridge to the lead presenting the
 * tenant number as caller ID. Returns a providerResponse envelope.
 */
async function createOutboundCall({
  tenantNumber,
  repNumber,
  leadNumber,
  statusCallbackUrl,
  callId,
  recording,
  recordingStatusCallbackUrl
} = {}) {
  if (!isTwilioConfigured()) {
    return providerNotConfigured(PROVIDER, "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
  }
  if (!tenantNumber || !repNumber || !leadNumber) {
    return providerFailure(PROVIDER, "Missing tenant, rep, or lead number for outbound call.");
  }
  try {
    const client = await getClient();
    const twiml = await buildOutboundResponse({
      tenantNumber,
      leadNumber,
      recording,
      recordingStatusCallbackUrl
    });

    const call = await client.calls.create({
      to: repNumber,
      from: tenantNumber,
      twiml,
      statusCallback: statusCallbackUrl || undefined,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST"
    });

    return providerSuccess(PROVIDER, { providerCallId: call.sid, status: call.status || "queued", callId: callId || "" });
  } catch (error) {
    return providerFailure(PROVIDER, error?.message || "Failed to create outbound call.");
  }
}

/**
 * Kick off a Conversational Intelligence transcript for a finished recording.
 * `customerKey` tags the transcript with our Call id so the completion webhook
 * can match it back. Requires TWILIO_INTELLIGENCE_SERVICE_SID (the CI Service).
 */
async function createRecordingTranscript({ recordingSid, customerKey } = {}) {
  if (!isTwilioConfigured()) {
    return providerNotConfigured(PROVIDER, "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN");
  }
  const serviceSid = process.env.TWILIO_INTELLIGENCE_SERVICE_SID;
  if (!serviceSid) {
    return providerNotConfigured(PROVIDER, "TWILIO_INTELLIGENCE_SERVICE_SID");
  }
  if (!recordingSid) {
    return providerFailure(PROVIDER, "Missing recordingSid for transcription.");
  }
  try {
    const client = await getClient();
    const transcript = await client.intelligence.v2.transcripts.create({
      serviceSid,
      channel: { media_properties: { source_sid: recordingSid } },
      ...(customerKey ? { customerKey } : {})
    });
    return providerSuccess(PROVIDER, { transcriptSid: transcript.sid, status: transcript.status });
  } catch (error) {
    return providerFailure(PROVIDER, error?.message || "Failed to create transcript.");
  }
}

/**
 * Fetch a completed CI transcript and flatten its sentences into readable text.
 * Returns "" on any failure so callers never overwrite a good transcript with junk.
 */
async function fetchTranscriptText(transcriptSid) {
  if (!isTwilioConfigured() || !transcriptSid) return "";
  try {
    const client = await getClient();
    const sentences = await client.intelligence.v2.transcripts(transcriptSid).sentences.list({ limit: 1000 });
    return sentences
      .slice()
      .sort((a, b) => (a.sentenceIndex ?? 0) - (b.sentenceIndex ?? 0))
      .map((s) => {
        const who = s.mediaChannel === 2 ? "Speaker 2" : "Speaker 1";
        const line = (s.transcript ?? s.text ?? "").trim();
        return line ? `${who}: ${line}` : "";
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

/**
 * Build the TwiML voice response for an inbound call.
 * ctx.action: "dial" -> bridge to destination; "voicemail" -> record; else reject.
 */
async function buildInboundResponse(ctx = {}) {
  const { action, destinationNumber, tenantNumber, greeting } = ctx;
  const res = await getVoiceResponse();

  if (action === "dial" && destinationNumber) {
    const dial = res.dial({ callerId: tenantNumber || undefined, timeout: 20 });
    dial.number(destinationNumber);
  } else if (action === "voicemail") {
    res.say(greeting || "Please leave a message after the tone.");
    res.record({ maxLength: 120, playBeep: true });
    res.hangup();
  } else {
    res.say(greeting || "Sorry, we are unable to take your call right now. Goodbye.");
    res.hangup();
  }
  return res.toString();
}

/**
 * Normalize a Twilio status callback into our shape. Pure — no SDK, no I/O — so
 * the status route can stamp timestamps and tests can exercise it directly.
 */
function handleCallStatusUpdate(update = {}) {
  const callStatus = update.CallStatus ?? update.callStatus ?? "";
  const status = mapTwilioStatus(callStatus);
  const durationRaw = update.CallDuration ?? update.callDuration;
  const duration = durationRaw === undefined || durationRaw === null || durationRaw === "" ? null : Number(durationRaw);
  return {
    providerCallId: update.CallSid ?? update.callSid ?? "",
    status,
    durationSeconds: Number.isFinite(duration) ? duration : null,
    isTerminal: ["completed", "missed", "failed"].includes(status),
    raw: String(callStatus)
  };
}

/**
 * Verify a Twilio webhook signature against the EXACT public URL + params.
 * Returns false (rejects) when unconfigured or unsigned — never accept unsigned
 * requests. @param {{url:string, signature:string, params:object}} verification
 */
async function verifyWebhook({ url, signature, params } = {}) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature || !url) return false;
  try {
    const { default: twilio } = await import("twilio");
    return twilio.validateRequest(token, signature, url, params || {});
  } catch {
    return false;
  }
}

export const twilioProvider = {
  name: PROVIDER,
  isConfigured: isTwilioConfigured,
  createOutboundCall,
  buildOutboundResponse,
  createRecordingTranscript,
  fetchTranscriptText,
  buildInboundResponse,
  handleCallStatusUpdate,
  verifyWebhook
};
