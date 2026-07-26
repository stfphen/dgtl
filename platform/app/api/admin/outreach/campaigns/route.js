import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import {
  createOutreachCampaign,
  getSessionTeamId,
  requireTenantAccess,
  updateOutreachCampaign
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
  const campaignId = String(form.get("campaignId") || "");
  const payload = {
    tenantId: String(form.get("tenantId") || ""),
    name: String(form.get("name") || "").trim(),
    description: String(form.get("description") || "").trim(),
    status: String(form.get("status") || "draft"),
    sourceFilter: String(form.get("sourceFilter") || "").trim(),
    cityFilter: String(form.get("cityFilter") || "").trim(),
    categoryFilter: String(form.get("categoryFilter") || "").trim(),
    dailySendCap: Number(form.get("dailySendCap") || 25),
    perDomainDailyCap: Number(form.get("perDomainDailyCap") || 1),
    followUpTemplateId: String(form.get("followUpTemplateId") || "").trim(),
    followUpDelayDays: Number(form.get("followUpDelayDays") || 3),
    testMode: form.get("testMode") === "on"
  };

  if (payload.tenantId) {
    try {
      await requireTenantAccess(teamId, payload.tenantId);
    } catch (error) {
      return permissionDeniedResponse(error, request);
    }
  }

  if (!payload.name) return redirectAdmin(request, "Campaign name is required.");

  if (action === "update" && campaignId) {
    await updateOutreachCampaign(campaignId, payload, { teamId });
    return redirectAdmin(request, "Campaign updated.");
  }

  await createOutreachCampaign({ ...payload, teamId });
  return redirectAdmin(request, "Campaign created.");
}
