import { redirect } from "next/navigation";
import { getAdminSession } from "../auth.js";
import { canViewDashboard } from "../permissions.js";
import { getSessionTeamId } from "../store.js";
import { getStage2Repository } from "./repository.js";
import { ImportService } from "./importService.js";
import { OutreachService } from "./outreachService.js";

export function stage2Actor(session) {
  return { id: session?.user?.id || session?.userId || "", role: session?.role || "", email: session?.email || session?.user?.email || "" };
}

export function requireStage2Repository() {
  const repository = getStage2Repository();
  if (!repository) throw Object.assign(new Error("DGTL Stage 2 writes require DATABASE_URL and migrations 009/010."), { status: 503 });
  return repository;
}

export async function getStage2PageContext() {
  const session = await getAdminSession();
  if (!session || !canViewDashboard(session)) redirect("/admin/login");
  const teamId = getSessionTeamId(session);
  if (!teamId) redirect("/admin");
  const repository = getStage2Repository();
  return {
    session, teamId, repository,
    imports: repository ? new ImportService({ teamId, actor: stage2Actor(session), repository }) : null,
    outreach: repository ? new OutreachService({ teamId, actor: stage2Actor(session), repository }) : null
  };
}
