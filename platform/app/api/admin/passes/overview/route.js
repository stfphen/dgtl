import { requirePassCapability } from "../../../../../lib/permissions";
import { passErrorResponse, requirePassesReady, tenantForSession } from "../../../../../lib/passes/http";
import { businessDayStart } from "../../../../../lib/passes/settings";
import { passesOverview } from "../../../../../lib/passes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/passes/overview?tenantId= · pass.view. "Today" is the
// tenant's business day (timezone + cutoff), not UTC.
export async function GET(request) {
  try {
    const session = await requirePassCapability("pass.view");
    requirePassesReady();
    const { teamId, tenant, settings } = await tenantForSession(session, new URL(request.url).searchParams.get("tenantId"));
    const overview = await passesOverview({ teamId, tenantId: tenant.id, dayStart: businessDayStart(new Date(), settings) });
    return Response.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
