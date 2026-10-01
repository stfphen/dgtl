import { requireCoreWrite } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

const backPath=(link)=>link.localEntityType==="company"?`/companies/${link.localEntityId}`:link.localEntityType==="opportunity"?`/opportunities/${link.localEntityId}`:"/operations/worklog";
export async function POST(request,{params}){try{const session=await requireCoreWrite();const{id}=await params;const form=await request.formData();const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const link=await service.repairLink(id,{externalId:form.get("externalId")});return redirectStage4(request,backPath(link),"Worklog link repaired to the named replacement.");}catch(error){return stage4ErrorResponse(error,request);}}
