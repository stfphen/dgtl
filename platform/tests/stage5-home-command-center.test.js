import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStage5Repository } from "../lib/stage5/memoryRepository.js";
import { HomeService } from "../lib/stage5/homeService.js";
import { WorklogConnector } from "../lib/stage4/worklogConnector.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const NOW = () => new Date("2026-08-14T12:00:00.000Z");

function seed() {
  return {
    companies: [
      { id: "company_a", teamId: "team_a", displayName: "Ashcombe Provisions", legalName: "Ashcombe Provisions Inc.", normalizedDomain: "ashcombe.test", relationshipStatus: "client", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "company_b", teamId: "team_b", displayName: "Foreign Widgets", normalizedDomain: "foreign.test" },
    ],
    contacts: [
      { id: "contact_a", teamId: "team_a", companyId: "company_a", fullName: "Ada Buyer", email: "ada@ashcombe.test", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "contact_b", teamId: "team_b", companyId: "company_b", fullName: "Ada Foreign", email: "ada@foreign.test" },
    ],
    opportunities: [
      { id: "opp_overdue", teamId: "team_a", companyId: "company_a", name: "Ashcombe rebuild", stage: "qualified", status: "open", nextAction: "Send revised proposal", nextActionAt: "2026-08-10T09:00:00.000Z", estimatedValue: 12000, updatedAt: "2026-08-12T00:00:00.000Z" },
      { id: "opp_today", teamId: "team_a", companyId: "company_a", name: "Ashcombe retainer", stage: "contacted", status: "open", nextAction: "Follow-up call", nextActionAt: "2026-08-14T15:00:00.000Z", estimatedValue: null, updatedAt: "2026-08-13T00:00:00.000Z" },
      { id: "opp_won", teamId: "team_a", companyId: "company_a", name: "Ashcombe audit", stage: "won", status: "open", estimatedValue: 4000, updatedAt: "2026-08-13T12:00:00.000Z" },
      { id: "opp_linked", teamId: "team_a", companyId: "company_a", name: "Ashcombe delivery", stage: "delivery", status: "open", updatedAt: "2026-08-11T00:00:00.000Z" },
      { id: "opp_closed", teamId: "team_a", companyId: "company_a", name: "Closed deal", stage: "lost", status: "closed", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "opp_foreign", teamId: "team_b", companyId: "company_b", name: "Foreign deal", stage: "won", status: "open", nextActionAt: "2026-08-01T00:00:00.000Z" },
    ],
    campaigns: [
      { id: "campaign_review", teamId: "team_a", name: "Ashcombe outreach", status: "review", approvalState: "review", updatedAt: "2026-08-13T10:00:00.000Z" },
      { id: "campaign_live", teamId: "team_a", name: "Live campaign", status: "approved", approvalState: "approved", updatedAt: "2026-08-12T00:00:00.000Z" },
      { id: "campaign_foreign", teamId: "team_b", name: "Foreign campaign", status: "review", approvalState: "review" },
    ],
    messages: [
      { id: "message_draft", teamId: "team_a", campaignId: "campaign_review", status: "draft", queueState: "not_queued", createdAt: "2026-08-13T10:05:00.000Z" },
      { id: "message_sent", teamId: "team_a", campaignId: "campaign_live", status: "sent", queueState: "sent", createdAt: "2026-08-12T01:00:00.000Z" },
      { id: "message_dead", teamId: "team_a", campaignId: "campaign_live", status: "failed", queueState: "dead_letter", createdAt: "2026-08-12T02:00:00.000Z" },
      { id: "message_foreign", teamId: "team_b", campaignId: "campaign_foreign", status: "draft", queueState: "not_queued" },
    ],
    importBatches: [
      { id: "import_review", teamId: "team_a", filename: "prospects.csv", status: "review", updatedAt: "2026-08-13T09:00:00.000Z" },
      { id: "import_failed", teamId: "team_a", filename: "broken.csv", status: "failed", updatedAt: "2026-08-12T09:00:00.000Z" },
    ],
    generationJobs: [
      { id: "job_review", teamId: "team_a", slug: "ashcombe-pitch", requestedSkill: "dgtl-pitch-pages", status: "awaiting_review", resultSubmittedAt: "2026-08-13T11:00:00.000Z", updatedAt: "2026-08-13T11:00:00.000Z", createdAt: "2026-08-13T08:00:00.000Z" },
      { id: "job_failed", teamId: "team_a", slug: "failed-pitch", status: "validation_failed", completedAt: "2026-08-12T11:00:00.000Z", updatedAt: "2026-08-12T11:00:00.000Z", createdAt: "2026-08-12T08:00:00.000Z" },
      { id: "job_running", teamId: "team_a", slug: "running-pitch", status: "running", createdAt: "2026-08-14T08:00:00.000Z", updatedAt: "2026-08-14T08:00:00.000Z" },
    ],
    assets: [
      { id: "artifact_a", teamId: "team_a", slug: "ashcombe-pitch", kind: "pitch", status: "approved", versionNumber: 1, createdAt: "2026-08-12T00:00:00.000Z" },
    ],
    artifactDeployments: [
      { id: "deployment_unknown", teamId: "team_a", artifactId: "artifact_a", status: "outcome_unknown", uncertainAt: "2026-08-13T12:00:00.000Z", updatedAt: "2026-08-13T12:00:00.000Z" },
    ],
    integrationOperations: [
      { id: "op_draft", teamId: "team_a", connectorId: "worklog", action: "project.create", status: "draft", localEntityType: "opportunity", localEntityId: "opp_won", payload: {}, requestedAt: "2026-08-13T13:00:00.000Z", createdAt: "2026-08-13T13:00:00.000Z", idempotencyKey: "k1" },
      { id: "op_foreign", teamId: "team_b", connectorId: "worklog", action: "project.create", status: "draft", localEntityType: "opportunity", localEntityId: "opp_foreign", payload: {}, idempotencyKey: "k2" },
    ],
    externalLinks: [
      { id: "link_project", teamId: "team_a", localEntityType: "opportunity", localEntityId: "opp_linked", externalSystem: "worklog", externalObjectType: "project", externalId: "7", syncState: "linked", lastVerifiedState: "verified", snapshotAt: "2026-08-14T10:00:00.000Z", statusSnapshot: { name: "Ashcombe delivery", overdueTasks: 2, loggedMinutes: 300, billableMinutes: 240, budgetUsedPct: 85 }, metadata: { name: "Ashcombe delivery" }, updatedAt: "2026-08-14T10:00:00.000Z" },
      { id: "link_client", teamId: "team_a", localEntityType: "company", localEntityId: "company_a", externalSystem: "worklog", externalObjectType: "client", externalId: "3", syncState: "linked", lastVerifiedState: "verified", metadata: { name: "Ashcombe Provisions" }, updatedAt: "2026-08-14T10:00:00.000Z" },
      { id: "link_foreign", teamId: "team_b", localEntityType: "opportunity", localEntityId: "opp_foreign", externalSystem: "worklog", externalObjectType: "project", externalId: "9", syncState: "linked", metadata: { name: "Foreign delivery" } },
    ],
    operationExceptions: [
      { id: "exception_open", teamId: "team_a", exceptionType: "worklog_stale_external_link", severity: "error", sourceEntityType: "opportunity", sourceEntityId: "opp_linked", status: "open", summary: "Stale link", createdAt: "2026-08-13T14:00:00.000Z" },
      { id: "exception_foreign", teamId: "team_b", exceptionType: "delivery_outcome_uncertain", sourceEntityType: "message", sourceEntityId: "m", status: "open", summary: "Foreign exception" },
    ],
    activities: [
      { id: "activity_1", teamId: "team_a", activityType: "worklog_project_created", summary: "Created Worklog delivery project", occurredAt: "2026-08-14T09:00:00.000Z", opportunityId: "opp_linked" },
      { id: "activity_2", teamId: "team_a", activityType: "sent", summary: "Message sent to Ada", occurredAt: "2026-08-13T09:00:00.000Z", companyId: "company_a" },
      { id: "activity_foreign", teamId: "team_b", activityType: "sent", summary: "Foreign activity", occurredAt: "2026-08-14T09:00:00.000Z" },
    ],
  };
}

