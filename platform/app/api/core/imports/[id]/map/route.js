import { requireCoreWrite } from "../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../lib/store";
import { ImportService } from "../../../../../../lib/stage2/importService";
import { redirectTo, stage2ErrorResponse } from "../../../../../../lib/stage2/api";
import { requireStage2Repository, stage2Actor } from "../../../../../../lib/stage2/server";

export async function POST(request, { params }) {
  try {
    const session=await requireCoreWrite(); const teamId=getSessionTeamId(session); const {id}=await params; const form=await request.formData();
    const mapping=JSON.parse(String(form.get("mapping")||"{}"));
    const service=new ImportService({teamId,actor:stage2Actor(session),repository:requireStage2Repository()}); await service.map(id,mapping);
    return redirectTo(request,`/imports/${id}`,"Mapping applied and duplicate review refreshed.");
  } catch(error){return stage2ErrorResponse(error,request);}
}
