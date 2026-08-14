import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getStage4Repository } from "./repository.js";
import { getWorklogConnector } from "./worklogConnector.js";
import { WorklogOperationsService } from "./service.js";

export function stage4Actor(session){return{id:session?.user?.id||session?.userId||"",role:session?.role||"",email:session?.email||session?.user?.email||""};}
export function requireStage4Repository(){const repository=getStage4Repository();if(!repository)throw Object.assign(new Error("DGTL Stage 4 requires DATABASE_URL and migration 013."),{status:503});return repository;}
export function stage4Service({teamId,actor}){return new WorklogOperationsService({teamId,actor,repository:requireStage4Repository(),connector:getWorklogConnector()});}
export async function getStage4PageContext(){const session=await getAdminSession();if(!session||!canViewDashboard(session))redirect("/admin/login");const teamId=getSessionTeamId(session);if(!teamId)redirect("/admin");const repository=getStage4Repository();return{session,teamId,repository,worklog:repository?new WorklogOperationsService({teamId,actor:stage4Actor(session),repository,connector:getWorklogConnector()}):null};}
