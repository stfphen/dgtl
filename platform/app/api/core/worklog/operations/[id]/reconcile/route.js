import { requireCoreApproval } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

const notices={adopted:"Reconciled: Worklog holds the result; it was adopted without a duplicate.",adopted_pending_finalize:"Reconciled: every task was found; execute again to finalize without duplicates.",partial:"Reconciled: some items exist in Worklog and were recorded; execute again to resume safely.",absent:"Reconciled: Worklog holds no result. The operation is approved again for an explicit re-run."};
export async function POST(request,{params}){try{const session=await requireCoreApproval();const{id}=await params;const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const result=await service.reconcileOperation(id);const operation=result.operation;return redirectStage4(request,operation?.localEntityType==="opportunity"?`/opportunities/${operation.localEntityId}`:"/operations/worklog",notices[result.resolution]||"Reconciliation finished.");}catch(error){return stage4ErrorResponse(error,request);}}
