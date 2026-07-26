import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { createLead, getSessionTeamId, updateLead, updateLeadResearch } from "../../../../../lib/store";
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

// Entry point #2 — create a lead from just { businessName, city } and research it on command.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const body = await request.json().catch(() => ({}));
  const businessName = String(body?.businessName || "").trim();
  const city = String(body?.city || "").trim();
  if (!businessName) return NextResponse.json({ error: "A business name is required." }, { status: 400 });

  const teamId = getSessionTeamId(session);

  // Research first so we don't create an empty lead if research is misconfigured.
  let dossier;
  try {
    dossier = await researchLead({ businessName, city });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Research failed." }, { status: statusForError(error) });
  }

  const lead = await createLead({ businessName, city, source: "manual", teamId });

  const { metadataPatch, leadFieldUpdates, reviewFlags } = mergeDossierIntoLead({ lead, dossier });
  await updateLeadResearch(lead.id, { metadata: metadataPatch, status: "researched" }, { teamId });
  if (Object.keys(leadFieldUpdates).length) {
    await updateLead(lead.id, { ...leadFieldUpdates, pipelineStatus: "researched" }, { teamId });
  }

  await logAudit({
    userId: session.user?.id,
    action: "lead.researched",
    targetType: "lead",
    targetId: lead.id,
    metadata: {
      businessName,
      fromQuery: true,
      citationCount: dossier.citations.length,
      appliedFields: Object.keys(leadFieldUpdates),
      reviewFlagCount: reviewFlags.length
    }
  });

  return NextResponse.json({
    lead: { id: lead.id, businessName, city },
    dossier,
    leadFieldUpdates,
    reviewFlags
  });
}
