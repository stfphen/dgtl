import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { runLeadEnrichmentWorkflow } from "../../../../../lib/enrichment/workflow.js";
import { getLeadById, getSessionTeamId, updateLeadResearch } from "../../../../../lib/store";
import { redirectToUrl, sameHostUrl } from "../../../../../lib/http/redirects";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const redirectUrl = sameHostUrl("/admin");
  const form = await request.formData();
  const leadId = String(form.get("leadId") || "");
  const lead = await getLeadById(leadId, { teamId });

  if (!lead) {
    redirectUrl.searchParams.set("notice", "Lead not found.");
    return redirectToUrl(redirectUrl);
  }

  if (!lead.websiteUrl) {
    redirectUrl.searchParams.set("notice", "Lead website is missing.");
    return redirectToUrl(redirectUrl);
  }

  const result = await runLeadEnrichmentWorkflow({ lead });

  if (!result.update) {
    redirectUrl.searchParams.set("notice", result.notice || "Enrichment failed.");
    return redirectToUrl(redirectUrl);
  }

  const updatedLead = await updateLeadResearch(lead.id, result.update, { teamId });

  if (!updatedLead) {
    redirectUrl.searchParams.set("notice", "Lead not found.");
    return redirectToUrl(redirectUrl);
  }

  redirectUrl.searchParams.set("notice", result.notice);
  return redirectToUrl(redirectUrl);
}
