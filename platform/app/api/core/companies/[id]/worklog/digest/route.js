import { requireSession } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

export async function GET(request,{params}){try{const session=await requireSession();const{id}=await params;const{searchParams}=new URL(request.url);const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});return Response.json(await service.companyDigest(id,{from:searchParams.get("from")||"",to:searchParams.get("to")||""}));}catch(error){return stage4ErrorResponse(error,request);}}
