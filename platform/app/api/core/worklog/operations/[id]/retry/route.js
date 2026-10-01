import { requireCoreApproval } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

export async function POST(request,{params}){try{const session=await requireCoreApproval();const{id}=await params;const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const operation=await service.retryOperation(id);return redirectStage4(request,operation.localEntityType==="opportunity"?`/opportunities/${operation.localEntityId}`:"/operations/worklog","Failed operation returned to approved for an explicit re-run.");}catch(error){return stage4ErrorResponse(error,request);}}
