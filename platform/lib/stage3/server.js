import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getStage3Repository } from "./repository.js";
import { ArtifactAutomationService } from "./service.js";

export function stage3Actor(session){return{id:session?.user?.id||session?.userId||"",role:session?.role||"",email:session?.email||session?.user?.email||""};}
export function requireStage3Repository(){const repository=getStage3Repository();if(!repository)throw Object.assign(new Error("DGTL Stage 3 requires DATABASE_URL and migration 012."),{status:503});return repository;}
export function stage3Service({teamId,actor}){return new ArtifactAutomationService({teamId,actor,repository:requireStage3Repository()});}
export async function getStage3PageContext(){const session=await getAdminSession();if(!session||!canViewDashboard(session))redirect("/admin/login");const teamId=getSessionTeamId(session);if(!teamId)redirect("/admin");const repository=getStage3Repository();return{session,teamId,repository,automation:repository?new ArtifactAutomationService({teamId,actor:stage3Actor(session),repository}):null};}
