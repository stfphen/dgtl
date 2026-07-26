import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions.js";
import { getSessionTeamId, getTenantByIdOrSlug, upsertTenantConfig } from "../../../../../lib/store.js";
import { validateAppIconOrThrow } from "../../../../../lib/branding/appIcon.js";

// POST /api/admin/tenants/branding — save a tenant's home-screen / PWA app icon.
// Merges the validated appIcon into the tenant's brand config; other brand
// fields are untouched. Mirrors the telephony route's auth + team scoping.
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

  let appIcon;
  try {
    appIcon = validateAppIconOrThrow(body.appIcon);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const tenant = await getTenantByIdOrSlug(tenantId, { teamId });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found for this team." }, { status: 404 });
  }

  const saved = await upsertTenantConfig(
    { ...tenant, brand: { ...tenant.brand, appIcon } },
    { teamId }
  );

  return NextResponse.json({ ok: true, tenantId: saved.id, appIcon: saved.brand?.appIcon || "" });
}
