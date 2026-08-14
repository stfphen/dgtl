import { requireSession } from "../../../../lib/permissions";
import { getSessionTeamId } from "../../../../lib/store";
import { OutreachService } from "../../../../lib/stage2/outreachService";
import { stage2ErrorResponse } from "../../../../lib/stage2/api";
import { requireStage2Repository, stage2Actor } from "../../../../lib/stage2/server";
import { productionTransportStatus } from "../../../../lib/stage2/transport";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await requireSession();
    const teamId = getSessionTeamId(session);
    const service = new OutreachService({ teamId, actor: stage2Actor(session), repository: requireStage2Repository() });
    const health = await service.getHealth();
    const transport = productionTransportStatus();
    return Response.json({
      ...health,
      providerAdapterMode: transport.mode,
      productionTransportEnabled: transport.production && transport.authorized,
      productionSafetyGates: {
        enabled: transport.enabled,
        releaseIdConfigured: transport.releaseIdConfigured,
        authorizationMatches: transport.authorizationMatches,
        ratePolicyApproved: transport.ratePolicyApproved
      }
    });
  } catch (error) { return stage2ErrorResponse(error, request); }
}
