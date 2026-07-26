import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { runLeadEnrichmentWorkflow } from "../../../../../lib/enrichment/workflow.js";
import { getLeadById, getSessionTeamId, updateLeadResearch } from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const redirectUrl = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  const form = await request.formData();
  const leadId = String(form.get("leadId") || "");
  const lead = await getLeadById(leadId, { teamId });

  if (!lead) {
    redirectUrl.searchParams.set("notice", "Lead not found.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (!lead.websiteUrl) {
    redirectUrl.searchParams.set("notice", "Lead website is missing.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const result = await runLeadEnrichmentWorkflow({ lead });

  if (!result.update) {
    redirectUrl.searchParams.set("notice", result.notice || "Enrichment failed.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const updatedLead = await updateLeadResearch(lead.id, result.update, { teamId });

  if (!updatedLead) {
    redirectUrl.searchParams.set("notice", "Lead not found.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  redirectUrl.searchParams.set("notice", result.notice);
  return NextResponse.redirect(redirectUrl, 303);
}
