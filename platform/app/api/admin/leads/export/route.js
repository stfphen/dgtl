import { NextResponse } from "next/server";
import { ALL_ROLES, permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { filterAndSortLeads, leadsToCsv } from "../../../../../lib/leadUtils";
import { getSessionTeamId, listLeads } from "../../../../../lib/store";

export async function GET(request) {
  let session;
  try {
    session = await requireRole(ALL_ROLES);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const params = request.nextUrl.searchParams;
  const leads = filterAndSortLeads(await listLeads({ teamId: getSessionTeamId(session) }), {
    query: params.get("q"),
    city: params.get("city"),
    category: params.get("category"),
    source: params.get("source"),
    enrichmentStatus: params.get("enrichmentStatus"),
    outreachStatus: params.get("outreachStatus"),
    pipelineStatus: params.get("pipelineStatus"),
    sort: params.get("sort")
  });

  return new NextResponse(leadsToCsv(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export.csv"`
    }
  });
}
