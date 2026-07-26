import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions.js";
import { getSessionTeamId, getTenantByIdOrSlug, upsertTenantConfig } from "../../../../../lib/store.js";
import { normalizeTenantTelephony } from "../../../../../lib/telephony/constants.js";

// POST /api/admin/tenants/telephony — save a tenant's telephony SETUP config.
// Merges normalized telephony into the tenant config; activity is untouched.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
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
  const tenantId = String(body.tenantId || "");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
  }

  const tenant = await getTenantByIdOrSlug(tenantId, { teamId });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found for this team." }, { status: 404 });
  }

  const telephony = normalizeTenantTelephony(body.telephony);
  const saved = await upsertTenantConfig({ ...tenant, telephony }, { teamId });

  return NextResponse.json({ ok: true, tenantId: saved.id, telephony: saved.telephony });
}
