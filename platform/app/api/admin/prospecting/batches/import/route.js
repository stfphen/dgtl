import { NextResponse } from "next/server";
import { logAudit } from "../../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../../lib/permissions";
import { lookupHunterDomain } from "../../../../../../lib/integrations/hunter";
import { searchApolloPeople } from "../../../../../../lib/integrations/apollo";
import { mergeBatchCounts, selectedPreviewResults } from "../../../../../../lib/prospecting";
import { scoreLead } from "../../../../../../lib/leadUtils";
import {
  createLead,
  getSessionTeamId,
  getProspectingBatch,
  updateLead,
  updateProspectingBatch
} from "../../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const form = await request.formData();
  const batchId = String(form.get("batchId") || "");
  const batch = await getProspectingBatch(batchId, { teamId });
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  url.searchParams.set("batchId", batchId);

  if (!batch) {
    url.searchParams.set("notice", "Prospecting batch was not found.");
    return NextResponse.redirect(url, 303);
  }

  const selectedIndexes = form.getAll("selected").map((value) => Number(value));
  const selectedProspects = selectedPreviewResults(batch, selectedIndexes);
  let imported = 0;
  let skippedDuplicates = 0;
  let enriched = 0;
  let failed = 0;

  for (const prospect of selectedProspects) {
    const lead = await createLead({
      ...prospect,
      teamId,
      tenantId: batch.tenantId,
      batchId: batch.id,
      category: prospect.category || batch.category,
      city: prospect.city || batch.city,
      pipelineStatus: "researched",
      sourceMetadata: {
        ...(prospect.sourceMetadata || prospect.metadata || {}),
        batchId: batch.id,
        batchName: batch.name
      }
    });

    if (lead.skippedDuplicate) {
      skippedDuplicates += 1;
      continue;
    }

    imported += 1;
    await logAudit({
      userId: session.user?.id,
      action: "lead.imported",
      targetType: "lead",
      targetId: lead.id,
      metadata: {
        teamId,
        tenantId: batch.tenantId,
        provider: batch.provider,
        batchId: batch.id,
        businessName: lead.businessName
      }
    });
    const enrichment = await enrichLeadFromBatch({ lead, batch });
    if (enrichment.enriched) enriched += 1;
    if (enrichment.failed) failed += 1;
  }

  const counts = mergeBatchCounts(batch.counts, {
    imported: Number(batch.counts.imported || 0) + imported,
    skippedDuplicates: Number(batch.counts.skippedDuplicates || 0) + skippedDuplicates,
    enriched: Number(batch.counts.enriched || 0) + enriched,
    failed: Number(batch.counts.failed || 0) + failed
  });

  await updateProspectingBatch(batch.id, { status: "completed", counts }, { teamId });
  url.searchParams.set(
    "notice",
    `Imported ${imported} leads. Skipped ${skippedDuplicates} duplicates. Enriched ${enriched}. Failed ${failed}.`
  );
  return NextResponse.redirect(url, 303);
}

async function enrichLeadFromBatch({ lead, batch }) {
  if (!lead.domain) return { enriched: false, failed: false };

  const sourceMetadata = {
    ...(lead.sourceMetadata || lead.metadata || {}),
    enrichments: {
      ...((lead.sourceMetadata || lead.metadata || {}).enrichments || {})
    }
  };
  let enriched = false;
  let failed = false;

  if (batch.enrichHunter) {
    const hunter = await lookupHunterDomain(lead.domain);
    sourceMetadata.enrichments.hunter = {
      ok: hunter.ok,
      configured: hunter.configured,
      contacts: hunter.contacts || [],
      error: hunter.error || ""
    };
    if (hunter.ok && hunter.contacts?.length) enriched = true;
    if (!hunter.ok && hunter.configured) failed = true;
  }

  if (batch.enrichApollo) {
    const apollo = await searchApolloPeople({ domain: lead.domain, titles: batch.targetRoles });
    sourceMetadata.enrichments.apollo = {
      ok: apollo.ok,
      configured: apollo.configured,
      people: apollo.contacts || [],
      contactDataPartial: true,
      error: apollo.error || ""
    };
    if (apollo.ok && apollo.contacts?.length) enriched = true;
    if (!apollo.ok && apollo.configured) failed = true;
  }

  if (!batch.enrichHunter && !batch.enrichApollo) return { enriched: false, failed };

  const enrichmentStatus = enriched ? "enriched" : failed ? "failed" : "pending";
  const scored = scoreLead({ ...lead, sourceMetadata, enrichmentStatus });
  await updateLead(lead.id, {
    sourceMetadata,
    enrichmentStatus,
    leadScore: scored.score,
    leadScoreReason: scored.reason
  }, { teamId: lead.teamId });

  return { enriched, failed };
}
