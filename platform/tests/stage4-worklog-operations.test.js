import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorklogError } from "../../apps/worklog/client/worklog-client.mjs";
import { MemoryStage4Repository } from "../lib/stage4/memoryRepository.js";
import { WorklogConnector } from "../lib/stage4/worklogConnector.js";
import { WorklogOperationsService } from "../lib/stage4/service.js";
import { WORKLOG_CONNECTOR, requireWorklogAction, requireWorklogLinkRule } from "../lib/stage4/registry.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const nowValues = () => { let n = 0; return () => new Date(Date.UTC(2026, 7, 14, 12, 0, n++)); };
function ids() { let n = 0; return (type) => `${type}_stage4_${++n}`; }

/**
 * In-memory Worklog speaking the audited HTTP contract: clients derived from
 * projects (and pruned with them), no idempotency, no unique names, admin-only
 * project creation, camelCase rows. Failures are injected per-request,
 * optionally AFTER committing the write — the lost-response case.
 */
class FakeWorklog {
  constructor({ role = "admin" } = {}) {
    this.users = [{ id: 1, name: "Core Bot", email: "core@dgtl.test", role }, { id: 2, name: "Sam Doe", email: "sam@dgtl.test", role: "member" }];
    this.me = this.users[0];
    this.projects = []; this.tasks = []; this.clients = [];
    this.nextProject = 101; this.nextTask = 501; this.nextClient = 11;
    this.today = "2026-08-14"; this.failures = []; this.log = [];
  }
  failOnce(match, { status = undefined, afterCommit = false } = {}) { this.failures.push({ match, status, afterCommit }); }
  #maybeFail(key, commit) {
    const index = this.failures.findIndex((failure) => key.startsWith(failure.match));
    if (index < 0) return null;
    const failure = this.failures.splice(index, 1)[0];
    let committed = null;
    if (failure.afterCommit && commit) committed = commit();
    throw new WorklogError(`${key} failed`, { status: failure.status, path: key });
  }
  clientFor(name) {
    if (!name) return null;
    let client = this.clients.find((row) => row.name.toLowerCase() === String(name).toLowerCase());
    if (!client) { client = { id: this.nextClient++, name: String(name) }; this.clients.push(client); }
    return client;
  }
  prune() { this.clients = this.clients.filter((client) => this.projects.some((project) => project.clientId === client.id)); }
  addProject({ name, clientName = "", code = "", status = "active", billable = true, budgetMinutes = null, loggedMinutes = 0, billableMinutes = 0 }) {
    const client = clientName ? this.clientFor(clientName) : null;
    const project = { id: this.nextProject++, name, code, status, billable, budgetMinutes, loggedMinutes, billableMinutes, clientId: client?.id ?? null, clientName: client?.name ?? "" };
    this.projects.push(project); return project;
  }
  addTask({ title, projectId = null, notes = "", status = "todo", priority = "normal", assigneeId = null, dueDate = null, estimateMinutes = null, archived = false }) {
    const task = { id: this.nextTask++, title, projectId, notes, status, priority, assigneeId, dueDate, estimateMinutes, archived };
    this.tasks.push(task); return task;
  }
  projectRows() {
    return this.projects.map((project) => ({
      ...project,
      openTasks: this.tasks.filter((task) => task.projectId === project.id && !task.archived && task.status !== "done").length,
      taskCount: this.tasks.filter((task) => task.projectId === project.id).length,
    }));
  }
  async get(pathName) {
    this.log.push(`GET ${pathName}`);
    this.#maybeFail(`GET ${pathName.split("?")[0]}`);
    if (pathName === "/api/bootstrap") return { user: this.me, today: this.today, timezone: "America/Toronto", users: this.users, projects: this.projectRows(), tasks: this.tasks.filter((task) => !task.archived) };
    if (pathName === "/api/clients") return { clients: this.clients.map((client) => ({ ...client, projects: this.projects.filter((project) => project.clientId === client.id).length })).filter((client) => client.projects > 0) };
    if (pathName.startsWith("/api/projects")) return { projects: this.projectRows() };
    if (pathName.startsWith("/api/tasks")) return { tasks: pathName.includes("archived=1") ? this.tasks : this.tasks.filter((task) => !task.archived) };
    if (pathName.startsWith("/api/digest")) {
      const url = new URL(`http://x${pathName}`);
      const clientId = Number(url.searchParams.get("clientId"));
      const client = this.clients.find((row) => row.id === clientId);
      if (!client) throw new WorklogError("No such client", { status: 404, path: pathName });
      return {
        client: { id: client.id, name: client.name }, range: { from: "2026-08-10", to: "2026-08-16", days: 7 },
        generatedAt: "2026-08-14T12:00:00.000Z", timezone: "America/Toronto",
        totals: { minutes: 180 }, workstreams: [], completed: [], narrative: [],
        provenance: [{ id: "total-minutes", kind: "sum", label: "Total minutes", value: 180, entryIds: [9001, 9002] }],
      };
    }
    throw new WorklogError("No such endpoint", { status: 404, path: pathName });
  }
  async post(pathName, body) {
    this.log.push(`POST ${pathName}`);
    if (pathName === "/api/projects") {
      if (this.me.role !== "admin") throw new WorklogError("Admins only", { status: 403, path: pathName });
      const commit = () => this.addProject({ name: body.name, clientName: body.clientName || "", code: String(body.code || "").toUpperCase(), billable: body.billable !== false, budgetMinutes: body.budgetMinutes ?? null });
      this.#maybeFail("POST /api/projects", commit);
      const created = commit();
      return { project: this.projectRows().find((row) => row.id === created.id) };
    }
    if (pathName === "/api/tasks") {
      const commit = () => this.addTask({ title: body.title, projectId: body.projectId ?? null, notes: body.notes || "", priority: body.priority || "normal", assigneeId: body.assigneeId === undefined ? this.me.id : body.assigneeId, dueDate: body.dueDate ?? null, estimateMinutes: body.estimateMinutes ?? null, status: body.status || "todo" });
      this.#maybeFail("POST /api/tasks", commit);
      return { task: commit() };
    }
    throw new WorklogError("No such endpoint", { status: 404, path: pathName });
  }
}

