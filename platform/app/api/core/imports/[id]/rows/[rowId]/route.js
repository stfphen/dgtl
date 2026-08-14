import { requireCoreWrite } from "../../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../../lib/store";
import { ImportService } from "../../../../../../../lib/stage2/importService";
import { redirectTo, stage2ErrorResponse } from "../../../../../../../lib/stage2/api";
import { requireStage2Repository, stage2Actor } from "../../../../../../../lib/stage2/server";

export async function POST(request,{params}){
  try{const session=await requireCoreWrite();const teamId=getSessionTeamId(session);const {id,rowId}=await params;const form=await request.formData();const decision=String(form.get("decision")||"");const metadata={companyId:String(form.get("companyId")||""),contactId:String(form.get("contactId")||""),companyFields:form.getAll("companyFields"),contactFields:form.getAll("contactFields")};const service=new ImportService({teamId,actor:stage2Actor(session),repository:requireStage2Repository()});await service.reviewRow(id,rowId,decision,metadata);return redirectTo(request,`/imports/${id}`,`Row ${rowId} marked ${decision.replaceAll("_"," ")}.`);}catch(error){return stage2ErrorResponse(error,request);}
}
