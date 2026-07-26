import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getLeadById, getSessionTeamId, updateLead, updateLeadResearch } from "../../../../../lib/store";
import { fillMissingLead } from "../../../../../lib/leadResearch/fillMissing";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function statusForError(error) {
  return error?.name === "LeadResearchNotConfigured"
    ? 503
    : error?.name === "FillMissingBadInput" || error?.name === "LeadResearchBadInput"
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

  let result;
  try {
    result = await fillMissingLead({ lead });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Fill failed." }, { status: statusForError(error) });
  }

  if (result.noGaps) {
    return NextResponse.json({ filled: {}, reviewFlags: [], sources: [], noGaps: true });
  }

  // Persist the research/provider metadata + advance status (deep-merges).
  await updateLeadResearch(leadId, { metadata: result.metadataPatch, status: "researched" }, { teamId });
  // Apply gap fills (empty fields only — never clobbers existing values).
  if (Object.keys(result.filled).length) {
    await updateLead(leadId, { ...result.filled, pipelineStatus: "researched" }, { teamId });
  }

  await logAudit({
    userId: session.user?.id,
    action: "lead.filled",
    targetType: "lead",
    targetId: leadId,
    metadata: {
      businessName: lead.businessName || lead.business || "",
      filledFields: Object.keys(result.filled),
      reviewFlagCount: result.reviewFlags.length,
      providers: result.sources.map((s) => `${s.provider}:${s.ok ? "ok" : "skip"}`)
    }
  });

  return NextResponse.json({ filled: result.filled, reviewFlags: result.reviewFlags, sources: result.sources });
}