function seed() {
  return {
    companies: [
      { id: "company_a", teamId: "team_a", tenantId: "tenant_a", displayName: "Ashcombe Provisions", legalName: "Ashcombe Provisions Inc.", normalizedDomain: "ashcombe.test" },
      { id: "company_b", teamId: "team_b", displayName: "Foreign Co" },
    ],
    contacts: [{ id: "contact_a", teamId: "team_a", companyId: "company_a", fullName: "Ada Buyer", email: "ada@ashcombe.test" }],
    opportunities: [
      { id: "opportunity_a", teamId: "team_a", tenantId: "tenant_a", companyId: "company_a", name: "Ashcombe site rebuild", stage: "won", status: "open", offer: "Website overhaul" },
      { id: "opportunity_a2", teamId: "team_a", tenantId: "tenant_a", companyId: "company_a", name: "Ashcombe retainer", stage: "qualified", status: "open" },
      { id: "opportunity_b", teamId: "team_b", companyId: "company_b", name: "Foreign deal", stage: "won", status: "open" },
    ],
    assets: [
      { id: "artifact_a", teamId: "team_a", tenantId: "tenant_a", companyId: "company_a", opportunityId: "opportunity_a", kind: "pitch", slug: "ashcombe-overhaul", versionNumber: 1, status: "approved", contentChecksum: "c".repeat(64), deploymentUrl: "https://preview.invalid/ashcombe/" },
      { id: "artifact_draft", teamId: "team_a", companyId: "company_a", opportunityId: "opportunity_a", kind: "pitch", slug: "draft-only", versionNumber: 1, status: "draft" },
      { id: "artifact_foreign", teamId: "team_b", companyId: "company_b", opportunityId: "opportunity_b", kind: "pitch", slug: "foreign", versionNumber: 1, status: "approved" },
    ],
  };
}

