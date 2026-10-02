import { requirePassCapability } from "../../../../../lib/permissions";
import { passErrorResponse, requirePassesReady } from "../../../../../lib/passes/http";
import { getPassForTeam, passLinks, PassError } from "../../../../../lib/passes/store";
import { getSessionTeamId } from "../../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/passes/detail?passId= · pass.view. Carries the pass link
// (the credential): never cache it, never log it.
export async function GET(request) {
  try {
    const session = await requirePassCapability("pass.view");
    const config = requirePassesReady({ issuing: true });
    const passId = new URL(request.url).searchParams.get("passId") || "";
    const pass = await getPassForTeam({ teamId: getSessionTeamId(session), passId });
    if (!pass) throw new PassError("pass_not_found", "Pass not found.", 404, "passId");
    const links = passLinks(pass, config);
    return Response.json(
      {
        pass: { id: pass.id, status: pass.status, walletProvider: pass.walletProvider, walletIssuedAt: pass.walletIssuedAt, walletError: pass.walletError },
        links: { passPageUrl: links.passPageUrl, walletUrl: config.walletEnabled ? links.walletUrl : null }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
