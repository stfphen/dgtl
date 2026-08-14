import { requireSession } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage6ErrorResponse } from "../../../../../../../lib/stage6/api";
import { buildAssistantService, stage6Actor } from "../../../../../../../lib/stage6/server";

export const maxDuration = 120;
export async function POST(request,{params}){try{const session=await requireSession();const{id}=await params;const body=await request.json().catch(()=>({}));const service=buildAssistantService({teamId:getSessionTeamId(session),actor:stage6Actor(session)});const result=await service.handleTurn({threadId:id,userMessage:String(body?.message||"")});return Response.json(result);}catch(error){return stage6ErrorResponse(error,request);}}