function build({ role = "admin", worklogRole = "admin", teamId = "team_a", connectorTeamId = "team_a", fake = null } = {}) {
  const worklog = fake || new FakeWorklog({ role: worklogRole });
  const repository = new MemoryStage4Repository(seed());
  repository.__testIdFactory ||= ids();
  const connector = new WorklogConnector({ baseUrl: "http://127.0.0.1:1", teamId: connectorTeamId, client: worklog, readCacheTtlMs: 0 });
  const service = (actorRole = role, actorId = `${actorRole}_a`) => new WorklogOperationsService({
    teamId, actor: { id: actorId, role: actorRole }, repository, connector, now: nowValues(), idFactory: repository.__testIdFactory,
  });
  return { worklog, repository, connector, service };
}

test("registry is honest about Worklog capabilities and never offers client-create", () => {
  assert.equal(WORKLOG_CONNECTOR.actions["client.create"], undefined);
  assert.match(WORKLOG_CONNECTOR.unsupported["client.create"], /side effect/);
  assert.throws(() => requireWorklogAction("client.create"), /Unsupported/);
  assert.throws(() => requireWorklogAction("shell.exec"), /Unknown/);
  assert.equal(requireWorklogAction("project.create").worklogRole, "admin");
  assert.throws(() => requireWorklogLinkRule("message", "project"), /cannot link/);
  assert.throws(() => requireWorklogLinkRule("company", "task"), /cannot link/);
  requireWorklogLinkRule("company", "client");
  requireWorklogLinkRule("artifact", "task");
});

test("connector is server-configured, team-bound, and fails closed when unconfigured", async () => {
  const unconfigured = new WorklogConnector({});
  assert.equal((await unconfigured.health()).state, "unconfigured");
  assert.throws(() => unconfigured.assertTeam("team_a"), /not configured/);
  const { connector } = build({ connectorTeamId: "team_other" });
  assert.throws(() => connector.assertTeam("team_a"), /not enabled for this team/);
  const { service } = build({ connectorTeamId: "team_other" });
  await assert.rejects(() => service().linkCompanyToClient("company_a", 1), /not enabled/);
});

test("company-client matching reports states without linking, and linking is explicit and verified", async () => {
  const { worklog, service, repository } = build();
  const svc = service();
  assert.equal((await svc.matchCompanyClients("company_a")).state, "no_match");
  worklog.addProject({ name: "Ashcombe site", clientName: "Ashcombe Provisions" });
  const match = await svc.matchCompanyClients("company_a");
  assert.equal(match.state, "probable_match");
  assert.equal(match.candidates[0].matchKind, "exact");
  worklog.addProject({ name: "Other", clientName: "Ashcombe Provisions Inc." });
  assert.equal((await svc.matchCompanyClients("company_a")).state, "multiple_candidates");
  const clientId = worklog.clients[0].id;
  const { link, created } = await svc.linkCompanyToClient("company_a", clientId);
  assert.equal(created, true);
  assert.equal(link.syncState, "linked");
  assert.ok(repository.activities.some((activity) => activity.activityType === "worklog_client_linked"));
  await assert.rejects(() => svc.linkCompanyToClient("company_a", worklog.clients[1].id), /already linked to a different/);
  await assert.rejects(() => svc.linkCompanyToClient("company_a", 999), /no longer exists/);
  assert.equal((await svc.matchCompanyClients("company_a")).state, "linked");
});

