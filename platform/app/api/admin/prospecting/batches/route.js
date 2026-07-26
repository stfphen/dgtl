import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { searchGooglePlaces } from "../../../../../lib/integrations/googlePlaces";
import { buildProspectingQuery, defaultApolloRoles, mergeBatchCounts } from "../../../../../lib/prospecting";
import {
  createProspectingBatch,
  getSessionTeamId,
  requireTenantAccess,
  updateProspectingBatch
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
  const category = String(form.get("category") || "");
  const city = String(form.get("city") || "");
  const query = buildProspectingQuery({
    query: String(form.get("query") || ""),
    category,
    city
  });
  const maxResults = Number(form.get("maxResults") || 20);
  const batch = await createProspectingBatch({
    teamId,
    tenantId,
    name: String(form.get("name") || `${category || query} - ${city || "Prospecting"}`),
    query,
    category,
    city,
    provider: "google_places",
    status: "running",
    maxResults,
    enrichHunter: form.get("enrichHunter") === "on",
    enrichApollo: form.get("enrichApollo") === "on",
    targetRoles: defaultApolloRoles
  });

  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  url.searchParams.set("batchId", batch.id);

  const result = await searchGooglePlaces({ query, maxResults });
  if (!result.ok) {
    await updateProspectingBatch(batch.id, {
      status: "failed",
      counts: mergeBatchCounts(batch.counts, { failed: 1 }),
      error: result.error || result.reason
    }, { teamId });
    url.searchParams.set("notice", result.error || result.reason);
    return NextResponse.redirect(url, 303);
  }

  await updateProspectingBatch(batch.id, {
    status: "completed",
    previewResults: result.prospects,
    counts: mergeBatchCounts(batch.counts, { found: result.prospects.length }),
    error: ""
  }, { teamId });

  url.searchParams.set("notice", `Previewed ${result.prospects.length} prospects for "${query}".`);
  return NextResponse.redirect(url, 303);
}
