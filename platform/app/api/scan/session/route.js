import { requirePassCapability } from "../../../../lib/permissions";
import { passErrorResponse, requirePassesReady } from "../../../../lib/passes/http";
import { passSettingsForTenant } from "../../../../lib/passes/settings";
import { getSessionTeamId, listTenants } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/session · pass.verify. Everything the scanner needs, nothing else.
export async function GET(request) {
  try {
    const session = await requirePassCapability("pass.verify");
    const config = requirePassesReady();
    const teamId = getSessionTeamId(session);
    const tenants = (await listTenants({ teamId })).filter((tenant) => tenant.teamId === teamId);
    const gates = [...new Set(tenants.flatMap((tenant) => passSettingsForTenant(tenant).gates))];
    return Response.json(
      {
        user: { name: session.user?.name || "", email: session.email || session.user?.email || "" },
        team: { id: teamId, name: session.team?.name || "" },
        tenants: tenants.map((tenant) => ({ id: tenant.id, name: tenant.brand?.name || tenant.name || tenant.slug })),
        gates: gates.length ? gates : ["Main door"],
        allowedHosts: config.allowedScanHosts
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