function service(repository, role = "owner", { connector = null, transportStatus = () => ({ enabled: false }) } = {}) {
  return new HomeService({ teamId: "team_a", actor: { id: `${role}_a`, role }, repository, worklogConnector: connector, now: NOW, transportStatus });
}

test("snapshot composes every section from canonical state with no persistence", async () => {
  const repo = new MemoryStage5Repository(seed());
  const snap = await service(repo).snapshot();
  for (const key of ["attention", "today", "approvals", "pipeline", "outreach", "delivery", "generation", "systemHealth", "recentActivity"]) {
    assert.equal(snap[key].state ?? "ok", key === "quickLinks" ? undefined : snap[key].state, `${key} present`);
  }
  assert.ok(snap.generatedAt);
  assert.equal(repo.integrationOperations.length, 2, "snapshot wrote nothing");
  assert.ok(!("homeSnapshots" in repo), "no dashboard state table exists");
});

test("attention ordering is deterministic: severity class, then oldest first, then key", async () => {
  const repo = new MemoryStage5Repository(seed());
  const { items } = (await service(repo).snapshot()).attention.data;
  const severities = items.map((item) => item.severity);
  const order = ["critical", "action_required", "due_today", "upcoming", "informational"];
  const ranks = severities.map((severity) => order.indexOf(severity));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "severity classes never interleave");
  const criticalKeys = items.filter((item) => item.severity === "critical").map((item) => item.key);
  assert.ok(criticalKeys.includes("outreach:dead_letter"));
  assert.ok(criticalKeys.includes("deployment:deployment_unknown:unknown"));
  assert.ok(criticalKeys.includes("import:import_failed:failed"));
  assert.ok(criticalKeys.includes("job:job_failed:validation_failed"));
  const actionKeys = items.filter((item) => item.severity === "action_required").map((item) => item.key);
  assert.ok(actionKeys.includes("next-action:opp_overdue"), "overdue next action is action_required");
  assert.ok(actionKeys.includes("handoff:opp_won"), "won-but-unlinked opportunity needs handoff");
  assert.ok(items.some((item) => item.key === "next-action:opp_today" && item.severity === "due_today"));
  const withinAction = items.filter((item) => item.severity === "action_required").map((item) => String(item.at));
  assert.deepEqual(withinAction, [...withinAction].sort(), "within a class, oldest first");
  assert.ok(items.every((item) => item.href && item.href.startsWith("/") || item.href.startsWith("#")), "every item deep-links somewhere");
});

