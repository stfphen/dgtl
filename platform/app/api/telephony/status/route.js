import { parseTwilioWebhook } from "../../../../lib/telephony/webhookRequest.js";
import { handleCallStatusUpdate } from "../../../../lib/telephony/index.js";
import { createMissedCallTask } from "../../../../lib/telephony/followups.js";
import {
  addCallEvent,
  createOutreachEvent,
  getCallByProviderId,
  getTenantTelephony,
  updateCall,
  updateLead
} from "../../../../lib/store.js";

// POST /api/telephony/status — Twilio call status callback.
// Verifies signature, updates the matching Call, logs an event, and triggers the
// missed-call follow-up hook when the final status is "missed".
export async function POST(request) {
  const { params, verified } = await parseTwilioWebhook(request, "/api/telephony/status");
  if (!verified) {
    return new Response("Invalid signature", { status: 403 });
  }

  const update = handleCallStatusUpdate(params);
  const call = await getCallByProviderId(update.providerCallId);
  if (!call) {
    // Unknown call id — acknowledge so Twilio stops retrying.
    return new Response("", { status: 200 });
  }

  const tel = await getTenantTelephony(call.tenantId);
  const nowIso = new Date().toISOString();
  const updates = {
    status: update.status,
    durationSeconds: update.durationSeconds
  };
  if (update.status === "in_progress" && !call.startedAt) updates.startedAt = nowIso;
  if (update.isTerminal) updates.endedAt = nowIso;
  // Only persist a recording URL when the tenant has recording enabled.
  if (tel.recordingEnabled && params.RecordingUrl) updates.recordingUrl = params.RecordingUrl;

  const updated = await updateCall(call.id, updates);
  await addCallEvent(call.id, "status_update", {
    status: update.status,
    raw: update.raw,
    callSid: update.providerCallId
  });

  if (update.status === "missed") {
    await createMissedCallTask({ call: updated || call });
  } else if (update.status === "completed" && call.leadId) {
    // Completed call: stamp lead contact timestamps + a readable timeline entry.
    await updateLead(
      call.leadId,
      { lastCallAt: nowIso, lastContactedAt: nowIso, callStatus: "completed" },
      { teamId: call.teamId }
    );
    const mins = Math.floor((update.durationSeconds || 0) / 60);
    const secs = (update.durationSeconds || 0) % 60;
    await createOutreachEvent({
      teamId: call.teamId,
      leadId: call.leadId,
      type: "call",
      metadata: {
        summary: `${call.direction === "inbound" ? "Inbound" : "Outbound"} call completed — ${mins}m${String(secs).padStart(2, "0")}s`,
        callId: call.id,
        direction: call.direction
      }
    });
  }

  return new Response("", { status: 200 });
}
