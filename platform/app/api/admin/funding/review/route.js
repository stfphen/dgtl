import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getLeadById, getSessionTeamId, mergeLeadMetadata, updateLead } from "../../../../../lib/store";
import { buildReviewPatch } from "../../../../../lib/funding/review";
import { redirectSameHost } from "../../../../../lib/http/redirects";

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
  const reviewer = String(form.get("reviewer") || session.name || session.email || "");
  const checkedItemIds = form.getAll("items").map((value) => String(value));

  const teamId = getSessionTeamId(session);
  const lead = await getLeadById(leadId, { teamId });

  if (lead) {
    const existingMetadata = lead.sourceMetadata || lead.metadata || {};
    const patch = buildReviewPatch({ checkedItemIds, reviewer, updatedAt: new Date().toISOString() });
    const metadata = mergeLeadMetadata(existingMetadata, patch);
    await updateLead(leadId, { metadata }, { teamId });
  }

  return redirectSameHost(redirectTo, lead ? "Funding review saved." : "Lead not found.");
}