test("resolving source conditions makes items disappear naturally (projection, not a second database)", async () => {
  const repo = new MemoryStage5Repository(seed());
  const svc = service(repo);
  const before = (await svc.snapshot()).attention.data.items.map((item) => item.key);
  assert.ok(before.includes("handoff:opp_won"));
  assert.ok(before.includes("exception:exception_open"));
  assert.ok(before.includes("next-action:opp_overdue"));
  assert.ok(before.includes("approval:job-review:job_review"));

  // Resolve each condition in its authoritative system.
  repo.externalLinks.push({ id: "link_new", teamId: "team_a", localEntityType: "opportunity", localEntityId: "opp_won", externalSystem: "worklog", externalObjectType: "project", externalId: "11", syncState: "linked", lastVerifiedState: "verified", metadata: {}, statusSnapshot: {} });
  repo.operationExceptions.find((row) => row.id === "exception_open").status = "resolved";
  repo.opportunities.find((row) => row.id === "opp_overdue").nextActionAt = "2026-08-28T00:00:00.000Z";
  repo.generationJobs.find((row) => row.id === "job_review").status = "approved";

  const after = (await svc.snapshot()).attention.data.items.map((item) => item.key);
  assert.ok(!after.includes("handoff:opp_won"), "handoff disappears once linked");
  assert.ok(!after.includes("exception:exception_open"), "resolved exception disappears");
  assert.ok(!after.includes("next-action:opp_overdue"), "rescheduled next action is no longer overdue");
  assert.ok(after.includes("next-action:opp_overdue") === false && after.some((key) => key === "next-action:opp_overdue") === false);
  assert.ok(!after.includes("approval:job-review:job_review"), "approved job leaves the review queue");
});

