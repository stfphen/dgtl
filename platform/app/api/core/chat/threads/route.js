import { requireSession } from "../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../lib/store";
import { stage6ErrorResponse } from "../../../../../lib/stage6/api";
import { buildAssistantService, stage6Actor } from "../../../../../lib/stage6/server";

export async function GET(request){try{const session=await requireSession();const service=buildAssistantService({teamId:getSessionTeamId(session),actor:stage6Actor(session)});return Response.json({threads:await service.listThreads()});}catch(error){return stage6ErrorResponse(error,request);}}
export async function POST(request){try{const session=await requireSession();const body=await request.json().catch(()=>({}));const service=buildAssistantService({teamId:getSessionTeamId(session),actor:stage6Actor(session)});const thread=await service.createThread({title:String(body?.title||"")});return Response.json({thread});}catch(error){return stage6ErrorResponse(error,request);}}
