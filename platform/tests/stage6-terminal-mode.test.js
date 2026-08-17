import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStage6Repository } from "../lib/stage6/memoryRepository.js";
import { AssistantService, TURN_LIMITS } from "../lib/stage6/assistantService.js";
import { createDeterministicAdapter } from "../lib/stage6/modelAdapter.js";
import { TOOLS } from "../lib/stage6/toolRegistry.js";
import { HomeService } from "../lib/stage5/homeService.js";
import { WorklogOperationsService } from "../lib/stage4/service.js";
import { WorklogConnector } from "../lib/stage4/worklogConnector.js";

// DGTL.chat terminal mode — the deterministic read-command path.
//
// The whole security argument for this route is that its reachable set is a
// strict SUBSET of what the model could already reach through handleTurn. These
// tests are what keep that true.

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(platformRoot, ...parts), "utf8");

const NOW = () => new Date("2026-08-14T12:00:00.000Z");
function ids() { let n = 0; return (type) => `${type}_term_${++n}`; }

function seed() {
  return {
    companies: [
      { id: "company_a", teamId: "team_a", displayName: "Lanternworks Studio", normalizedDomain: "lanternworks.test", relationshipStatus: "client", updatedAt: "2026-08-10T00:00:00.000Z" },
      { id: "company_b", teamId: "team_b", displayName: "Foreign Widgets" },
    ],
    contacts: [
      { id: "contact_a", teamId: "team_a", companyId: "company_a", fullName: "Lena Buyer", email: "lena@lanternworks.test", normalizedEmail: "lena@lanternworks.test", title: "Founder", updatedAt: "2026-08-01T00:00:00.000Z" },
    ],
    opportunities: [
      { id: "opp_a", teamId: "team_a", companyId: "company_a", primaryContactId: "contact_a", contactIds: ["contact_a"], name: "Lanternworks rebuild", stage: "won", status: "open", nextAction: "Send proposal", nextActionAt: "2026-08-10T00:00:00.000Z", estimatedValue: 15000, updatedAt: "2026-08-12T00:00:00.000Z" },
      { id: "opp_b", teamId: "team_b", companyId: "company_b", name: "Foreign deal", stage: "won", status: "open" },
    ],
  };
}

function build({ role = "owner", actorId = null, rateLimiter = () => ({ allowed: true }), seedData = seed() } = {}) {
  const repository = new MemoryStage6Repository(seedData);
  repository.__ids ||= ids();
  const actor = { id: actorId || `${role}_a`, role };
  const failingClient = { get() { throw new Error("Worklog must not be called"); }, post() { throw new Error("Worklog must not be written"); } };
  const connector = new WorklogConnector({ baseUrl: "http://127.0.0.1:1", teamId: "team_a", client: failingClient, readCacheTtlMs: 0 });
  const services = {
    home: new HomeService({ teamId: "team_a", actor, repository, worklogConnector: connector, now: NOW }),
    worklog: new WorklogOperationsService({ teamId: "team_a", actor, repository, connector, now: NOW, idFactory: repository.__ids }),
  };
  // adapter: null — proving the read path needs no model provider at all.
  const service = new AssistantService({ teamId: "team_a", actor, repository, adapter: null, services, now: NOW, idFactory: repository.__ids, rateLimiter });
  return { repository, service, actor };
}

// ------------------------------------------------------------ happy path

test("a read command runs deterministically, with no model provider configured", async () => {
  const { service, repository } = build();
  const thread = await service.createThread({});

  const result = await service.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: {} });

  assert.equal(result.toolId, "home.get_snapshot");
  assert.ok(result.summary, "a deterministic text summary is produced");
  assert.ok(result.data, "live data comes back for the terminal panel");
  assert.deepEqual(result.toolSummary, [{ toolId: "home.get_snapshot", status: "completed" }]);

  // Exactly one audit row, classified read, with the validated arguments.
  const runs = await repository.listAssistantToolRuns(thread.id, "team_a");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].classification, "read");
  assert.equal(runs[0].status, "completed");
  assert.equal(runs[0].toolId, "home.get_snapshot");

  // The command and its output are persisted, so switching surfaces keeps them.
  const view = await service.getThread(thread.id);
  assert.equal(view.messages.length, 2);
  assert.equal(view.messages[0].role, "user");
  assert.equal(view.messages[1].role, "system_notice", "deterministic output must not masquerade as the model speaking");
  assert.equal(view.messages[1].providerMetadata.noticeKind, "command");
  assert.equal(view.proposals.length, 0, "a read command can never create a proposal");
});