test("today lists only due/overdue real work and leaves a seam for calendar events", async () => {
  const repo = new MemoryStage5Repository(seed());
  const today = (await service(repo).snapshot()).today.data;
  assert.equal(today.date, "2026-08-14");
  const kinds = today.items.map((item) => item.kind);
  assert.ok(kinds.includes("next_action"));
  assert.ok(kinds.includes("delivery_task"));
  assert.ok(kinds.includes("approvals"));
  const overdueFirst = today.items.map((item) => item.overdue);
  assert.deepEqual(overdueFirst, [...overdueFirst].sort((a, b) => Number(b) - Number(a)), "overdue items sort first");
  for (const item of today.items) for (const field of ["kind", "title", "href", "dueDate"]) assert.ok(field in item);
});

test("approvals aggregate campaigns, drafts, generation, operations, and imports with deep links", async () => {
  const repo = new MemoryStage5Repository(seed());
  const approvals = (await service(repo).snapshot()).approvals.data;
  const kinds = approvals.items.map((item) => item.kind);
  for (const kind of ["campaign", "message", "artifact_review", "integration_operation", "import"]) assert.ok(kinds.includes(kind), `${kind} aggregated`);
  assert.ok(approvals.items.every((item) => item.href.startsWith("/")));
  assert.equal(approvals.canApprove, true);
  const salesView = (await service(repo, "sales").snapshot()).approvals.data;
  assert.equal(salesView.canApprove, false, "sales sees the queue but no approval capability");
  assert.equal(salesView.items.length, approvals.items.length);
});

test("pipeline uses the real stage vocabulary and never presents unknown values as zero", async () => {
  const repo = new MemoryStage5Repository(seed());
  const pipeline = (await service(repo).snapshot()).pipeline.data;
  assert.equal(pipeline.activeCount, 4, "closed opportunities excluded");
  const stages = Object.fromEntries(pipeline.stages.map((row) => [row.stage, row]));
  assert.ok(stages.qualified && stages.won && stages.delivery && stages.contacted);
  assert.equal(stages.contacted.knownValue, 0);
  assert.equal(stages.contacted.unknownValueCount, 1, "missing estimate reported as unknown, not $0");
  assert.equal(pipeline.knownValueTotal, 16000);
  assert.equal(pipeline.unknownValueCount, 2);
  assert.equal(pipeline.awaitingHandoff, 1);
  assert.ok(pipeline.recentWins.some((win) => win.id === "opp_won"));
});

test("delivery summarizes stored Worklog snapshots with freshness and never calls Worklog", async () => {
  const repo = new MemoryStage5Repository(seed());
  const delivery = (await service(repo).snapshot()).delivery.data;
  assert.equal(delivery.linkedProjects, 1);
  assert.equal(delivery.overdueTasks, 2);
  assert.equal(delivery.loggedMinutes, 300);
  assert.equal(delivery.billableMinutes, 240);
  assert.equal(delivery.budgetRiskProjects.length, 1);
  assert.equal(delivery.pendingOperations, 1);
  assert.equal(delivery.oldestSnapshotAt, "2026-08-14T10:00:00.000Z", "freshness is exposed");
  assert.equal(delivery.source, "worklog");
});

