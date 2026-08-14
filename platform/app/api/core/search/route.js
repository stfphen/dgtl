import { requireSession, permissionDeniedResponse } from "../../../../lib/permissions";
import { getSessionTeamId } from "../../../../lib/store";
import { stage5Service, stage5Actor } from "../../../../lib/stage5/server";

export async function GET(request){try{const session=await requireSession();const{searchParams}=new URL(request.url);const service=stage5Service({teamId:getSessionTeamId(session),actor:stage5Actor(session)});return Response.json(await service.search(searchParams.get("q")||""));}catch(error){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Search failed."},{status:Number(error?.status)||400});}}}