test("free-text still needs a provider, so the terminal works where chat cannot", async () => {
  const { service } = build();
  const thread = await service.createThread({});
  await assert.rejects(
    () => service.handleTurn({ threadId: thread.id, userMessage: "what needs attention?" }),
    (error) => error.code === "assistant_unconfigured"
  );
  // ...but the deterministic path is unaffected.
  const result = await service.runReadCommand({ threadId: thread.id, toolId: "activity.list_recent", args: {} });
  assert.equal(result.toolId, "activity.list_recent");
});

test("search results are numbered so #n can only ever point at a real record", async () => {
  const { service } = build();
  const thread = await service.createThread({});
  const result = await service.runReadCommand({ threadId: thread.id, toolId: "core.search", args: { query: "Lanternworks" } });
  assert.match(result.summary, /\[1\]/, "results are numbered for #n references");
  assert.ok(result.sourceRefs.length > 0, "refs come from the tool, never invented");
});

// --------------------------------------------------------- the hard gate

test("a prepare tool is refused, and nothing is created", async () => {
  const { service, repository } = build();
  const thread = await service.createThread({});

  for (const toolId of TOOLS.filter((tool) => tool.classification === "prepare").map((tool) => tool.id)) {
    await assert.rejects(
      () => service.runReadCommand({ threadId: thread.id, toolId, args: { opportunityId: "opp_a", subject: "x", body: "y" } }),
      (error) => error.code === "command_not_readable",
      `${toolId} must not be reachable as a read command`
    );
  }

  const view = await service.getThread(thread.id);
  assert.equal(view.proposals.length, 0, "no proposal may exist");
  const runs = await repository.listAssistantToolRuns(thread.id, "team_a");
  assert.equal(runs.length, 0, "a refused command never executes");
});

test("an unregistered tool fails closed", async () => {
  const { service } = build();
  const thread = await service.createThread({});
  for (const toolId of ["shell", "database", "sql", "http", "fs.read", "", "   "]) {
    await assert.rejects(() => service.runReadCommand({ threadId: thread.id, toolId, args: {} }), `${toolId.trim() || "(blank)"} must be rejected`);
  }

  // Surrounding whitespace is normalized rather than rejected — a stray space
  // from a paste should not read as an attack.
  const trimmed = await service.runReadCommand({ threadId: thread.id, toolId: "  home.get_snapshot  ", args: {} });
  assert.equal(trimmed.toolId, "home.get_snapshot");
});

test("a client-supplied teamId is a validation error, not a silently ignored field", async () => {
  const { service } = build();
  const thread = await service.createThread({});
  await assert.rejects(
    () => service.runReadCommand({ threadId: thread.id, toolId: "core.search", args: { query: "x", teamId: "team_b" } }),
    (error) => error.code === "unknown_argument"
  );
  await assert.rejects(
    () => service.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: { teamId: "team_b" } }),
    (error) => error.code === "unknown_argument"
  );
});

test("role isolation holds: a viewer reads, but still cannot reach a prepare tool", async () => {
  const { service } = build({ role: "viewer" });
  const thread = await service.createThread({});

  const result = await service.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: {} });
  assert.ok(result.summary, "viewers may read — READ_ROLES includes viewer");

  await assert.rejects(
    () => service.runReadCommand({ threadId: thread.id, toolId: "message.prepare_followup", args: { opportunityId: "opp_a", subject: "x", body: "y" } }),
    (error) => error.code === "command_not_readable" || error.status === 403
  );
});

test("another user's thread is invisible, and team never comes from the caller", async () => {
  const { service, repository } = build();
  const thread = await service.createThread({});

  const other = new AssistantService({
    teamId: "team_a", actor: { id: "someone_else", role: "owner" }, repository, adapter: null,
    services: { home: null, worklog: null }, now: NOW, idFactory: repository.__ids, rateLimiter: () => ({ allowed: true }),
  });
  await assert.rejects(
    () => other.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: {} }),
    (error) => error.code === "thread_forbidden"
  );
  await assert.rejects(
    () => service.runReadCommand({ threadId: "thread_does_not_exist", toolId: "home.get_snapshot", args: {} }),
    (error) => error.code === "thread_not_found"
  );
});

// -------------------------------------------------------------- budgets

