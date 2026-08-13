import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getCoreService } from "./service.js";

export async function getCorePageContext() {
  const session = await getAdminSession();
  if (!session || !canViewDashboard(session)) redirect("/admin/login");
  const teamId = getSessionTeamId(session);
  if (!teamId) redirect("/admin");
  return { session, teamId, core: getCoreService(teamId) };
}
