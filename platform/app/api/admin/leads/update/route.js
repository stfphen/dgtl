import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getSessionTeamId, updateLead } from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") || "");
  const redirectTo = String(form.get("redirectTo") || "/admin");

  await updateLead(leadId, {
    contactName: String(form.get("contactName") || ""),
    contactTitle: String(form.get("contactTitle") || ""),
    notes: String(form.get("notes") || ""),
    enrichmentStatus: String(form.get("enrichmentStatus") || ""),
    outreachStatus: String(form.get("outreachStatus") || ""),
    pipelineStatus: String(form.get("pipelineStatus") || ""),
    leadScore: Number(form.get("leadScore") || 0),
    leadScoreReason: String(form.get("leadScoreReason") || ""),
    painPoints: String(form.get("painPoints") || ""),
    recommendedOffer: String(form.get("recommendedOffer") || ""),
    assignedTo: String(form.get("assignedTo") || ""),
    nextFollowUpAt: String(form.get("nextFollowUpAt") || ""),
    replyStatus: String(form.get("replyStatus") || ""),
    campaignId: String(form.get("campaignId") || "")
  }, { teamId: getSessionTeamId(session) });

  const url = new URL(redirectTo, process.env.PUBLIC_APP_URL || request.url);
  url.searchParams.set("notice", "Lead updated.");
  return NextResponse.redirect(url, 303);
}