test("read commands have their own rate bucket, separate from model turns", async () => {
  const keys = [];
  const { service } = build({
    rateLimiter: (key) => { keys.push(key); return { allowed: true }; },
  });
  const thread = await service.createThread({});
  await service.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: {} });

  assert.ok(keys.some((key) => key.startsWith("chat:command:")), "reads use the command bucket");
  assert.ok(!keys.some((key) => key.startsWith("chat:turn:")), "reads must not consume the model-turn allowance");
  assert.ok(TURN_LIMITS.readCommandsPerMinute > TURN_LIMITS.turnsPerMinute, "deterministic reads get a larger budget than model turns");
});

test("the command rate limit is enforced", async () => {
  const { service } = build({ rateLimiter: () => ({ allowed: false, retryAfterSeconds: 12 }) });
  const thread = await service.createThread({});
  await assert.rejects(
    () => service.runReadCommand({ threadId: thread.id, toolId: "home.get_snapshot", args: {} }),
    (error) => error.status === 429 && error.code === "rate_limited"
  );
});

// --------------------------------------------------------- source guards

// Comments explain these choices and naturally name the things being asserted
// against, so source guards compare against code lines only.
const stripComments = (source) =>
  source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
  }).join("\n");

test("the commands route is authenticated and cannot widen its own reach", async () => {
  const route = stripComments(await read("app", "api", "core", "chat", "commands", "route.js"));
  assert.match(route, /requireSession/, "the route is session-gated");
  assert.match(route, /getSessionTeamId/, "team comes from the session");
  assert.doesNotMatch(route, /requireCoreWrite/, "read commands must not demand the write role — viewers can already read");
  assert.doesNotMatch(route, /teamId:\s*(String\()?body/, "team must never be taken from the request body");

  const code = stripComments(await read("lib", "stage6", "assistantService.js"));
  assert.match(code, /classification !== "read"/, "the read-only gate must exist in the service, not the route");
  assert.match(code, /chat:command:/, "the separate rate bucket must exist");
});

test("the terminal surface renders no raw HTML and keeps the confirmation honest", async () => {
  // Comments explain why these patterns are absent, so they naturally name
  // them — compare against code lines only.
  const surface = stripComments(await read("components", "core", "terminal", "TerminalSurface.jsx"));
  const blocks = stripComments(await read("components", "core", "terminal", "TerminalBlocks.jsx"));

  for (const [name, source] of [["TerminalSurface", surface], ["TerminalBlocks", blocks]]) {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${name} must not render raw HTML`);
    // The prior art exposed window.__cmd purely so onclick="" strings inside
    // innerHTML panels could work. React onClick removes the whole category.
    assert.doesNotMatch(source, /window\.__cmd|innerHTML/, `${name} must not use the global command bridge`);
  }

  assert.match(blocks, /Nothing has happened yet/, "the terminal proposal says nothing has executed");
  assert.match(surface, /AbortController|abort\(/, "a running turn must be cancellable");
  assert.match(surface, /aria-live/, "terminal output needs a live region");
  assert.match(surface, /role="log"/, "terminal output is a log");
  assert.match(surface, /aria-label="Terminal command"/, "the input is labelled");

  // Tab must only be swallowed when there is a completion to offer, else the
  // input is a keyboard trap.
  assert.match(surface, /if \(result\.completion\)[\s\S]{0,80}preventDefault/, "Tab completes only when there is a match");

  // No typed confirmation: "confirmation is a UI button" stays literally true.
  assert.doesNotMatch(surface, /case "confirm"/, "there must be no typed confirm command");
});

test("cancel stays reachable while a turn is running", async () => {
  const surface = stripComments(await read("components", "core", "terminal", "TerminalSurface.jsx"));

  // A disabled input fires no keydown and loses focus, so ⌃C — which the boot
  // banner and the hint line both advertise — would silently do nothing for the
  // entire time it is the only thing worth pressing. readOnly keeps focus.
  assert.doesNotMatch(surface, /disabled=\{busy\}/, "the terminal input must not be disabled while busy");
  assert.match(surface, /readOnly=\{busy\}/, "the terminal input is readOnly, not disabled, while busy");

  // ...and the handler must actually act on ⌃C in the busy branch rather than
  // fall through to the not-busy path, which returns early on every key.
  // Scoped to onKeyDown — runLocal's `cancel` case opens with the same
  // `if (busy) {`, and it is the keyboard path that was broken.
  const handler = surface.match(/const onKeyDown = useCallback\([\s\S]*?\n  \}, \[/);
  assert.ok(handler, "onKeyDown exists");
  const busyBranch = handler[0].match(/if \(busy\) \{[\s\S]*?\n    \}/);
  assert.ok(busyBranch, "onKeyDown has an explicit busy branch");
  assert.match(busyBranch[0], /event\.ctrlKey && \(event\.key === "c"/, "⌃C is handled while busy");
  assert.match(busyBranch[0], /abort\(\)/, "⌃C aborts while busy");

  // Nothing that would edit or submit may get through while a turn is running.
  assert.match(busyBranch[0], /event\.key === "Enter"[\s\S]{0,120}preventDefault/, "Enter is swallowed while busy");
});

test("the chat composer clears itself after a send", async () => {
  // The draft moved up to ChatWorkspace so it survives a mode switch, which
  // took it out of useChatSession's reach — the old send() cleared it itself.
  // Without this the sent text stays in the box and is trivially sent twice.
  const surface = stripComments(await read("components", "core", "ChatSurface.jsx"));
  const submit = surface.match(/onSubmit=\{\(event\) => \{[\s\S]*?\n        \}\}/);
  assert.ok(submit, "the composer has a submit handler");
  assert.match(submit[0], /onDraftChange\(""\)/, "the composer clears the draft on submit");
  assert.match(submit[0], /if \(!text \|\| busy/, "an empty or in-flight submit is still refused");

  const hook = stripComments(await read("components", "core", "useChatSession.js"));
  assert.doesNotMatch(hook, /setDraft/, "the session hook must not own the composer draft");
});

test("demo data is isolated and obviously fictional", async () => {
  const demoSource = await read("components", "core", "terminal", "demoData.js");
  const { DEMO_COMPANIES, DEMO_OPPORTUNITIES, DEMO_ACTIVITY, DEMO_EXCEPTIONS } = await import("../components/core/terminal/demoData.js");

  // It imports nothing at all, so there is no path from a fixture to the API.
  assert.doesNotMatch(demoSource, /^import\s/m, "demoData must not import anything");
  assert.doesNotMatch(demoSource, /fetch\(|\/api\//, "demoData must not reference the API");

  for (const record of [...DEMO_COMPANIES, ...DEMO_OPPORTUNITIES, ...DEMO_ACTIVITY, ...DEMO_EXCEPTIONS]) {
    assert.equal(record.demo, true, "every demo record is tagged");
  }
  // The prior art's fixtures were named after real DGTL clients, which is how a
  // screenshot ends up asserting something false about a real business.
  const serialized = JSON.stringify([...DEMO_COMPANIES, ...DEMO_OPPORTUNITIES]);
  for (const real of ["DMTV", "Ledger", "Six Senses", "Ibiza"]) {
    assert.doesNotMatch(serialized, new RegExp(real, "i"), `demo data must not name ${real}`);
  }

  // The session hook refuses every server call while demo mode is latched.
  const hook = stripComments(await read("components", "core", "useChatSession.js"));
  assert.match(hook, /demo session cannot reach the DGTL API/, "the hook must hard-refuse API calls in demo mode");
  for (const method of ["send", "runRead", "confirm"]) {
    assert.match(hook, new RegExp(`${method}\\s*=\\s*useCallback`), `${method} exists`);
  }
});

test("terminal history persistence never stores business data", async () => {
  const surface = stripComments(await read("components", "core", "terminal", "TerminalSurface.jsx"));
  assert.match(surface, /dgtl\.terminal\.v1/, "one namespaced storage key");
  // Only mode + history may be written.
  const writes = surface.match(/writeStore\(\{[^}]*\}/g) || [];
  assert.ok(writes.length > 0, "history is persisted");
  for (const write of writes) {
    assert.match(write, /history/, `writeStore should only carry history: ${write}`);
    for (const key of ["messages", "proposals", "sourceRefs", "threadId", "content"]) {
      assert.doesNotMatch(write, new RegExp(key), `${key} must never be persisted`);
    }
  }
});

test("nothing in the terminal fabricates a tool log or leaks a secret", async () => {
  for (const file of [
    ["components", "core", "terminal", "commandGrammar.js"],
    ["components", "core", "terminal", "TerminalSurface.jsx"],
    ["components", "core", "ChatWorkspace.jsx"],
    ["lib", "stage6", "summarizeToolResult.js"],
  ]) {
    const source = await read(...file);
    assert.doesNotMatch(source, /ANTHROPIC|api[_-]?key|sk-ant/i, `${file.join("/")} must not mention credentials`);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file.join("/")} must not render raw HTML`);
    // The prior art printed four invented tool-call lines during `proposal`.
    for (const fake of ["brand_research", "proposal_template", "deck_outline"]) {
      assert.doesNotMatch(source, new RegExp(fake), `${file.join("/")} must not fabricate a tool log`);
    }
  }
});
