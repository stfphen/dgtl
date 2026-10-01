import { requireCoreWrite } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

export async function POST(request,{params}){try{const session=await requireCoreWrite();const{id}=await params;const form=await request.formData();const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const{operation}=await service.requestProjectHandoff(id,{name:form.get("name")||"",clientName:form.get("clientName")||"",billable:form.get("billable")!=="false",budgetMinutes:form.get("budgetMinutes")||""});return redirectStage4(request,`/opportunities/${id}`,`Delivery-project handoff drafted (${operation.id}). Review and approve it below.`);}catch(error){return stage4ErrorResponse(error,request);}}