test("full delivery handoff: preview, approval, execution, links, activities, and duplicate safety", async () => {
  const { worklog, service, repository } = build();
  const sales = service("sales");
  const owner = service("owner");

  const { operation, preview } = await sales.requestProjectHandoff("opportunity_a", { budgetMinutes: 1200 });
  assert.equal(operation.status, "draft");
  assert.equal(preview.payload.clientName, "Ashcombe Provisions");
  assert.match(preview.payload.code, /^C4-[0-9A-F]{8}$/);
  assert.equal(preview.willCreateClient, true);

  const { operation: duplicate } = await sales.requestProjectHandoff("opportunity_a", { budgetMinutes: 1200 });
  assert.equal(duplicate.id, operation.id, "identical request must return the same draft operation");

  await assert.rejects(() => sales.approveOperation(operation.id), /Forbidden/);
  await assert.rejects(() => sales.executeOperation(operation.id), /Forbidden/);
  const approved = await owner.approveOperation(operation.id);
  assert.equal(approved.status, "approved");
  assert.ok(approved.payloadChecksum);
  await assert.rejects(() => owner.approveOperation(operation.id), /draft/);

  const result = await owner.executeOperation(operation.id);
  assert.equal(result.operation.status, "succeeded");
  assert.equal(worklog.projects.length, 1);
  assert.equal(worklog.projects[0].code, approved.payload.code);
  assert.equal(worklog.clients[0].name, "Ashcombe Provisions");
  const projectLink = await owner.linkedLinkFor("opportunity", "opportunity_a", "project");
  const clientLink = await owner.linkedLinkFor("company", "company_a", "client");
  assert.ok(projectLink && clientLink);
  assert.equal(projectLink.statusSnapshot.source, "worklog");
  assert.ok(repository.activities.some((activity) => activity.activityType === "worklog_project_created"));

  await assert.rejects(() => owner.executeOperation(operation.id), /approved operation/);
  await assert.rejects(() => sales.requestProjectHandoff("opportunity_a", {}), /already linked/);
});

test("payload tampering after approval invalidates the approval", async () => {
  const { service, repository, worklog } = build();
  const owner = service("owner");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  const record = repository.integrationOperations.find((row) => row.id === operation.id);
  record.payload = { ...record.payload, name: "Tampered name" };
  await assert.rejects(() => owner.executeOperation(operation.id), /approval is invalidated/);
  assert.equal(record.status, "cancelled");
  assert.equal(worklog.projects.length, 0);
});

test("an exact-name project that Core did not create fails closed as an ambiguous match", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  worklog.addProject({ name: "Ashcombe site rebuild", clientName: "Ashcombe Provisions" });
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  await assert.rejects(() => owner.executeOperation(operation.id), /Link it explicitly/);
  assert.equal(repository.integrationOperations.find((row) => row.id === operation.id).status, "failed");
  assert.equal(repository.operationExceptions.at(-1).exceptionType, "worklog_ambiguous_project_match");
  assert.equal(worklog.projects.length, 1, "no duplicate project was created");
});

test("lost create response quarantines as outcome_unknown; reconcile adopts the committed project without a duplicate", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  worklog.failOnce("POST /api/projects", { afterCommit: true });
  await assert.rejects(() => owner.executeOperation(operation.id), /quarantined for reconciliation/);
  const record = repository.integrationOperations.find((row) => row.id === operation.id);
  assert.equal(record.status, "outcome_unknown");
  assert.equal(repository.operationExceptions.at(-1).exceptionType, "worklog_operation_outcome_unknown");
  assert.equal(worklog.projects.length, 1, "Worklog committed the project");
  await assert.rejects(() => owner.retryOperation(operation.id), /reconciled first/);

  const reconciled = await owner.reconcileOperation(operation.id);
  assert.equal(reconciled.resolution, "adopted");
  assert.equal(record.status, "succeeded");
  assert.equal(worklog.projects.length, 1, "reconciliation adopted; no duplicate was created");
  assert.ok(await owner.linkedLinkFor("opportunity", "opportunity_a", "project"));
});

