import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getStage5Repository } from "./repository.js";
import { getWorklogConnector } from "../stage4/worklogConnector.js";
import { HomeService } from "./homeService.js";

export function stage5Actor(session){return{id:session?.user?.id||session?.userId||"",role:session?.role||"",email:session?.email||session?.user?.email||""};}
export function requireStage5Repository(){const repository=getStage5Repository();if(!repository)throw Object.assign(new Error("DGTL HOME requires DATABASE_URL and migrations 001-013."),{status:503});return repository;}
export function stage5Service({teamId,actor}){return new HomeService({teamId,actor,repository:requireStage5Repository(),worklogConnector:getWorklogConnector()});}
export async function getStage5PageContext(){const session=await getAdminSession();if(!session||!canViewDashboard(session))redirect("/admin/login");const teamId=getSessionTeamId(session);if(!teamId)redirect("/admin");const repository=getStage5Repository();return{session,teamId,repository,home:repository?new HomeService({teamId,actor:stage5Actor(session),repository,worklogConnector:getWorklogConnector()}):null};}
