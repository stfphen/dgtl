import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions.js";
import { createOutboundCall, maybeSimulateCall } from "../../../../lib/telephony/index.js";
import { webhookUrl } from "../../../../lib/telephony/webhookUrl.js";
import { toE164US } from "../../../../lib/telephony/phone.js";
import { checkOutboundLead } from "../../../../lib/telephony/outboundGuards.js";
import {
  createCall,
  createOutreachEvent,
  getLeadById,
  getSessionTeamId,
  getTenantByIdOrSlug
} from "../../../../lib/store.js";

// POST /api/telephony/outbound — click-to-call from the admin UI (internal,
// authenticated; NOT a webhook). Bridges the requesting rep to the lead with the
// tenant number as caller ID.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const leadId = String(body.leadId || "");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required." }, { status: 400 });
  }

  const lead = await getLeadById(leadId);
  const tenant = lead ? await getTenantByIdOrSlug(lead.tenantId, { teamId }) : null;
  const guard = checkOutboundLead({ lead, teamId, tenant });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const tel = tenant.telephony;

  const tenantNumber = toE164US(tel.phoneNumber) || (tel.phoneNumber || "").trim();
  if (!tenantNumber) {
    return NextResponse.json({ error: "Tenant phone number is not configured." }, { status: 409 });
  }
  const leadNumber = toE164US(lead.phone);
  if (!leadNumber) {
    return NextResponse.json({ error: "Lead has no valid +1 phone number." }, { status: 409 });
  }

  // Rep to bridge from: the requesting user's number, else the assigned rep,
  // else the tenant fallback number. Reps live in the DB only.
  let repNumber = "";
  if (process.env.DATABASE_URL) {
    try {
      const { listTeamUsers } = await import("../../../../lib/users.js");
      const reps = await listTeamUsers(teamId);
      const me = reps.find((rep) => rep.id === session.userId);
      repNumber = toE164US(me?.phoneNumber) || "";
      if (!repNumber && lead.assignedToUserId) {
        const assigned = reps.find((rep) => rep.id === lead.assignedToUserId);
        repNumber = toE164US(assigned?.phoneNumber) || "";
      }
    } catch {
      repNumber = "";
    }
  }
  if (!repNumber) repNumber = toE164US(tel.fallbackNumber) || "";
  if (!repNumber) {
    return NextResponse.json(
      { error: "No rep phone number available to place the call." },
      { status: 409 }
    );
  }

  const statusCallbackUrl = webhookUrl("/api/telephony/status");
  const recordingStatusCallbackUrl = webhookUrl("/api/telephony/recording");
  const result = await createOutboundCall({
    tenantNumber,
    repNumber,
    leadNumber,
    statusCallbackUrl,
    recording: {
      enabled: Boolean(tel.recordingEnabled),
      consentMode: tel.recordingConsentMode || "disabled"
    },
    recordingStatusCallbackUrl
  });
  if (!result.ok) {
    const status = result.configured === false ? 503 : 502;
    return NextResponse.json({ error: result.error || "Failed to place call." }, { status });
  }

  const call = await createCall({
    teamId,
    tenantId: tenant.id,
    leadId: lead.id,
    provider: tel.provider || "twilio",
    providerCallId: result.data.providerCallId,
    direction: "outbound",
    status: "ringing",
    fromNumber: tenantNumber,
    toNumber: leadNumber,
    tenantNumber,
    assignedUserId: session.userId || ""
  });

  // Readable timeline entry; detailed metadata stays on the Call record.
  await createOutreachEvent({
    teamId,
    leadId: lead.id,
    type: "call",
    metadata: {
      summary: `Outbound call started by ${session.user?.name || session.email || "rep"}${
        tel.recordingEnabled ? ` · recording on (${tel.recordingConsentMode || "consent"})` : ""
      }`,
      callId: call.id,
      direction: "outbound"
    }
  });

  // Mock provider only: advance the logged call through its simulated lifecycle.
  // No-op under real providers (their lifecycle arrives via webhooks).
  await maybeSimulateCall(call);

  return NextResponse.json({
    ok: true,
    callId: call.id,
    providerCallId: result.data.providerCallId
  });
}
