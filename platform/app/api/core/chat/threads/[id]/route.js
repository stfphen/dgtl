import { requireSession } from "../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../lib/store";
import { stage6ErrorResponse } from "../../../../../../lib/stage6/api";
import { buildAssistantService, stage6Actor } from "../../../../../../lib/stage6/server";

export async function GET(request,{params}){try{const session=await requireSession();const{id}=await params;const service=buildAssistantService({teamId:getSessionTeamId(session),actor:stage6Actor(session)});return Response.json(await service.getThread(id));}catch(error){return stage6ErrorResponse(error,request);}}
