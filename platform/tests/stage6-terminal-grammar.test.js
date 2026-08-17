import test from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, NOT_A_TOOL, READ_TOOL_IDS, completions, helpRows, parseCommand, tokenize } from "../components/core/terminal/commandGrammar.js";
import { TOOLS, TOOL_INDEX } from "../lib/stage6/toolRegistry.js";

// The terminal command grammar. Pure module, so these run with no browser, no
// database and no provider.
//
// The load-bearing test in this file is "read commands map onto exactly the
// registry's READ tools": it is what stops the deterministic command route from
// quietly growing reach beyond what the model already had.

const REGISTRY_READ_IDS = TOOLS.filter((tool) => tool.classification === "read").map((tool) => tool.id);

const ctx = { refs: [{ id: "opp_first" }, { id: "opp_second" }, { id: "cmp_third" }] };

test("read commands map onto exactly the registry's READ tools", () => {
  assert.deepEqual([...READ_TOOL_IDS].sort(), [...REGISTRY_READ_IDS].sort(),
    "every READ tool needs a command, and no command may reach anything else");
  assert.equal(REGISTRY_READ_IDS.length, 12, "Stage 6 defines 12 read tools");

  for (const toolId of READ_TOOL_IDS) {
    assert.ok(TOOL_INDEX[toolId], `${toolId} must exist in the registry`);
    assert.equal(TOOL_INDEX[toolId].classification, "read", `${toolId} must be classification "read"`);
  }
});

test("no read command can reach a prepare tool", () => {
  const prepareIds = TOOLS.filter((tool) => tool.classification === "prepare").map((tool) => tool.id);
  for (const id of prepareIds) {
    assert.ok(!READ_TOOL_IDS.includes(id), `${id} is a prepare tool and must never be reachable as a read command`);
  }
  // And nothing outside the registry at all.
  for (const command of COMMANDS.filter((c) => c.kind === "read")) {
    assert.ok(TOOL_INDEX[command.toolId], `${command.head} points at an unregistered tool`);
  }
});

test("parses the read commands into validated tool calls", () => {
  const cases = [
    ["home", "home.get_snapshot", {}],
    ["attention", "home.get_snapshot", {}],
    ["exceptions", "operations.list_exceptions", {}],
    ["activity", "activity.list_recent", {}],
    ["search Lanternworks rebuild", "core.search", { query: "Lanternworks rebuild" }],
    ["find Lanternworks", "core.search", { query: "Lanternworks" }],
    ["company cmp_42", "company.get", { companyId: "cmp_42" }],
    ["opp opp_7", "opportunity.get", { opportunityId: "opp_7" }],
    ["opportunity opp_7", "opportunity.get", { opportunityId: "opp_7" }],
    ["opp activity opp_7", "opportunity.get_activity", { opportunityId: "opp_7" }],
    ["campaign cmp_9", "campaign.get", { campaignId: "cmp_9" }],
    ["campaign status cmp_9", "campaign.get_status", { campaignId: "cmp_9" }],
    ["job job_1", "generation.get_job", { jobId: "job_1" }],
    ["generation job_1", "generation.get_job", { jobId: "job_1" }],
    ["artifact art_1", "artifact.get", { artifactId: "art_1" }],
    ["delivery opp_7", "worklog.get_delivery_summary", { opportunityId: "opp_7" }],
  ];
  for (const [line, toolId, args] of cases) {
    const parsed = parseCommand(line, ctx);
    assert.equal(parsed.kind, "read", `${line} should be a read command, got ${parsed.kind}: ${parsed.message || ""}`);
    assert.equal(parsed.toolId, toolId, line);
    assert.deepEqual(parsed.args, args, line);
  }
});

test("#n resolves against the last numbered results, and only against them", () => {
  assert.deepEqual(parseCommand("opp #1", ctx).args, { opportunityId: "opp_first" });
  assert.deepEqual(parseCommand("opp #2", ctx).args, { opportunityId: "opp_second" });
  assert.deepEqual(parseCommand("company #3", ctx).args, { companyId: "cmp_third" });

  // Out of range and no-result-set both fail rather than inventing an id.
  assert.equal(parseCommand("opp #9", ctx).kind, "error");
  assert.equal(parseCommand("opp #1", { refs: [] }).kind, "error");
});

test("local commands never touch the network", () => {
  for (const line of ["help", "clear", "history", "history clear", "mode terminal", "exit", "whoami", "proposals", "refs", "cancel", "demo", "demo exit"]) {
    assert.equal(parseCommand(line, ctx).kind, "local", line);
  }
  assert.deepEqual(parseCommand("exit", ctx).args, ["chat"], "exit is mode chat");
});

