import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import {
  buildGoogleImportNotice,
  isAutoEnrichEnabled,
  maybeAutoEnrichGoogleLead
} from "../../../../../lib/enrichment/googleAutoEnrich.js";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { searchGooglePlaces } from "../../../../../lib/integrations/googlePlaces";
import {
  createLead,
  getSessionTeamId,
  requireTenantAccess,
  updateLeadResearch
} from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const tenantId = String(form.get("tenantId") || "");
  const teamId = getSessionTeamId(session);
  try {
    await requireTenantAccess(teamId, tenantId);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const query = String(form.get("query") || "");
  const autoEnrich = isAutoEnrichEnabled(form.get("autoEnrich"));
  const result = await searchGooglePlaces({ query });

  let enrichedCount = 0;
  let attemptedCount = 0;
  if (result.ok) {
    for (const prospect of result.prospects) {
      const lead = await createLead({
        ...prospect,
        teamId,
        tenantId,
        status: "researched"
      });
      if (!lead.skippedDuplicate) {
        await logAudit({
          userId: session.user?.id,
          action: "lead.imported",
          targetType: "lead",
          targetId: lead.id,
          metadata: {
            teamId,
            tenantId,
            provider: "google_places",
            query,
            businessName: lead.businessName
          }
        });

        const autoEnrichResult = await maybeAutoEnrichGoogleLead({
          autoEnrich,
          lead,
          attemptedCount,
          updateLeadResearchImpl: updateLeadResearch
        });

        if (autoEnrichResult.attempted) attemptedCount += 1;
        if (autoEnrichResult.enriched) enrichedCount += 1;
      }
    }
  }

  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (!result.ok) url.searchParams.set("notice", result.reason);
  if (result.ok) {
    url.searchParams.set(
      "notice",
      buildGoogleImportNotice({
        importedCount: result.prospects.length,
        enrichedCount
      })
    );
  }
  return NextResponse.redirect(url, 303);
}