test("lost response with nothing committed reconciles to absent and allows one explicit re-run", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  worklog.failOnce("POST /api/projects", { afterCommit: false });
  await assert.rejects(() => owner.executeOperation(operation.id), /quarantined/);
  const reconciled = await owner.reconcileOperation(operation.id);
  assert.equal(reconciled.resolution, "absent");
  assert.equal(repository.integrationOperations.find((row) => row.id === operation.id).status, "approved");
  const result = await owner.executeOperation(operation.id);
  assert.equal(result.operation.status, "succeeded");
  assert.equal(worklog.projects.length, 1);
});

test("transient unreachability before any write returns the operation to approved without an exception", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  worklog.failOnce("GET /api/bootstrap", {});
  await assert.rejects(() => owner.executeOperation(operation.id), /unavailable/);
  const record = repository.integrationOperations.find((row) => row.id === operation.id);
  assert.equal(record.status, "approved");
  assert.equal(repository.operationExceptions.length, 0);
});

test("a member integration identity cannot create projects, and the failure is an exception, not a bypass", async () => {
  const { worklog, service, repository } = build({ worklogRole: "member" });
  const owner = service("owner");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  await owner.approveOperation(operation.id);
  await assert.rejects(() => owner.executeOperation(operation.id), /admin permission/);
  assert.equal(repository.integrationOperations.find((row) => row.id === operation.id).status, "failed");
  assert.equal(repository.operationExceptions.at(-1).exceptionType, "worklog_permission_denied");
  assert.equal(worklog.projects.length, 0);
});

test("task handoff creates marked tasks, survives a lost mid-batch response, and never duplicates on resume", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const project = worklog.addProject({ name: "Delivery", clientName: "Ashcombe Provisions" });
  await owner.linkOpportunityToProject("opportunity_a", project.id);

  const items = [
    { title: "Kickoff call", notes: "Agenda in shared doc", priority: "high" },
    { title: "Review approved pitch asset", artifactId: "artifact_a" },
    { title: "Launch checklist", dueDate: "2026-08-20", estimateMinutes: 90 },
  ];
  const { operation } = await owner.requestTaskHandoff("opportunity_a", { items });
  assert.equal(operation.status, "draft");
  await assert.rejects(() => owner.requestTaskHandoff("opportunity_a", { items: [{ title: "x", artifactId: "artifact_draft" }] }), /approved artifacts/);
  await assert.rejects(() => owner.requestTaskHandoff("opportunity_a", { items: [{ title: "x", artifactId: "artifact_foreign" }] }), /not available/);
  await owner.approveOperation(operation.id);

  worklog.failOnce("POST /api/tasks", { afterCommit: true });
  await assert.rejects(() => owner.executeOperation(operation.id), /quarantined/);
  assert.equal(worklog.tasks.length, 1, "first task committed before the lost response");
  const record = repository.integrationOperations.find((row) => row.id === operation.id);
  assert.equal(record.status, "outcome_unknown");

  const reconciled = await owner.reconcileOperation(operation.id);
  assert.equal(reconciled.found, 1);
  assert.equal(record.status, "approved");
  const result = await owner.executeOperation(operation.id);
  assert.equal(result.operation.status, "succeeded");
  assert.equal(worklog.tasks.length, 3, "resume created only the missing tasks");
  assert.equal(new Set(result.taskIds).size, 3);
  assert.ok(worklog.tasks.every((task) => task.notes.includes(`[core:${operation.id}#`)));
  assert.ok(worklog.tasks[1].notes.includes("Artifact: ashcombe-overhaul v1"), "artifact reference embedded exactly");
  assert.equal(worklog.tasks[0].assigneeId, null, "tasks are created unassigned by default");
  const artifactLink = await owner.linkedLinkFor("artifact", "artifact_a", "task");
  assert.ok(artifactLink);
  assert.ok(repository.activities.some((activity) => activity.activityType === "worklog_tasks_created"));

  const again = await owner.requestTaskHandoff("opportunity_a", { items });
  assert.equal(again.operation.id, operation.id, "identical task payload maps to the same operation");
  await assert.rejects(() => owner.executeOperation(operation.id), /approved operation/);
});