test("system health distinguishes disabled-intentionally and unconfigured from failure", async () => {
  const repo = new MemoryStage5Repository(seed());
  const entries = Object.fromEntries((await service(repo).snapshot()).systemHealth.data.entries.map((entry) => [entry.id, entry]));
  assert.equal(entries.email_transport.state, "disabled");
  assert.match(entries.email_transport.detail, /intentionally/);
  assert.equal(entries.worklog_connector.state, "unconfigured");
  assert.equal(entries.outbox_worker.state, "unconfigured", "never-run worker is not an error");
  assert.equal(entries.outbox_backlog.state, "degraded", "dead letters degrade the backlog entry");
  const healthy = new MemoryStage5Repository(seed());
  healthy.messages = healthy.messages.filter((message) => message.queueState !== "dead_letter");
  healthy.workerHeartbeats.push({ teamId: "team_a", workerId: "w1", state: "idle", lastSuccessAt: "2026-08-14T11:30:00.000Z", updatedAt: "2026-08-14T11:30:00.000Z" });
  const healthyEntries = Object.fromEntries((await service(healthy).snapshot()).systemHealth.data.entries.map((entry) => [entry.id, entry]));
  assert.equal(healthyEntries.outbox_worker.state, "healthy");
  assert.equal(healthyEntries.outbox_backlog.state, "healthy");
});

test("a hung or failing Worklog connector degrades only its own surfaces", async () => {
  const repo = new MemoryStage5Repository(seed());
  const hangingClient = { get: () => new Promise(() => {}), post: () => new Promise(() => {}) };
  const connector = new WorklogConnector({ baseUrl: "http://127.0.0.1:1", teamId: "team_a", client: hangingClient, readCacheTtlMs: 0 });
  const snap = await service(repo, "owner", { connector }).snapshot();
  const worklogEntry = snap.systemHealth.data.entries.find((entry) => entry.id === "worklog_connector");
  assert.equal(worklogEntry.state, "unavailable", "probe timeout classifies as unavailable");
  for (const key of ["pipeline", "delivery", "outreach", "recentActivity"]) assert.equal(snap[key].state, "ok", `${key} still renders`);
});

test("a failing repository source degrades its sections and leaves the rest intact", async () => {
  const repo = new MemoryStage5Repository(seed());
  repo.listCampaigns = async () => { throw new Error("campaigns table offline"); };
  const snap = await service(repo).snapshot();
  assert.equal(snap.approvals.state, "degraded");
  assert.match(snap.approvals.error, /campaigns/);
  assert.equal(snap.outreach.state, "degraded");
  assert.equal(snap.pipeline.state, "ok");
  assert.equal(snap.delivery.state, "ok");
  assert.equal(snap.recentActivity.state, "ok");
});

test("cross-team isolation: no foreign attention, search, activity, or approval leakage", async () => {
  const repo = new MemoryStage5Repository(seed());
  const snap = await service(repo).snapshot();
  const serialized = JSON.stringify(snap);
  assert.ok(!serialized.includes("opp_foreign"));
  assert.ok(!serialized.includes("Foreign campaign"));
  assert.ok(!serialized.includes("Foreign activity"));
  assert.ok(!serialized.includes("exception_foreign"));
  assert.ok(!serialized.includes("op_foreign"));
  const search = await service(repo).search("Foreign");
  assert.equal(search.results.length, 0, "another team's objects are invisible to search");
});

test("search is bounded, team-scoped, requires two characters, and deep-links each kind", async () => {
  const repo = new MemoryStage5Repository(seed());
  const svc = service(repo);
  assert.deepEqual((await svc.search("a")).results, [], "single-character query returns nothing");
  const results = (await svc.search("Ashcombe")).results;
  const kinds = new Set(results.map((result) => result.kind));
  for (const kind of ["company", "opportunity", "campaign", "artifact", "generation_job", "worklog_project"]) assert.ok(kinds.has(kind), `${kind} searchable`);
  assert.ok(results.length <= 30);
  for (const result of results) {
    assert.ok(result.href.startsWith("/"));
    for (const field of ["kind", "id", "title", "status"]) assert.ok(field in result);
  }
  const contact = (await svc.search("ada@ashcombe")).results;
  assert.equal(contact[0].kind, "contact");
});

