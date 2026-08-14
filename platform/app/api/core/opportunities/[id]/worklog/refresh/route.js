import { requireSession } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

export async function POST(request,{params}){try{const session=await requireSession();const{id}=await params;const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const{state}=await service.refreshOpportunityDelivery(id,{force:true});return redirectStage4(request,`/opportunities/${id}`,state==="verified"?"Worklog status refreshed.":`Worklog status refreshed — project is ${state}.`);}catch(error){return stage4ErrorResponse(error,request);}}