test("linking an existing project verifies existence, claims, and client consistency", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const project = worklog.addProject({ name: "Existing delivery", clientName: "Ashcombe Provisions" });
  await assert.rejects(() => owner.linkOpportunityToProject("opportunity_a", 999), /no longer exists/);
  const { link } = await owner.linkOpportunityToProject("opportunity_a", project.id);
  assert.equal(link.syncState, "linked");
  const clientLink = await owner.linkedLinkFor("company", "company_a", "client");
  assert.ok(clientLink, "company link derived from the project's client");
  await assert.rejects(() => owner.linkOpportunityToProject("opportunity_a2", project.id), /already linked to another opportunity/);
  const other = worklog.addProject({ name: "Other client project", clientName: "Somebody Else" });
  await assert.rejects(() => owner.linkOpportunityToProject("opportunity_a2", other.id), /different Worklog client/);
  assert.equal(repository.operationExceptions.at(-1).exceptionType, "worklog_client_mismatch");
});

test("unlink retires the relationship without touching Worklog; relink revives the same row", async () => {
  const { worklog, service, repository } = build();
  const owner = service("owner");
  const project = worklog.addProject({ name: "Delivery", clientName: "Ashcombe Provisions" });
  const { link } = await owner.linkOpportunityToProject("opportunity_a", project.id);
  const retired = await owner.unlink(link.id, { reason: "wrong project" });
  assert.equal(retired.syncState, "retired");
  assert.equal(worklog.projects.length, 1, "unlink never deletes the Worklog object");
  assert.ok(repository.activities.some((activity) => activity.activityType === "worklog_project_unlinked"));
  const relinked = await owner.linkOpportunityToProject("opportunity_a", project.id);
  assert.equal(relinked.link.id, link.id, "the same row is revived");
  const historyEvents = relinked.link.linkHistory.map((event) => event.event);
  assert.deepEqual(historyEvents.slice(0, 3), ["linked", "retired", "relinked"]);
});

test("repair requires an explicit replacement and preserves the audit trail", async () => {
  const { worklog, service, connector } = build();
  const owner = service("owner");
  const project = worklog.addProject({ name: "Delivery", clientName: "Ashcombe Provisions" });
  const { link } = await owner.linkOpportunityToProject("opportunity_a", project.id);
  worklog.projects = worklog.projects.filter((row) => row.id !== project.id);
  worklog.prune(); connector.invalidateReads();
  const replacement = worklog.addProject({ name: "Delivery v2", clientName: "Ashcombe Provisions" });
  await assert.rejects(() => owner.repairLink(link.id, { externalId: 999 }), /does not exist/);
  const repaired = await owner.repairLink(link.id, { externalId: replacement.id });
  assert.equal(String(repaired.externalId), String(replacement.id));
  assert.equal(repaired.metadata.repairedFrom, String(project.id));
  const old = await owner.repository.getExternalLinkById(link.id, "team_a");
  assert.equal(old.syncState, "retired");
});