test("an unknown command is refused, never forwarded to the model", () => {
  // The bug this prevents: apps/dgtl-os/terminal.html:511 sent any unrecognised
  // line straight to the LLM, so a typo bought a billable call.
  const typo = parseCommand("reserch Lanternworks", ctx);
  assert.equal(typo.kind, "unknown");
  assert.equal(typo.askable, true, "the user can still opt in with a second Enter");
  assert.notEqual(typo.kind, "turn", "a typo must never become a model turn on its own");

  // Plausible-sounding heads that map to nothing get a specific hint.
  for (const head of Object.keys(NOT_A_TOOL)) {
    const parsed = parseCommand(`${head} something`, ctx);
    assert.equal(parsed.kind, "unknown", head);
    assert.equal(parsed.message, NOT_A_TOOL[head], `${head} should explain what to use instead`);
  }
  assert.match(parseCommand("research Acme", ctx).message, /no research tool exists/);
});

test("turn commands are the only ones that spend tokens, and they carry the resolved id", () => {
  const ask = parseCommand("ask what needs attention today", ctx);
  assert.equal(ask.kind, "turn");
  assert.equal(ask.message, "what needs attention today", "ask sends the question verbatim");

  const followup = parseCommand('prepare followup #1 --about "the September rebuild"', ctx);
  assert.equal(followup.kind, "turn");
  assert.equal(followup.toolHint, "message.prepare_followup");
  assert.match(followup.message, /opp_first/, "the resolved canonical id is what reaches the model");
  assert.match(followup.message, /the September rebuild/);

  const pitch = parseCommand("prepare pitch #2 --slug acme-pitch --cta Book", ctx);
  assert.equal(pitch.kind, "turn");
  assert.match(pitch.message, /acme-pitch/);

  const nextAction = parseCommand('prepare next-action #1 --do "call the CFO" --by 2026-09-01', ctx);
  assert.equal(nextAction.kind, "turn");
  assert.match(nextAction.message, /call the CFO/);

  for (const tool of Object.values({ f: followup, p: pitch, n: nextAction })) {
    assert.ok(TOOL_INDEX[tool.toolHint], "a prepare command names a real registry tool");
    assert.equal(TOOL_INDEX[tool.toolHint].classification, "prepare");
  }
});

test("missing or malformed arguments are parse errors, not turns", () => {
  const cases = [
    "search",
    "opp",
    "company",
    "prepare",
    "prepare nonsense #1",
    "prepare pitch #1",              // --slug is required
    "prepare next-action #1 --do x", // --by is required
    'prepare next-action #1 --do x --by soon',
    "ask",
  ];
  for (const line of cases) {
    const parsed = parseCommand(line, ctx);
    assert.equal(parsed.kind, "error", `${line} should be an error, got ${parsed.kind}`);
    assert.ok(parsed.message, `${line} should explain itself`);
  }
  assert.equal(parseCommand("", ctx).kind, "empty");
  assert.equal(parseCommand("   ", ctx).kind, "empty");
});

test("tokenizer keeps quoted strings whole and rejects a flag with no value", () => {
  assert.deepEqual(tokenize('prepare followup #1 --about "two words"').flags, { about: "two words" });
  assert.deepEqual(tokenize("prepare pitch #1 --slug=acme").flags, { slug: "acme" });
  assert.deepEqual(tokenize('search "a b c"').words, ["search", "a b c"]);

  assert.match(tokenize("prepare pitch #1 --slug").error, /needs a value/);
  assert.match(tokenize("prepare pitch #1 --slug --cta x").error, /needs a value/);
  assert.match(tokenize('search "unclosed').error, /unbalanced quote/);
});

test("completion offers matches and, crucially, gives up cleanly", () => {
  assert.equal(completions("hom").completion, "home ");
  assert.ok(completions("c").candidates.length > 1, "an ambiguous prefix lists candidates");
  assert.equal(completions("opp ").candidates || completions("opp a").completion, "opp activity ");
  assert.equal(completions("prepare fo").completion, "prepare followup ");

  // Nothing to offer must return {} so the caller lets Tab move focus —
  // otherwise the input is a keyboard trap (WCAG 2.1.2).
  assert.deepEqual(completions(""), {});
  assert.deepEqual(completions("   "), {});
  assert.deepEqual(completions("zzzz"), {});
  assert.deepEqual(completions("home extra args here"), {});
});

test("help is generated from the command table, so it cannot drift", () => {
  const rows = helpRows();
  const usages = rows.map((row) => row.usage).join("\n");
  assert.ok(rows.length >= 15, "every non-alias command is documented");
  for (const head of ["home", "search", "opp", "campaign", "prepare", "ask", "demo"]) {
    assert.match(usages, new RegExp(`\\b${head}\\b`), `${head} must appear in help`);
  }
  assert.ok(rows.every((row) => ["local", "read", "turn"].includes(row.kind)), "help labels what each command costs");
  assert.ok(rows.some((row) => row.subs.some((sub) => sub.usage === "opp activity <id|#n>")), "sub-verbs are documented too");
});