test("recent activity is the canonical Activity stream with entity deep links", async () => {
  const repo = new MemoryStage5Repository(seed());
  const { items } = (await service(repo).snapshot()).recentActivity.data;
  assert.equal(items.length, 2);
  assert.equal(items[0].activityType, "worklog_project_created", "newest first");
  assert.equal(items[0].href, "/opportunities/opp_linked");
  assert.equal(items[1].href, "/companies/company_a");
});

test("quick actions respect roles: viewers get no write shortcuts", async () => {
  const repo = new MemoryStage5Repository(seed());
  const ownerLinks = (await service(repo).snapshot()).quickLinks.map((link) => link.label);
  assert.ok(ownerLinks.includes("Import prospects"));
  assert.ok(ownerLinks.includes("Create campaign"));
  const viewerLinks = (await service(repo, "viewer").snapshot()).quickLinks.map((link) => link.label);
  assert.ok(!viewerLinks.includes("Import prospects"));
  assert.ok(!viewerLinks.includes("Create campaign"));
  assert.ok(viewerLinks.includes("Review approvals"));
});

test("empty team renders a useful empty snapshot, not fake data", async () => {
  const repo = new MemoryStage5Repository({});
  const snap = await service(repo).snapshot();
  assert.equal(snap.attention.data.items.length, 0);
  assert.equal(snap.today.data.items.length, 0);
  assert.equal(snap.pipeline.data.activeCount, 0);
  assert.equal(snap.pipeline.data.stages.length, 0);
  assert.equal(snap.delivery.data.linkedProjects, 0);
  assert.equal(snap.recentActivity.data.items.length, 0);
  assert.equal(snap.outreach.data.sent, 0);
});

test("host routing invariant: tenant hosts stay funnels; only unclaimed hosts land on /home", async () => {
  const page = await readFile(path.join(root, "platform", "app", "page.jsx"), "utf8");
  assert.match(page, /getTenantClaimingHost\(host\)/, "host resolution is unchanged");
  assert.match(page, /if \(!tenant\) redirect\("\/home"\)/, "unclaimed hosts land on HOME");
  assert.doesNotMatch(page, /redirect\("\/admin"\)/, "the old app-host redirect is fully replaced");
  assert.match(page, /resolveTenantMediaConfig\(tenant/, "claimed tenant hosts still render their funnel");
  const store = await readFile(path.join(root, "platform", "lib", "store.js"), "utf8");
  assert.match(store, /getTenantClaimingHost/, "no-fallback host claiming still exists");
});

test("HOME page and palette ship no credentials and no consequential natural-language actions", async () => {
  const homePage = await readFile(path.join(root, "platform", "app", "(core)", "home", "page.jsx"), "utf8");
  assert.match(homePage, /getStage5PageContext/, "HOME uses the authenticated core context");
  assert.doesNotMatch(homePage, /CORE_WORKLOG_(PASSWORD|EMAIL)|RESEND_API_KEY/, "no secrets in the page");
  const palette = await readFile(path.join(root, "platform", "components", "core", "CommandPalette.jsx"), "utf8");
  assert.match(palette, /api\/core\/search/, "palette uses the server search API");
  assert.doesNotMatch(palette, /assistant|Ask AI|DGTL\.chat/i, "no AI assistant is advertised in Stage 5");
  const route = await readFile(path.join(root, "platform", "app", "api", "core", "search", "route.js"), "utf8");
  assert.match(route, /requireSession/, "search requires an authenticated session");
  assert.match(route, /getSessionTeamId/, "search derives the team from the session, never the request");
});
