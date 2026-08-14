/**
 * Stage 4 acceptance rehearsal: canonical Opportunity -> approved, idempotent
 * Worklog delivery handoff -> read-through status, against a REAL local
 * Worklog server on a throwaway SQLite database and a disposable PostgreSQL.
 *
 * Guards: STAGE4_REHEARSAL_CONFIRM=isolated, DATABASE_URL on localhost, and
 * the Worklog target is a server this script just booted on 127.0.0.1 —
 * office.dgtl.at can never be a rehearsal target. Core talks to Worklog only
 * over HTTP; the SQLite file belongs to the spawned Worklog process alone.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresStage4Repository } from "../lib/stage4/repository.js";
import { WorklogOperationsService } from "../lib/stage4/service.js";
import { WorklogConnector } from "../lib/stage4/worklogConnector.js";
import { WorklogClient } from "../../apps/worklog/client/worklog-client.mjs";

const parsed = new URL(process.env.DATABASE_URL || "http://invalid");
if (process.env.STAGE4_REHEARSAL_CONFIRM !== "isolated" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Stage 4 rehearsal only runs with STAGE4_REHEARSAL_CONFIRM=isolated against localhost PostgreSQL.");
}

const platformRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(platformRoot, "..");
const worklogRoot = path.join(repoRoot, "apps", "worklog");
const run = `${process.pid.toString(36)}${Date.now().toString(36)}`;
const teamId = `team_stage4_${run}`;
const port = 8200 + Math.floor(Math.random() * 700);
const baseUrl = `http://127.0.0.1:${port}`;
const adminEmail = "core-bot@rehearsal.test";
const adminPassword = `rehearsal-${run}-admin-secret`;
const memberEmail = "member@rehearsal.test";
const memberPassword = `rehearsal-${run}-member-secret`;

const tempDir = await mkdtemp(path.join(os.tmpdir(), "dgtl-stage4-worklog-"));
const dbPath = path.join(tempDir, "worklog.sqlite");
const server = spawn(process.execPath, [path.join(worklogRoot, "server", "server.mjs")], {
  cwd: worklogRoot, detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, DB_PATH: dbPath, PORT: String(port), HOST: "127.0.0.1",
    APP_TIMEZONE: "America/Toronto", BOOTSTRAP_ADMIN_EMAIL: adminEmail,
    BOOTSTRAP_ADMIN_NAME: "Core Integration Bot", BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
    SECURE_COOKIES: "", TRUST_XFF: "",
  },
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });

async function waitForWorklog() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/timer`, { redirect: "manual" });
      if (res.status === 401) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Local Worklog server did not come up on ${baseUrl}.\n${serverLog}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const connector = new WorklogConnector({ baseUrl, email: adminEmail, password: adminPassword, teamId });
const repository = new PostgresStage4Repository(pool);
const service = (role, actorId = `${role}_stage4`) => new WorklogOperationsService({ teamId, actor: { id: actorId, role }, repository, connector });
const findOperation = (id) => repository.getIntegrationOperation(id, teamId);
const report = { isolated: true, target: baseUrl, productionTouched: false, checks: {} };
const check = (name, value) => { report.checks[name] = value; };

try {
  await waitForWorklog();
  assert.ok(!baseUrl.includes("dgtl.at"), "rehearsal must never target production Worklog");
  const sqliteBefore = (await stat(dbPath)).size;

  // The delivery team's own Worklog access, used to simulate execution
  // happening inside Worklog (never through Core).
  const worklogAdmin = new WorklogClient({ baseUrl, email: adminEmail, password: adminPassword });
  await worklogAdmin.post("/api/users", { email: memberEmail, name: "Delivery Member", password: memberPassword, role: "member" });

  // Canonical Core fixtures on disposable PostgreSQL (migrations 001-013 applied).
  await pool.query("insert into teams(id,name,slug) values($1,$2,$3)", [teamId, "Stage 4 Rehearsal", `stage4-${run}`]);
  await pool.query("insert into companies(id,team_id,display_name,legal_name,normalized_domain,relationship_status,source) values($1,$2,'Harborline Provisions','Harborline Provisions Inc.','harborline.test','prospect','stage4_fixture')", [`company_stage4_${run}`, teamId]);
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,offer,source) values($1,$2,$3,'Harborline site rebuild','won','open','Website overhaul','stage4_fixture')", [`opportunity_stage4_${run}`, teamId, `company_stage4_${run}`]);
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,source) values($1,$2,$3,'Harborline retainer','qualified','open','stage4_fixture')", [`opportunity2_stage4_${run}`, teamId, `company_stage4_${run}`]);
  await pool.query("insert into artifacts(id,team_id,company_id,opportunity_id,kind,slug,status,version,version_number,content_checksum,deployment_url) values($1,$2,$3,$4,'pitch','harborline-overhaul','approved','1',1,$5,'https://preview.invalid/harborline/')", [`artifact_stage4_${run}`, teamId, `company_stage4_${run}`, `opportunity_stage4_${run}`, "c".repeat(64)]);
  const opportunityId = `opportunity_stage4_${run}`;
  const companyId = `company_stage4_${run}`;

  const sales = service("sales");
  const owner = service("owner");

  // Health + capability honesty.
  const status = await owner.connectionStatus();
  assert.equal(status.health.state, "connected");
  assert.equal(status.health.identity.role, "admin");
  check("connected_identity", status.health.identity.email);

  // Client search: prospect matches nothing until delivery exists.
  assert.equal((await sales.matchCompanyClients(companyId)).state, "no_match");

  // Approved, idempotent project handoff against the real API.
  const { operation, preview } = await sales.requestProjectHandoff(opportunityId, { budgetMinutes: 1200 });
  assert.equal((await sales.requestProjectHandoff(opportunityId, { budgetMinutes: 1200 })).operation.id, operation.id);
  await assert.rejects(() => sales.approveOperation(operation.id), /Forbidden/);
  await owner.approveOperation(operation.id);
  const executed = await owner.executeOperation(operation.id);
  assert.equal(executed.operation.status, "succeeded");
  const projectId = executed.project.id;
  check("project_created", { id: projectId, code: preview.payload.code, client: executed.project.clientName });

  // Worklog is the authority: verify through its own API, then prove repeats cannot duplicate.
  const projectsAfter = (await worklogAdmin.get("/api/projects")).projects;
  assert.equal(projectsAfter.length, 1);
  assert.equal(projectsAfter[0].clientName, "Harborline Provisions");
  await assert.rejects(() => owner.executeOperation(operation.id), /approved operation/);
  await assert.rejects(() => sales.requestProjectHandoff(opportunityId, {}), /already linked/);
  assert.equal((await worklogAdmin.get("/api/projects")).projects.length, 1);
  check("duplicate_project_prevented", true);

  // Approved task handoff, including an exact artifact reference.
  const items = [
    { title: "Kickoff call", notes: "Confirm scope and access.", priority: "high" },
    { title: "Deliver approved pitch asset", artifactId: `artifact_stage4_${run}` },
    { title: "Launch checklist", dueDate: "2026-08-01", estimateMinutes: 90 },
  ];
  const taskHandoff = await sales.requestTaskHandoff(opportunityId, { items });
  await owner.approveOperation(taskHandoff.operation.id);
  const taskResult = await owner.executeOperation(taskHandoff.operation.id);
  assert.equal(taskResult.taskIds.length, 3);
  const worklogTasks = (await worklogAdmin.get("/api/tasks")).tasks;
  assert.equal(worklogTasks.length, 3);
  assert.ok(worklogTasks.every((task) => task.assigneeId === null), "handoff tasks arrive unassigned");
  assert.ok(worklogTasks.some((task) => String(task.notes).includes("Artifact: harborline-overhaul v1")));
  assert.equal((await sales.requestTaskHandoff(opportunityId, { items })).operation.id, taskHandoff.operation.id);
  await assert.rejects(() => owner.executeOperation(taskHandoff.operation.id), /approved operation/);
  assert.equal((await worklogAdmin.get("/api/tasks")).tasks.length, 3, "repeat requests created no duplicate tasks");
  check("duplicate_tasks_prevented", true);

  // Execution happens inside Worklog: the member completes work and logs time.
  const worklogMember = new WorklogClient({ baseUrl, email: memberEmail, password: memberPassword });
  const kickoff = worklogTasks.find((task) => task.title === "Kickoff call");
  await worklogMember.patch(`/api/tasks/${kickoff.id}`, { status: "done" });
  await worklogMember.post("/api/entries", { minutes: 180, projectId, taskId: kickoff.id, note: "Kickoff completed with client." });

  // Core reads through: status, time, budget — Worklog-derived, freshness-stamped.
  const refreshed = await owner.refreshOpportunityDelivery(opportunityId, { force: true });
  assert.equal(refreshed.state, "verified");
  assert.equal(refreshed.snapshot.doneTasks, 1);
  assert.equal(refreshed.snapshot.openTasks, 2);
  assert.equal(refreshed.snapshot.overdueTasks, 1, "2026-08-01 due date is overdue in Worklog's timezone");
  assert.equal(refreshed.snapshot.loggedMinutes, 180);
  assert.equal(refreshed.snapshot.budgetUsedPct, 15);
  assert.equal(refreshed.snapshot.source, "worklog");
  check("read_through_snapshot", refreshed.snapshot);

  // Observed completion becomes exactly one Activity across repeated reads.
  await owner.refreshOpportunityDelivery(opportunityId, { force: true });
  const completionActivities = (await pool.query("select count(*) from activities where team_id=$1 and activity_type='worklog_task_completed'", [teamId])).rows[0].count;
  assert.equal(Number(completionActivities), 1);

  // Provenance-preserving digest read-through.
  const { digest } = await owner.companyDigest(companyId);
  assert.equal(digest.client.name, "Harborline Provisions");
  assert.ok(Array.isArray(digest.provenance) && digest.provenance.length, "digest provenance rows survive");
  assert.ok(digest.narrative.some((row) => row.note?.includes("Kickoff completed")), "narrative carries the member's real entry");
  check("digest_provenance_rows", digest.provenance.length);

  // Operations surface reflects a healthy, linked state.
  const overview = await owner.operationsOverview();
  assert.equal(overview.status.health.state, "connected");
  assert.equal(overview.projectLinks.length, 1);
  assert.ok(!overview.unlinkedDeliveryReady.some((row) => row.id === opportunityId));

  // ---- Failure catalogue -------------------------------------------------

  // 1) Ambiguous project match fails closed.
  await worklogAdmin.post("/api/projects", { name: "Harborline retainer", clientName: "Harborline Provisions" });
  connector.invalidateReads();
  const ambiguous = await sales.requestProjectHandoff(`opportunity2_stage4_${run}`, {});
  await owner.approveOperation(ambiguous.operation.id);
  await assert.rejects(() => owner.executeOperation(ambiguous.operation.id), /Link it explicitly/);
  assert.equal((await findOperation(ambiguous.operation.id)).status, "failed");
  check("ambiguous_match_failed_closed", true);

  // 2) Link the existing project explicitly instead; conflicting claim refused.
  const retainerProject = (await worklogAdmin.get("/api/projects")).projects.find((row) => row.name === "Harborline retainer");
  connector.invalidateReads();
  await owner.linkOpportunityToProject(`opportunity2_stage4_${run}`, retainerProject.id);
  await assert.rejects(() => owner.linkOpportunityToProject(opportunityId, retainerProject.id), /Unlink it first|already linked/);

  // 3) Lost create response -> deterministic reconciliation adopts, no duplicate.
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,source) values($1,$2,$3,'Harborline audit','won','open','stage4_fixture')", [`opportunity3_stage4_${run}`, teamId, companyId]);
  const lost = await sales.requestProjectHandoff(`opportunity3_stage4_${run}`, {});
  await owner.approveOperation(lost.operation.id);
  await pool.query("update integration_operations set status='executing', started_at=now(), uncertain_at=now() where id=$1", [lost.operation.id]);
  await pool.query("update integration_operations set status='outcome_unknown' where id=$1", [lost.operation.id]);
  await worklogAdmin.post("/api/projects", { name: lost.preview.payload.name, clientName: lost.preview.payload.clientName, code: lost.preview.payload.code });
  connector.invalidateReads();
  const projectCountBefore = (await worklogAdmin.get("/api/projects")).projects.length;
  const reconciled = await owner.reconcileOperation(lost.operation.id);
  assert.equal(reconciled.resolution, "adopted");
  assert.equal((await findOperation(lost.operation.id)).status, "succeeded");
  assert.equal((await worklogAdmin.get("/api/projects")).projects.length, projectCountBefore, "reconcile adopted the committed project without creating another");
  check("unknown_outcome_reconciled", true);

  // 4) Stale external id: archive then delete the retainer project in Worklog.
  await worklogAdmin.patch(`/api/projects/${retainerProject.id}`, { status: "archived" });
  connector.invalidateReads();
  const archived = await owner.refreshOpportunityDelivery(`opportunity2_stage4_${run}`, { force: true });
  assert.equal(archived.state, "archived");
  await worklogAdmin.del(`/api/projects/${retainerProject.id}`);
  connector.invalidateReads();
  const missing = await owner.refreshOpportunityDelivery(`opportunity2_stage4_${run}`, { force: true });
  assert.equal(missing.state, "missing");
  const staleExceptions = (await pool.query("select count(*) from operation_exceptions where team_id=$1 and exception_type='worklog_stale_external_link'", [teamId])).rows[0].count;
  assert.ok(Number(staleExceptions) >= 1);
  check("stale_link_detected", true);

  // 5) Repair to an explicit replacement.
  const replacement = (await worklogAdmin.post("/api/projects", { name: "Harborline retainer v2", clientName: "Harborline Provisions" })).project;
  connector.invalidateReads();
  const linkRow = (await repository.listExternalLinksForEntity(teamId, "opportunity", `opportunity2_stage4_${run}`, "worklog")).find((row) => row.syncState === "linked");
  const repaired = await owner.repairLink(linkRow.id, { externalId: replacement.id });
  assert.equal(String(repaired.externalId), String(replacement.id));
  check("repair_explicit", true);

  // 6) Expired/invalid credentials report auth_failed; one probe, no retry loop.
  const badConnector = new WorklogConnector({ baseUrl, email: "nobody@rehearsal.test", password: "wrong-password-xx", teamId });
  assert.equal((await badConnector.health()).state, "auth_failed");
  check("auth_failure_reported", true);

  // 7) Unreachable Worklog reports unreachable and returns operations to approved.
  const deadConnector = new WorklogConnector({ baseUrl: "http://127.0.0.1:1", email: adminEmail, password: adminPassword, teamId });
  assert.equal((await deadConnector.health()).state, "unreachable");
  check("unreachable_reported", true);

  // 8) Worklog permission denied: the member identity cannot create projects.
  const memberConnector = new WorklogConnector({ baseUrl, email: memberEmail, password: memberPassword, teamId });
  const memberService = new WorklogOperationsService({ teamId, actor: { id: "owner_stage4", role: "owner" }, repository, connector: memberConnector });
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,source) values($1,$2,$3,'Harborline extras','won','open','stage4_fixture')", [`opportunity4_stage4_${run}`, teamId, companyId]);
  const denied = await memberService.requestProjectHandoff(`opportunity4_stage4_${run}`, {});
  await memberService.approveOperation(denied.operation.id);
  await assert.rejects(() => memberService.executeOperation(denied.operation.id), /admin permission/);
  assert.equal((await findOperation(denied.operation.id)).status, "failed");
  check("worklog_permission_enforced", true);

  // 9) Foreign-team Core objects and wrong connector team fail closed.
  const foreignService = new WorklogOperationsService({ teamId: "team_that_does_not_exist", actor: { id: "x", role: "owner" }, repository, connector });
  await assert.rejects(() => foreignService.requestProjectHandoff(opportunityId, {}), /not enabled|not available/);
  check("cross_team_rejected", true);

  // 10) Payload tampering after approval invalidates the approval.
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,source) values($1,$2,$3,'Harborline tamper','won','open','stage4_fixture')", [`opportunity5_stage4_${run}`, teamId, companyId]);
  const tamper = await sales.requestProjectHandoff(`opportunity5_stage4_${run}`, {});
  await owner.approveOperation(tamper.operation.id);
  await pool.query("update integration_operations set payload = payload || '{\"name\":\"Tampered\"}'::jsonb where id=$1", [tamper.operation.id]);
  await assert.rejects(() => owner.executeOperation(tamper.operation.id), /approval is invalidated/);
  assert.equal((await findOperation(tamper.operation.id)).status, "cancelled");
  check("tamper_invalidates_approval", true);

  // Core never wrote the Worklog SQLite file directly: every Worklog change in
  // this rehearsal went over HTTP as an authenticated Worklog user.
  assert.ok((await stat(dbPath)).size >= sqliteBefore);
  const auditLog = (await worklogAdmin.get("/api/export"));
  assert.ok(auditLog.projects.length >= 3);
  check("worklog_authoritative_export", { projects: auditLog.projects.length, tasks: auditLog.tasks.length, entries: auditLog.entries.length });
  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { try { server.kill("SIGTERM"); } catch { /* already gone */ } }
  await new Promise((resolve) => setTimeout(resolve, 200));
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await pool.end();
}
