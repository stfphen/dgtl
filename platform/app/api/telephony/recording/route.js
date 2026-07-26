import { parseTwilioWebhook } from "../../../../lib/telephony/webhookRequest.js";
import { createRecordingTranscript } from "../../../../lib/telephony/index.js";
import {
  inAppTranscriptionAvailable,
  transcribeAndSummarizeCall
} from "../../../../lib/telephony/transcribeRecording.js";
import {
  addCallEvent,
  getCallByProviderId,
  getTenantTelephony,
  updateCall
} from "../../../../lib/store.js";

// POST /api/telephony/recording — Twilio recordingStatusCallback.
// Verifies the signature, matches the Call by CallSid, and (only when the tenant
// has recording enabled) persists the recording URL + duration. Mirrors
// /api/telephony/status. Never accepts unsigned requests.
export async function POST(request) {
  const { params, verified } = await parseTwilioWebhook(request, "/api/telephony/recording");
  if (!verified) {
    return new Response("Invalid signature", { status: 403 });
  }

  const callSid = params.CallSid || params.callSid || "";
  const call = await getCallByProviderId(callSid);
  if (!call) {
    // Unknown call id — acknowledge so Twilio stops retrying.
    return new Response("", { status: 200 });
  }

  const tel = await getTenantTelephony(call.tenantId);
  if (!tel.recordingEnabled) {
    // Recording not enabled for this tenant — ignore the payload.
    return new Response("", { status: 200 });
  }

  // Twilio sends the media base URL; ".mp3" yields a directly playable file.
  const base = params.RecordingUrl || params.recordingUrl || "";
  const recordingUrl = base ? (/\.\w+$/.test(base) ? base : `${base}.mp3`) : "";
  const durationRaw = params.RecordingDuration ?? params.recordingDuration;
  const duration =
    durationRaw === undefined || durationRaw === null || durationRaw === "" ? null : Number(durationRaw);

  const updates = {};
  if (recordingUrl) updates.recordingUrl = recordingUrl;
  if (Number.isFinite(duration) && duration > 0) updates.durationSeconds = duration;

  if (Object.keys(updates).length) {
    await updateCall(call.id, updates);
  }
  await addCallEvent(call.id, "recording", {
    recordingUrl,
    durationSeconds: Number.isFinite(duration) ? duration : null,
    recordingSid: params.RecordingSid || "",
    callSid
  });

  // Post-call transcription. Prefer in-app transcription (OpenAI Whisper +
  // Claude summary) — it only needs the recording audio, so it works on a Twilio
  // trial. Fall back to Twilio Conversational Intelligence when an Intelligence
  // Service is configured but no OpenAI key is set.
  const recordingSid = params.RecordingSid || params.recordingSid || "";
  if (tel.transcriptionEnabled && recordingUrl) {
    if (inAppTranscriptionAvailable()) {
      // Fire-and-forget: ack Twilio fast; the long-lived server finishes the work.
      transcribeAndSummarizeCall({ ...call, recordingUrl }).catch(() => {});
      await addCallEvent(call.id, "transcription_requested", { engine: "openai", recordingSid });
    } else if (recordingSid) {
      const t = await createRecordingTranscript({ recordingSid, customerKey: callSid });
      await addCallEvent(call.id, "transcription_requested", {
        engine: "twilio_ci",
        ok: Boolean(t?.ok),
        transcriptSid: t?.data?.transcriptSid || "",
        error: t?.ok ? "" : t?.error || "",
        recordingSid
      });
    }
  }

  return new Response("", { status: 200 });
}
