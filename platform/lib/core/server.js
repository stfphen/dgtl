import { redirect } from "next/navigation";
import { canViewDashboard, isPassOnlyRole, loadSession, passHomeFor } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getCoreService } from "./service.js";

export async function getCorePageContext() {
  const session = await loadSession();
  // Pass-only staff (issuer, verifier) never enter the workspace.
  if (session && isPassOnlyRole(session.role)) redirect(passHomeFor(session));
  if (!session || !canViewDashboard(session)) redirect("/admin/login");
  const teamId = getSessionTeamId(session);
  if (!teamId) redirect("/admin");
  return { session, teamId, core: getCoreService(teamId) };
}
