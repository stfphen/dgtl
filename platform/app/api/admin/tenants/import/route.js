import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getSessionTeamId, upsertTenantConfig } from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const config = JSON.parse(String(form.get("configJson") || "{}"));
  const teamId = getSessionTeamId(session);
  try {
    const tenant = await upsertTenantConfig(config, { teamId });
    await logAudit({
      userId: session.user?.id,
      action: "tenant.imported",
      targetType: "tenant",
      targetId: tenant.id,
      metadata: {
        teamId,
        slug: tenant.slug,
        status: tenant.status,
        domainCount: tenant.domains?.length || 0
      }
    });
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  return NextResponse.redirect(new URL("/admin", process.env.PUBLIC_APP_URL || request.url), 303);
}
