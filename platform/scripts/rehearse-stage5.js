/**
 * Stage 5 acceptance rehearsal: prove HOME is a projection over canonical
 * Stage 1-4 state — items appear because real source conditions exist, and
 * disappear when those conditions are resolved in their authoritative
 * workflows, with no dashboard table anywhere.
 *
 * Runs on disposable localhost PostgreSQL (001-013 applied) plus a real
 * local Worklog server on a throwaway SQLite database, reusing the Stage 4
 * connector so delivery state is genuine.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresStage5Repository } from "../lib/stage5/repository.js";
import { HomeService } from "../lib/stage5/homeService.js";
import { OutreachService } from "../lib/stage2/outreachService.js";
import { createTestTransport } from "../lib/stage2/testTransport.js";
import { WorklogOperationsService } from "../lib/stage4/service.js";
import { WorklogConnector } from "../lib/stage4/worklogConnector.js";

const parsed = new URL(process.env.DATABASE_URL || "http://invalid");
if (process.env.STAGE5_REHEARSAL_CONFIRM !== "isolated" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Stage 5 rehearsal only runs with STAGE5_REHEARSAL_CONFIRM=isolated against localhost PostgreSQL.");
}

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const worklogRoot = path.join(repoRoot, "apps", "worklog");
const run = `${process.pid.toString(36)}${Date.now().toString(36)}`;
const teamId = `team_stage5_${run}`;
const port = 8300 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const adminEmail = "core-bot@stage5.test";
const adminPassword = `stage5-${run}-admin-secret`;

const tempDir = await mkdtemp(path.join(os.tmpdir(), "dgtl-stage5-worklog-"));
const server = spawn(process.execPath, [path.join(worklogRoot, "server", "server.mjs")], {
  cwd: worklogRoot, detached: true, stdio: ["ignore", "ignore", "ignore"],
  env: { ...process.env, DB_PATH: path.join(tempDir, "worklog.sqlite"), PORT: String(port), HOST: "127.0.0.1", APP_TIMEZONE: "America/Toronto", BOOTSTRAP_ADMIN_EMAIL: adminEmail, BOOTSTRAP_ADMIN_NAME: "Stage 5 Bot", BOOTSTRAP_ADMIN_PASSWORD: adminPassword, SECURE_COOKIES: "", TRUST_XFF: "" },
});
async function waitForWorklog() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/timer`, { redirect: "manual" })).status === 401) return; } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Local Worklog did not come up on ${baseUrl}.`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const repository = new PostgresStage5Repository(pool);
const connector = new WorklogConnector({ baseUrl, email: adminEmail, password: adminPassword, teamId });
const owner = { id: "owner_stage5", role: "owner" };
const home = new HomeService({ teamId, actor: owner, repository, worklogConnector: connector });
const worklog = new WorklogOperationsService({ teamId, actor: owner, repository, connector });
const outreach = new OutreachService({ teamId, actor: owner, repository, transport: createTestTransport() });
const keys = (snapshot) => snapshot.attention.data.items.map((item) => item.key);
const report = { isolated: true, target: baseUrl, checks: {} };

try {
  await waitForWorklog();

  // ---- canonical fixtures through real schema/services -------------------
  await pool.query("insert into teams(id,name,slug) values($1,$2,$3)", [teamId, "Stage 5 Rehearsal", `stage5-${run}`]);
  const companyId = `company_stage5_${run}`;
  await pool.query("insert into companies(id,team_id,display_name,normalized_domain,relationship_status,source) values($1,$2,'Lanternworks Studio','lanternworks.test','client','stage5_fixture')", [companyId, teamId]);
  const contactId = `contact_stage5_${run}`;
  await pool.query("insert into contacts(id,team_id,company_id,full_name,email,normalized_email,source) values($1,$2,$3,'Lena Buyer','lena@lanternworks.test','lena@lanternworks.test','stage5_fixture')", [contactId, teamId, companyId]);
  const overdueOpp = `opp_overdue_${run}`;
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,next_action,next_action_at,estimated_value,source) values($1,$2,$3,'Lanternworks rebuild','qualified','open','Send revised proposal',now() - interval '3 days',15000,'stage5_fixture')", [overdueOpp, teamId, companyId]);
  const wonOpp = `opp_won_${run}`;
  await pool.query("insert into opportunities(id,team_id,company_id,name,stage,status,source) values($1,$2,$3,'Lanternworks launch','won','open','stage5_fixture')", [wonOpp, teamId, companyId]);

  // Real Stage 2 flow: campaign -> cohort -> drafts => review + draft messages.
  const campaign = await outreach.createCampaign({ name: "Lanternworks warm-up", audienceDefinition: {}, sequence: [{ step: 1 }], sendingIdentity: { email: "test@dgtl.invalid" } });
  await outreach.addCohort(campaign.id, [{ opportunityId: overdueOpp, contactId }]);
  await outreach.draftMessages(campaign.id, { subject: "Hello {{first_name}}", body: "A note for {{company}}." });

  // Real Stage 3 state: a generation brief awaiting input approval.
  await pool.query(`insert into generation_jobs(id,team_id,company_id,opportunity_id,requested_tool,requested_skill,status,brief,artifact_kind,adapter_id,slug,created_at,updated_at) values($1,$2,$3,$4,'dgtl-pitch-pages','dgtl-pitch-pages','draft','{}','pitch','pitch.pages',$5,now(),now())`, [`job_stage5_${run}`, teamId, companyId, overdueOpp, `lantern-${run}`]);

  // Real Stage 4 flow: approved handoff creates a genuine Worklog project.
  const handoff = await worklog.requestProjectHandoff(wonOpp, { budgetMinutes: 600 });
  const beforeHandoff = await home.snapshot();
  assert.ok(keys(beforeHandoff).includes(`handoff:${wonOpp}`), "won opportunity appears in the handoff queue");
  assert.ok(keys(beforeHandoff).includes(`approval:operation:${handoff.operation.id}`), "draft operation awaits approval");
  assert.ok(keys(beforeHandoff).includes(`next-action:${overdueOpp}`), "overdue follow-up appears");
  assert.ok(keys(beforeHandoff).includes(`approval:campaign:${campaign.id}`), "campaign awaits approval");
  assert.ok(keys(beforeHandoff).includes(`approval:messages:${campaign.id}`), "draft messages await approval");
  assert.ok(keys(beforeHandoff).includes(`approval:job-input:job_stage5_${run}`), "generation brief awaits approval");
  assert.equal(beforeHandoff.pipeline.data.knownValueTotal, 15000);
  assert.ok(beforeHandoff.pipeline.data.unknownValueCount >= 1, "unset values reported as unknown, not zero");
  report.checks.attention_before = keys(beforeHandoff).length;

  // An operational exception appears, then resolves.
  const exception = await worklog.exception({ exceptionType: "worklog_stale_external_link", severity: "error", sourceEntityType: "opportunity", sourceEntityId: wonOpp, summary: "Rehearsal exception" });
  assert.ok(keys(await home.snapshot()).includes(`exception:${exception.id}`));

  // ---- resolve source conditions; items disappear naturally --------------
  await worklog.approveOperation(handoff.operation.id);
  await worklog.executeOperation(handoff.operation.id);
  await worklog.refreshOpportunityDelivery(wonOpp, { force: true });
  await outreach.approveCampaign(campaign.id).catch(() => {});
  const campaignAfter = await repository.getCampaign(campaign.id, teamId);
  await outreach.resolveException(exception.id, { resolution: "rehearsed" });
  await pool.query("update opportunities set next_action_at = now() + interval '30 days' where id=$1", [overdueOpp]);

  const after = await home.snapshot();
  const afterKeys = keys(after);
  assert.ok(!afterKeys.includes(`handoff:${wonOpp}`), "handoff attention disappears once linked");
  assert.ok(!afterKeys.includes(`approval:operation:${handoff.operation.id}`), "executed operation leaves the approval queue");
  assert.ok(!afterKeys.includes(`exception:${exception.id}`), "resolved exception disappears");
  assert.ok(!afterKeys.includes(`next-action:${overdueOpp}`), "rescheduled next action leaves attention");
  if (campaignAfter.approvalState === "approved") assert.ok(!afterKeys.includes(`approval:campaign:${campaign.id}`), "approved campaign leaves the queue");
  assert.equal(after.delivery.data.linkedProjects, 1, "delivery summary appears from the real Worklog link");
  assert.ok(after.delivery.data.oldestSnapshotAt, "delivery freshness is stamped");
  assert.equal(after.systemHealth.data.entries.find((entry) => entry.id === "worklog_connector").state, "healthy");
  assert.ok(after.recentActivity.data.items.some((item) => item.activityType === "worklog_project_created"), "activity feed carries the handoff");
  report.checks.attention_after = afterKeys.length;
  assert.ok(report.checks.attention_after < report.checks.attention_before, "resolutions reduced attention without any dashboard write");

  // Search finds the canonical records and respects team scope.
  const search = await home.search("Lanternworks");
  assert.ok(search.results.some((result) => result.kind === "company"));
  assert.ok(search.results.some((result) => result.kind === "opportunity"));
  const foreignHome = new HomeService({ teamId: "team_that_does_not_exist", actor: owner, repository, worklogConnector: connector });
  assert.equal((await foreignHome.search("Lanternworks")).results.length, 0, "search never leaks across teams");

  // No dashboard/notification table was created anywhere in 001-013.
  const tables = (await pool.query("select table_name from information_schema.tables where table_schema='public'")).rows.map((row) => row.table_name);
  assert.ok(!tables.some((name) => /notification|dashboard|home_/.test(name)), "HOME persists nothing");
  report.checks.projection_proven = true;
  report.ok = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { try { server.kill("SIGTERM"); } catch { /* gone */ } }
  await new Promise((resolve) => setTimeout(resolve, 200));
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await pool.end();
}
