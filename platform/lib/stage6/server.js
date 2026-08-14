import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getStage6Repository } from "./repository.js";
import { getChatAdapter } from "./modelAdapter.js";
import { getWorklogConnector } from "../stage4/worklogConnector.js";
import { WorklogOperationsService } from "../stage4/service.js";
import { HomeService } from "../stage5/homeService.js";
import { AssistantService } from "./assistantService.js";

export function stage6Actor(session){return{id:session?.user?.id||session?.userId||"",role:session?.role||"",email:session?.email||session?.user?.email||""};}
export function requireStage6Repository(){const repository=getStage6Repository();if(!repository)throw Object.assign(new Error("DGTL.chat requires DATABASE_URL and migration 014."),{status:503});return repository;}
export function buildAssistantService({teamId,actor,repository=requireStage6Repository(),adapter=getChatAdapter()}){const connector=getWorklogConnector();const services={home:new HomeService({teamId,actor,repository,worklogConnector:connector}),worklog:new WorklogOperationsService({teamId,actor,repository,connector})};return new AssistantService({teamId,actor,repository,adapter,services});}
export async function getStage6PageContext(){const session=await getAdminSession();if(!session||!canViewDashboard(session))redirect("/admin/login");const teamId=getSessionTeamId(session);if(!teamId)redirect("/admin");const repository=getStage6Repository();return{session,teamId,repository,assistant:repository?buildAssistantService({teamId,actor:stage6Actor(session),repository}):null};}
