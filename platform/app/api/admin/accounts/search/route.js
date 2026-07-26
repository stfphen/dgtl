import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { sourceAccountPreviews } from "../../../../../lib/enterpriseProspecting/index.js";

// Real provider/open-DB calls can be slow; allow extra time + dynamic.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST: preview-source accounts and score fit. No persistence (this is the
// pre-Gate-1 triage step). Body: { query, segment }.
// Real sourcing = SEC EDGAR + OpenCorporates + Google Places, with graceful
// degradation to offline demo data when nothing is configured/returned.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  // session intentionally unused beyond auth; preview is read-only/no team writes.
  void session;

  const body = await request.json().catch(() => ({}));
  const query = String(body?.query || "");
  const segment = String(body?.segment || "");

  const { results, sources, usedFallback } = await sourceAccountPreviews({ query, segment });
  const liveCounts = sources
    .filter((s) => s.ok && s.count)
    .map((s) => `${s.provider}: ${s.count}`)
    .join(", ");
  const note = usedFallback
    ? "No live results — showing offline demo accounts. Configure SEC_EDGAR (no key), OPENCORPORATES_API_TOKEN, GOOGLE_PLACES_API_KEY, or try a company name."
    : `Live results from ${liveCounts || "configured providers"}.`;

  return NextResponse.json({ results, sources, usedFallback, note });
}