test("status read-through snapshots Worklog-derived figures and records transitions exactly once", async () => {
  const { worklog, service, repository, connector } = build();
  const owner = service("owner");
  const project = worklog.addProject({ name: "Delivery", clientName: "Ashcombe Provisions", budgetMinutes: 600, loggedMinutes: 300, billableMinutes: 200 });
  worklog.addTask({ title: "Do the thing", projectId: project.id, dueDate: "2026-08-10" });
  worklog.addTask({ title: "Done thing", projectId: project.id, status: "done" });
  await owner.linkOpportunityToProject("opportunity_a", project.id);

  const first = await owner.refreshOpportunityDelivery("opportunity_a");
  assert.equal(first.state, "verified");
  assert.equal(first.snapshot.openTasks, 1);
  assert.equal(first.snapshot.overdueTasks, 1);
  assert.equal(first.snapshot.doneTasks, 1);
  assert.equal(first.snapshot.budgetUsedPct, 50);
  assert.equal(first.snapshot.source, "worklog");
  assert.ok(first.snapshot.fetchedAt);

  worklog.tasks[0].status = "done"; connector.invalidateReads();
  await owner.refreshOpportunityDelivery("opportunity_a");
  const completions = repository.activities.filter((activity) => activity.activityType === "worklog_task_completed");
  assert.equal(completions.length, 1);
  await owner.refreshOpportunityDelivery("opportunity_a");
  assert.equal(repository.activities.filter((activity) => activity.activityType === "worklog_task_completed").length, 1, "repeated reads do not duplicate Activity");

  worklog.projects[0].status = "archived"; connector.invalidateReads();
  await owner.refreshOpportunityDelivery("opportunity_a");
  await owner.refreshOpportunityDelivery("opportunity_a");
  assert.equal(repository.activities.filter((activity) => activity.activityType === "worklog_project_archived").length, 1);

  worklog.projects = []; worklog.prune(); connector.invalidateReads();
  const missing = await owner.refreshOpportunityDelivery("opportunity_a");
  assert.equal(missing.state, "missing");
  assert.equal(repository.operationExceptions.filter((exception) => exception.exceptionType === "worklog_stale_external_link").length, 1);
  await owner.refreshOpportunityDelivery("opportunity_a");
  assert.equal(repository.operationExceptions.filter((exception) => exception.exceptionType === "worklog_stale_external_link").length, 1, "stale-link exception is not repeated");
});

test("digest is a provenance-preserving pass-through from the linked client", async () => {
  const { worklog, service } = build();
  const owner = service("owner");
  await assert.rejects(() => owner.companyDigest("company_a"), /no linked Worklog client/);
  const project = worklog.addProject({ name: "Delivery", clientName: "Ashcombe Provisions" });
  await owner.linkOpportunityToProject("opportunity_a", project.id);
  const { digest, source, fetchedAt } = await owner.companyDigest("company_a");
  assert.equal(source, "worklog");
  assert.ok(fetchedAt);
  assert.equal(digest.client.name, "Ashcombe Provisions");
  assert.deepEqual(digest.provenance[0].entryIds, [9001, 9002], "row-level provenance survives untouched");
});

test("cross-team access to entities, operations, and links is rejected", async () => {
  const { service, repository } = build();
  const owner = service("owner");
  await assert.rejects(() => owner.requestProjectHandoff("opportunity_b", {}), /not available/);
  await assert.rejects(() => owner.matchCompanyClients("company_b"), /not available/);
  repository.integrationOperations.push({ id: "op_foreign", teamId: "team_b", connectorId: "worklog", action: "project.create", status: "approved", payload: {}, localEntityType: "opportunity", localEntityId: "opportunity_b", idempotencyKey: "k1" });
  await assert.rejects(() => owner.approveOperation("op_foreign"), /not found/);
  await assert.rejects(() => owner.executeOperation("op_foreign"), /not found/);
  repository.externalLinks.push({ id: "link_foreign", teamId: "team_b", localEntityType: "opportunity", localEntityId: "opportunity_b", externalSystem: "worklog", externalObjectType: "project", externalId: "7", syncState: "linked", metadata: {} });
  await assert.rejects(() => owner.unlink("link_foreign"), /not found/);
  await assert.rejects(() => owner.repairLink("link_foreign", { externalId: 1 }), /not found/);
});

