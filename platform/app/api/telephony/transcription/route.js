import { fetchTranscriptText, verifyWebhook } from "../../../../lib/telephony/index.js";
import { webhookUrl } from "../../../../lib/telephony/webhookUrl.js";
import { summarizeCallTranscript } from "../../../../lib/telephony/callSummary.js";
import { addCallEvent, getCallByProviderId, getTenantTelephony, updateCall } from "../../../../lib/store.js";

// POST /api/telephony/transcription — Twilio Conversational Intelligence service
// webhook. Fires when a transcript is ready ("voice_intelligence_transcript_available").
// The payload carries transcript_sid + customer_key (we set customer_key to the
// parent CallSid). We fetch the transcript text, store it, then summarize via Claude.
//
// CI service webhooks are not always signed; when a signature IS present we require
// it to be valid, otherwise we proceed (the body only triggers a fetch using our
// own credentials, scoped to our account).
async function parseBody(request) {
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      return await request.json();
    }
    const form = await request.formData();
    const out = {};
    for (const [k, v] of form.entries()) out[k] = typeof v === "string" ? v : "";
    return out;
  } catch {
    return {};
  }
}

export async function POST(request) {
  const params = await parseBody(request);

  const signature = request.headers.get("x-twilio-signature");
  if (signature) {
    const ok = await verifyWebhook({ url: webhookUrl("/api/telephony/transcription"), signature, params });
    if (!ok) return new Response("Invalid signature", { status: 403 });
  }

  const eventType = params.event_type || params.EventType || "";
  if (eventType && eventType !== "voice_intelligence_transcript_available") {
    // Some other CI event — acknowledge and ignore.
    return new Response("", { status: 200 });
  }

  const transcriptSid = params.transcript_sid || params.TranscriptSid || "";
  const customerKey = params.customer_key || params.CustomerKey || "";
  if (!transcriptSid || !customerKey) {
    return new Response("", { status: 200 });
  }

  // customer_key is the parent CallSid we tagged at create time.
  const call = await getCallByProviderId(customerKey);
  if (!call) {
    return new Response("", { status: 200 });
  }

  const tel = await getTenantTelephony(call.tenantId);
  if (!tel.transcriptionEnabled) {
    return new Response("", { status: 200 });
  }

  const transcript = await fetchTranscriptText(transcriptSid);
  if (!transcript) {
    await addCallEvent(call.id, "transcription", { transcriptSid, note: "empty or unavailable" });
    return new Response("", { status: 200 });
  }

  const updates = { transcript };
  const aiSummary = await summarizeCallTranscript(transcript);
  if (aiSummary) updates.aiSummary = aiSummary;

  await updateCall(call.id, updates);
  await addCallEvent(call.id, "transcription", {
    transcriptSid,
    chars: transcript.length,
    summarized: Boolean(aiSummary)
  });

  return new Response("", { status: 200 });
}
