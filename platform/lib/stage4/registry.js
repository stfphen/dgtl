/**
 * Stage 4 integration connector registry.
 *
 * Mirrors the Stage 3 adapter registry: a frozen, code-owned declaration of
 * what each external connector can do, classified by consequence. Nothing in
 * here is reachable from request input except by exact id/action lookup, and
 * an action that is not declared simply does not exist.
 *
 * Capability honesty (audited against apps/worklog/server/api.mjs):
 *  - Worklog has NO standalone client-create endpoint. A client comes into
 *    existence when a project is created carrying `clientName`, and the row
 *    is pruned automatically when its last project detaches. "Create client"
 *    is therefore not a declared action; the client is a declared side effect
 *    of `project.create`, and client ids are treated as non-durable.
 *  - Worklog has no idempotency keys, no external-reference columns, and no
 *    unique project/task names. Duplicate prevention is Core's job: every
 *    consequential action runs through an approved IntegrationOperation with
 *    a team-unique idempotency key, a deterministic external marker (project
 *    code / task note reference), and read-before-write reconciliation.
 *  - Project create/update/delete require a Worklog admin account; task
 *    create/update require any signed-in account.
 */

export const WORKLOG_EXTERNAL_SYSTEM = "worklog";

// local entity type -> permitted Worklog object types for external_links.
export const WORKLOG_LINK_RULES = Object.freeze({
  company: Object.freeze(["client"]),
  opportunity: Object.freeze(["project"]),
  artifact: Object.freeze(["task"]),
});

export const INTEGRATION_OPERATION_STATES = Object.freeze([
  "draft", "approved", "executing", "succeeded", "failed", "outcome_unknown", "cancelled",
]);

const WORKLOG_ACTIONS = Object.freeze({
  "project.create": Object.freeze({
    id: "project.create",
    classification: "consequential",
    displayName: "Create Worklog delivery project",
    localEntityTypes: Object.freeze(["opportunity"]),
    worklogRole: "admin",
    resultObjectType: "project",
    sideEffects: Object.freeze(["May create the named Worklog client if it does not exist yet."]),
  }),
  "tasks.create": Object.freeze({
    id: "tasks.create",
    classification: "consequential",
    displayName: "Create Worklog delivery tasks",
    localEntityTypes: Object.freeze(["opportunity"]),
    worklogRole: "member",
    resultObjectType: "task",
    maxItems: 20,
    sideEffects: Object.freeze([]),
  }),
});

const WORKLOG_READS = Object.freeze([
  "clients.list", "projects.list", "tasks.list", "project.status", "time.summary", "digest.get", "health",
]);

// Documented so the UI and the future DGTL OS tool layer advertise honestly.
const WORKLOG_UNSUPPORTED = Object.freeze({
  "client.create": "Worklog has no client-create endpoint; the client is created as a side effect of the first project carrying its clientName.",
  "client.update": "Worklog has no client update/delete routes; client rows are derived from projects.",
  "task.update": "Deliberately not exposed through Core in Stage 4; tasks are edited in Worklog, which remains the execution authority.",
  "time.log": "Core never writes time; Worklog and its MCP remain the time-entry writers.",
  "timer.control": "Timer control is per-Worklog-user and belongs to the future DGTL OS tool layer.",
  "shift.manage": "Attendance stays in Worklog; Core classifies shift reads for later HOME use only.",
});

export const WORKLOG_CONNECTOR = Object.freeze({
  id: "worklog",
  displayName: "DGTL Worklog",
  externalSystem: WORKLOG_EXTERNAL_SYSTEM,
  // The base URL and credentials are server-configured environment values.
  // Request input can never select an endpoint, so the connector cannot be
  // turned into an SSRF proxy.
  configSource: Object.freeze({
    baseUrl: "CORE_WORKLOG_BASE_URL",
    email: "CORE_WORKLOG_EMAIL",
    password: "CORE_WORKLOG_PASSWORD",
    teamId: "CORE_WORKLOG_TEAM_ID",
  }),
  reads: WORKLOG_READS,
  actions: WORKLOG_ACTIONS,
  unsupported: WORKLOG_UNSUPPORTED,
  // Rate/concurrency policy: the shared client serialises every request with
  // a minimum gap (Passenger shared hosting), reads are cached and coalesced,
  // consequential actions run one at a time, and a 401 triggers at most one
  // re-login so the 10-per-15-minutes throttle can never be exhausted.
  policy: Object.freeze({
    minRequestGapMs: 120,
    readCacheTtlMs: 30_000,
    requestTimeoutMs: 20_000,
    maxBulkTasks: 20,
    consequentialRetries: 0,
  }),
});

export function requireWorklogAction(actionId) {
  const action = WORKLOG_ACTIONS[actionId];
  if (!action) {
    const reason = WORKLOG_UNSUPPORTED[actionId];
    throw Object.assign(
      new Error(reason ? `Unsupported Worklog action: ${actionId}. ${reason}` : `Unknown Worklog action: ${actionId}.`),
      { status: reason ? 409 : 400, code: reason ? "unsupported_action" : "unknown_action" },
    );
  }
  return action;
}

export function requireWorklogLinkRule(localEntityType, externalObjectType) {
  const allowed = WORKLOG_LINK_RULES[localEntityType];
  if (!allowed || !allowed.includes(externalObjectType)) {
    throw Object.assign(
      new Error(`A ${localEntityType || "record"} cannot link to a Worklog ${externalObjectType || "object"}.`),
      { status: 400, code: "invalid_link_rule" },
    );
  }
}