test("idempotency keys bind to exact payloads: a changed payload is a new operation, not a reuse", async () => {
  const { service } = build();
  const owner = service("owner");
  const first = await owner.requestProjectHandoff("opportunity_a", { budgetMinutes: 600 });
  const second = await owner.requestProjectHandoff("opportunity_a", { budgetMinutes: 900 });
  assert.notEqual(first.operation.id, second.operation.id);
  assert.notEqual(first.operation.idempotencyKey, second.operation.idempotencyKey);
  const repeat = await owner.requestProjectHandoff("opportunity_a", { budgetMinutes: 600 });
  assert.equal(repeat.operation.id, first.operation.id);
});

test("operations overview surfaces handoff queue, pending operations, and broken links", async () => {
  const { worklog, service } = build();
  const owner = service("owner");
  const overviewBefore = await owner.operationsOverview();
  assert.equal(overviewBefore.status.health.state, "connected");
  assert.equal(overviewBefore.status.health.identity.role, "admin");
  assert.ok(overviewBefore.unlinkedDeliveryReady.some((opportunity) => opportunity.id === "opportunity_a"), "won opportunity appears in the handoff queue");
  const { operation } = await owner.requestProjectHandoff("opportunity_a", {});
  const overviewPending = await owner.operationsOverview();
  assert.ok(overviewPending.pendingOperations.some((row) => row.id === operation.id));
  await owner.approveOperation(operation.id);
  await owner.executeOperation(operation.id);
  const overviewAfter = await owner.operationsOverview();
  assert.ok(!overviewAfter.unlinkedDeliveryReady.some((opportunity) => opportunity.id === "opportunity_a"));
  assert.equal(overviewAfter.projectLinks.length, 1);
  assert.ok(JSON.stringify(overviewAfter.status).includes("core@dgtl.test"));
  assert.ok(!JSON.stringify(overviewAfter).includes("password"), "no credential shape reaches the overview");
  assert.equal(worklog.projects.length, 1);
});

test("auth failure and throttling are reported as states, never retried into a lockout", async () => {
  const { worklog, connector } = build();
  worklog.failOnce("GET /api/bootstrap", { status: 401 });
  assert.equal((await connector.health({ force: true })).state, "auth_failed");
  worklog.failOnce("GET /api/bootstrap", { status: 429 });
  assert.equal((await connector.health({ force: true })).state, "throttled");
  worklog.failOnce("GET /api/bootstrap", {});
  assert.equal((await connector.health({ force: true })).state, "unreachable");
  assert.equal((await connector.health({ force: true })).state, "connected");
});

test("migration 013 is additive, indexes team access paths, and creates no Worklog data copies", async () => {
  const sql = await readFile(path.join(root, "platform", "migrations", "013_worklog_operations_phase_4.sql"), "utf8");
  for (const token of ["integration_operations", "idempotency_key", "payload_checksum", "outcome", "uncertain_at", "external_result_id", "link_history", "status_snapshot", "last_verified_at", "unique (team_id, idempotency_key)", "integration_operations_team_status_idx"]) {
    assert.match(sql, new RegExp(token.replace(/[()]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(sql, /drop\s+(table|column)|truncate\s|delete\s+from/i);
  assert.doesNotMatch(sql, /create table[^;]*worklog_(projects|tasks|time|clients|shifts)/i, "no canonical Worklog copies");
});

test("Core never opens the Worklog database or ships Worklog credentials to the browser", async () => {
  const stage4Dir = path.join(root, "platform", "lib", "stage4");
  for (const file of ["registry.js", "service.js", "worklogConnector.js", "repository.js", "memoryRepository.js", "server.js", "api.js"]) {
    const source = await readFile(path.join(stage4Dir, file), "utf8");
    assert.doesNotMatch(source, /node:sqlite|DB_PATH|\.sqlite/i, `${file} must not touch the Worklog database directly`);
  }
  const panel = await readFile(path.join(root, "platform", "components", "core", "WorklogPanels.jsx"), "utf8");
  assert.doesNotMatch(panel, /CORE_WORKLOG_(PASSWORD|EMAIL)/, "credentials never reach a component");
  assert.doesNotMatch(panel, /"use client"/, "panels render on the server");
});
