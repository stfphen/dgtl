import { requireCoreApproval } from "../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../lib/store";
import { ImportService } from "../../../../../../lib/stage2/importService";
import { redirectTo, stage2ErrorResponse } from "../../../../../../lib/stage2/api";
import { requireStage2Repository, stage2Actor } from "../../../../../../lib/stage2/server";
export async function POST(request,{params}){try{const session=await requireCoreApproval();const teamId=getSessionTeamId(session);const {id}=await params;const service=new ImportService({teamId,actor:stage2Actor(session),repository:requireStage2Repository()});const batch=await service.apply(id);return redirectTo(request,`/imports/${id}`,`Approved import applied ${batch.appliedRows} rows.`);}catch(error){return stage2ErrorResponse(error,request);}}
