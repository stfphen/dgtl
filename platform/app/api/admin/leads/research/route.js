import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getLeadById, getSessionTeamId, updateLead, updateLeadResearch } from "../../../../../lib/store";
import { mergeDossierIntoLead, researchLead } from "../../../../../lib/leadResearch/researchLead";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function statusForError(error) {
  return error?.name === "LeadResearchNotConfigured"
    ? 503
    : error?.name === "LeadResearchBadInput"
      ? 400
      : error?.name === "LeadResearchRefused"
        ? 422
        : 502;
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const body = await request.json().catch(() => ({}));
  const leadId = String(body?.leadId || "");
  if (!leadId) return NextResponse.json({ error: "leadId is required." }, { status: 400 });

  const teamId = getSessionTeamId(session);
  const lead = await getLeadById(leadId, { teamId });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  let dossier;
  try {
    dossier = await researchLead({
      businessName: lead.businessName || lead.business,
      city: lead.city,
      address: lead.address,
      phone: lead.phone,
      website: lead.website || lead.websiteUrl,
      category: lead.category,
      knownContacts: { email: lead.email, contactName: lead.contactName }
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Research failed." }, { status: statusForError(error) });
  }

  const { metadataPatch, leadFieldUpdates, reviewFlags } = mergeDossierIntoLead({ lead, dossier });

  // Always persist the dossier + advance status; deep-merges under metadata.research.
  await updateLeadResearch(leadId, { metadata: metadataPatch, status: "researched" }, { teamId });
  // Apply only the high-confidence gap fills (empty fields). Never clobbers existing values.
  if (Object.keys(leadFieldUpdates).length) {
    await updateLead(leadId, { ...leadFieldUpdates, pipelineStatus: "researched" }, { teamId });
  }

  await logAudit({
    userId: session.user?.id,
    action: "lead.researched",
    targetType: "lead",
    targetId: leadId,
    metadata: {
      businessName: lead.businessName || lead.business || "",
      citationCount: dossier.citations.length,
      appliedFields: Object.keys(leadFieldUpdates),
      reviewFlagCount: reviewFlags.length
    }
  });

  return NextResponse.json({ dossier, leadFieldUpdates, reviewFlags });
}
