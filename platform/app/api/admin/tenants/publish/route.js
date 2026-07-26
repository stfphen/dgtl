import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getSessionTeamId, publishTenantConfig } from "../../../../../lib/store";

export const dynamic = "force-dynamic";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  url.searchParams.set("tab", "tenants");
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const form = await request.formData();
  const tenantId = String(form.get("tenantId") || "").trim();

  if (!tenantId) {
    return redirectAdmin(request, "Missing tenant id.");
  }

  let tenant;
  try {
    tenant = await publishTenantConfig(tenantId, { teamId });
  } catch (error) {
    return redirectAdmin(request, `Publish failed: ${error?.message || "unknown error"}`);
  }

  await logAudit({
    userId: session.user?.id,
    action: "tenant.published",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: { teamId, slug: tenant.slug, status: tenant.status }
  });

  return redirectAdmin(request, `Published ${tenant.slug}.`);
}
