import { requireSession } from "../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../lib/store";
import { stage4ErrorResponse } from "../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../lib/stage4/server";

export async function GET(request){try{const session=await requireSession();const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});return Response.json(await service.connectionStatus());}catch(error){return stage4ErrorResponse(error,request);}}
