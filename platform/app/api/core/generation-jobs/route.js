import { requireCoreWrite } from "../../../../lib/permissions";
import { getSessionTeamId } from "../../../../lib/store";
import { stage3ErrorResponse, redirectStage3 } from "../../../../lib/stage3/api";
import { requireStage3Repository, stage3Actor } from "../../../../lib/stage3/server";
import { ArtifactAutomationService } from "../../../../lib/stage3/service";

function service(session){return new ArtifactAutomationService({teamId:getSessionTeamId(session),actor:stage3Actor(session),repository:requireStage3Repository()});}
export async function GET(request){try{const session=await requireCoreWrite();return Response.json({jobs:await service(session).listJobs()});}catch(error){return stage3ErrorResponse(error,request);}}
export async function POST(request){try{const session=await requireCoreWrite();const form=await request.formData();const job=await service(session).requestGeneration({opportunityId:form.get("opportunityId"),artifactKind:form.get("artifactKind")||"pitch",adapterId:form.get("adapterId")||"pitch.pages",slug:form.get("slug"),targetContactId:form.get("targetContactId"),selectedResearchIds:form.getAll("researchId"),instructions:form.get("instructions"),intendedCta:form.get("intendedCta"),generationMode:form.get("generationMode")||"standard"});return redirectStage3(request,`/generation-jobs/${job.id}`,"Generation brief created for approval.");}catch(error){return stage3ErrorResponse(error,request);}}
