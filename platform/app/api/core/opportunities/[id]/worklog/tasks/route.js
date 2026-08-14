import { requireCoreWrite } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { stage4ErrorResponse, redirectStage4 } from "../../../../../../../lib/stage4/api";
import { stage4Service, stage4Actor } from "../../../../../../../lib/stage4/server";

export async function POST(request,{params}){try{const session=await requireCoreWrite();const{id}=await params;const form=await request.formData();const service=stage4Service({teamId:getSessionTeamId(session),actor:stage4Actor(session)});const item={title:form.get("title"),notes:form.get("notes")||"",priority:form.get("priority")||"normal",estimateMinutes:form.get("estimateMinutes")||"",dueDate:form.get("dueDate")||"",assigneeId:form.get("assigneeId")||null,artifactId:form.get("artifactId")||""};if(!item.artifactId)delete item.artifactId;const{operation}=await service.requestTaskHandoff(id,{items:[item]});return redirectStage4(request,`/opportunities/${id}`,`Task handoff drafted (${operation.id}). Review and approve it below.`);}catch(error){return stage4ErrorResponse(error,request);}}
