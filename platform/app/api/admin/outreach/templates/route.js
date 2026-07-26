import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import {
  createOutreachTemplate,
  getSessionTeamId,
  requireTenantAccess,
  updateOutreachTemplate
} from "../../../../../lib/store";

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
  const action = String(form.get("action") || "create");
  const templateId = String(form.get("templateId") || "");
  const payload = {
    tenantId: String(form.get("tenantId") || ""),
    name: String(form.get("name") || "").trim(),
    subject: String(form.get("subject") || "").trim(),
    body: String(form.get("body") || "").trim(),
    category: String(form.get("category") || "").trim(),
    offerType: String(form.get("offerType") || "").trim()
  };

  if (payload.tenantId) {
    try {
      await requireTenantAccess(teamId, payload.tenantId);
    } catch (error) {
      return permissionDeniedResponse(error, request);
    }
  }

  if (action === "deactivate" && templateId) {
    await updateOutreachTemplate(templateId, { isActive: false }, { teamId });
    return redirectAdmin(request, "Template deactivated.");
  }

  if (!payload.name || !payload.subject || !payload.body) {
    return redirectAdmin(request, "Template name, subject, and body are required.");
  }

  if (action === "update" && templateId) {
    await updateOutreachTemplate(templateId, { ...payload, isActive: form.get("isActive") === "on" }, { teamId });
    return redirectAdmin(request, "Template updated.");
  }

  await createOutreachTemplate({ ...payload, teamId, isActive: true });
  return redirectAdmin(request, "Template created.");
}
