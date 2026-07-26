import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions.js";
import { createOutboundCall, maybeSimulateCall } from "../../../../lib/telephony/index.js";
import { webhookUrl } from "../../../../lib/telephony/webhookUrl.js";
import { toE164US } from "../../../../lib/telephony/phone.js";
import { createCall, getSessionTeamId, getTenantByIdOrSlug } from "../../../../lib/store.js";

// POST /api/telephony/dial — ad-hoc outbound call to a typed number (dialpad),
// not tied to a lead. Bridges the requesting rep to the number with the tenant
// number as caller ID; logs a Call with no leadId.
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

  const leadNumber = toE164US(String(body.phone || ""));
  if (!leadNumber) {
    return NextResponse.json({ error: "Enter a valid +1 phone number." }, { status: 400 });
  }

  const tenantId = String(body.tenantId || "");
  const tenant = tenantId ? await getTenantByIdOrSlug(tenantId, { teamId }) : null;
  if (!tenant) {
    return NextResponse.json({ error: "Select a tenant to call from." }, { status: 400 });
  }
  const tel = tenant.telephony || {};
  if (!tel.enabled) {
    return NextResponse.json({ error: "Telephony is not enabled for this tenant." }, { status: 409 });
  }

  const tenantNumber = toE164US(tel.phoneNumber) || (tel.phoneNumber || "").trim();
  if (!tenantNumber) {
    return NextResponse.json({ error: "Tenant phone number is not configured." }, { status: 409 });
  }

  // Rep to bridge from: the requesting user's number, else the tenant fallback.
  let repNumber = "";
  if (process.env.DATABASE_URL) {
    try {
      const { listTeamUsers } = await import("../../../../lib/users.js");
      const reps = await listTeamUsers(teamId);
      const me = reps.find((rep) => rep.id === session.userId);
      repNumber = toE164US(me?.phoneNumber) || "";
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
    leadId: "",
    provider: tel.provider || "twilio",
    providerCallId: result.data.providerCallId,
    direction: "outbound",
    status: "ringing",
    fromNumber: tenantNumber,
    toNumber: leadNumber,
    tenantNumber,
    assignedUserId: session.userId || ""
  });

  await maybeSimulateCall(call);

  return NextResponse.json({ ok: true, callId: call.id });
}
