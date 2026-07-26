import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { normalizeDomain, normalizeEmail } from "../../../../../lib/outreachSequence";
import { createOutreachSuppression, getSessionTeamId, requireTenantAccess } from "../../../../../lib/store";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const teamId = getSessionTeamId(session);
  const email = normalizeEmail(form.get("email"));
  const domain = normalizeDomain(form.get("domain"));
  const reason = String(form.get("reason") || "manual");
  const tenantId = String(form.get("tenantId") || "");

  if (!email && !domain) return redirectAdmin(request, "Add an email or domain to suppress.");
  if (tenantId) {
    try {
      await requireTenantAccess(teamId, tenantId);
    } catch (error) {
      return permissionDeniedResponse(error, request);
    }
  }

  await createOutreachSuppression({
    teamId,
    tenantId,
    email,
    domain,
    reason
  });

  return redirectAdmin(request, "Suppression added.");
}
