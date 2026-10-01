import { requireCoreWrite } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage6ErrorResponse } from "../../../../../../../lib/stage6/api";
import { buildAssistantService, stage6Actor } from "../../../../../../../lib/stage6/server";

export async function POST(request,{params}){try{const session=await requireCoreWrite();const{id}=await params;const service=buildAssistantService({teamId:getSessionTeamId(session),actor:stage6Actor(session)});const result=await service.confirmProposal(id);return Response.json(result);}catch(error){return stage6ErrorResponse(error,request);}}
