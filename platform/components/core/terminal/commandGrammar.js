// The DGTL.chat terminal command grammar.
//
// Deliberately pure — no JSX, no "use client", no fetch — so `node --test` can
// import it directly and the parser is provable without a browser.
//
// parseCommand returns one of four kinds, and the split is the whole design:
//
//   local   rendered in the browser. No network, no cost.
//   read    POST /api/core/chat/commands -> a registry READ tool. Deterministic,
//           no model, no tokens. Works with no AI provider configured at all.
//   turn    POST .../turns -> a real model turn. The only kind that spends money,
//           and every one of them is announced before it runs.
//   unknown REFUSED. The prior art (apps/dgtl-os/terminal.html:511) forwarded any
//           unrecognised line straight to the model, so a typo silently bought an
//           LLM call. Here a typo costs nothing and asks first.

// ---------------------------------------------------------------- tokenizer

// Splits on whitespace, keeps "double quoted strings" whole, and understands
// --flag value / --flag=value. Returns { words, flags } or { error }.
export function tokenize(line) {
  const text = String(line ?? "");
  const raw = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    raw.push(match[1] !== undefined ? { value: match[1], quoted: true } : { value: match[2], quoted: false });
  }
  if ((text.match(/"/g) || []).length % 2 === 1) {
    return { error: "unbalanced quote — close the \" before pressing enter" };
  }

  const words = [];
  const flags = {};
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (!token.quoted && token.value.startsWith("--")) {
      const body = token.value.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        const name = body.slice(0, eq);
        if (!name) return { error: `malformed flag: ${token.value}` };
        flags[name] = body.slice(eq + 1);
        continue;
      }
      if (!body) return { error: "malformed flag: --" };
      const next = raw[i + 1];
      // A flag with no value is an error, never a silently-dropped argument.
      if (!next || (!next.quoted && next.value.startsWith("--"))) {
        return { error: `--${body} needs a value` };
      }
      flags[body] = next.value;
      i += 1;
      continue;
    }
    words.push(token.value);
  }
  return { words, flags };
}

// ------------------------------------------------------------ command table

// One row per command. `kind` drives dispatch; `build` turns tokens into either
// tool args (read) or the message text sent to the model (turn).
//
// Every read row's tool MUST be classification "read" in lib/stage6/toolRegistry.js.
// stage6-terminal-grammar.test.js asserts the read set equals the 12 READ tools
// exactly, so adding a tool without wiring it here fails the build.
// No `usage` here — helpRows derives "<head> <id|#n>" so the command name is
// never lost when this is spread into a row.
const ENTITY_ARG = (argName) => ({
  build: ({ words }, ctx) => {
    const target = resolveRef(words[0], ctx);
    if (!target) return { error: `needs an id or a #n from the last results — e.g. ${argName === "companyId" ? "company #2" : "#1"}` };
    return { args: { [argName]: target } };
  },
});

export const COMMANDS = [
  // ------------------------------------------------------------ local
  { head: "help", kind: "local", action: "help", usage: "help [command]", summary: "this reference" },
  { head: "clear", kind: "local", action: "clear", summary: "clear the display (the thread is untouched)" },
  { head: "history", kind: "local", action: "history", usage: "history [clear]", summary: "recent commands" },
  { head: "mode", kind: "local", action: "mode", usage: "mode chat|terminal", summary: "switch surface" },
  { head: "exit", kind: "local", action: "mode", summary: "back to chat view", fixedWords: ["chat"] },
  { head: "whoami", kind: "local", action: "whoami", summary: "your role and the provider state" },
  { head: "proposals", kind: "local", action: "proposals", summary: "open proposals awaiting your confirmation" },
  { head: "refs", kind: "local", action: "refs", summary: "re-list the last numbered results" },
  { head: "cancel", kind: "local", action: "cancel", summary: "cancel a running turn (same as ⌃C)" },
  { head: "demo", kind: "local", action: "demo", usage: "demo [exit]", summary: "scripted demo session — not your data" },

  // ------------------------------------------------------------- read
  { head: "home", kind: "read", toolId: "home.get_snapshot", summary: "the operating snapshot", build: () => ({ args: {} }) },
  { head: "attention", kind: "read", toolId: "home.get_snapshot", alias: "home", build: () => ({ args: {} }) },
  {
    head: "search",
    kind: "read",
    toolId: "core.search",
    usage: "search <text…>",
    summary: "resolve a name to canonical records",
    build: ({ words }) => {
      const query = words.join(" ").trim();
      if (!query) return { error: "search needs something to look for" };
      if (query.length > 120) return { error: "search query is limited to 120 characters" };
      return { args: { query } };
    },
  },
  { head: "find", kind: "read", toolId: "core.search", alias: "search", build: (tokens) => COMMANDS.find((c) => c.head === "search").build(tokens) },
  { head: "company", kind: "read", toolId: "company.get", summary: "a company and its graph", ...ENTITY_ARG("companyId") },
  { head: "opp", kind: "read", toolId: "opportunity.get", summary: "an opportunity", ...ENTITY_ARG("opportunityId"), sub: { activity: { toolId: "opportunity.get_activity", summary: "recent activity on one opportunity" } } },
  { head: "opportunity", kind: "read", toolId: "opportunity.get", alias: "opp", ...ENTITY_ARG("opportunityId"), sub: { activity: { toolId: "opportunity.get_activity" } } },
  { head: "campaign", kind: "read", toolId: "campaign.get", summary: "a campaign and its messages", ...ENTITY_ARG("campaignId"), sub: { status: { toolId: "campaign.get_status", summary: "campaign counts only" } } },
  { head: "job", kind: "read", toolId: "generation.get_job", summary: "a generation job", ...ENTITY_ARG("jobId") },
  { head: "generation", kind: "read", toolId: "generation.get_job", alias: "job", ...ENTITY_ARG("jobId") },
  { head: "artifact", kind: "read", toolId: "artifact.get", summary: "an artifact version", ...ENTITY_ARG("artifactId") },
  { head: "delivery", kind: "read", toolId: "worklog.get_delivery_summary", summary: "stored Worklog delivery state", ...ENTITY_ARG("opportunityId") },
  { head: "exceptions", kind: "read", toolId: "operations.list_exceptions", summary: "open operational exceptions", build: () => ({ args: {} }) },
  { head: "activity", kind: "read", toolId: "activity.list_recent", summary: "recent business activity", build: () => ({ args: {} }) },

  // ------------------------------------------------------------- turn
  {
    head: "ask",
    kind: "turn",
    usage: "ask <question…>",
    summary: "ask DGTL in prose (model turn)",
    build: ({ words }) => {
      const question = words.join(" ").trim();
      if (!question) return { error: "ask needs a question" };
      return { message: question };
    },
  },
  {
    head: "prepare",
    kind: "turn",
    usage: "prepare followup|pitch|handoff|next-action <id|#n> [--flags]",
    summary: "propose an action for you to confirm (model turn)",
    build: (tokens, ctx) => buildPrepare(tokens, ctx),
  },
];

// Heads that look plausible but map to nothing in the 16-tool registry. Naming
// them explicitly beats a generic "unknown command" — the terminal's prior art
// advertised eighteen namespaces, nine of which did nothing at all.
export const NOT_A_TOOL = {
  research: "no research tool exists in Core — try `search <name>` or `ask`",
  proposal: "proposals come from `prepare …`; run `proposals` to list open ones",
  creator: "no creator tool exists in Core — try `search <name>`",
  client: "DGTL Core calls these companies — try `company #n` or `search <name>`",
  funding: "no funding tool exists in Core",
  deck: "no deck tool exists in Core",
  website: "no website tool exists in Core",
  team: "no team tool exists in Core — `whoami` shows your own role",
  config: "chat providers are server configuration; `whoami` reports the state",
  analytics: "no analytics tool exists in Core — try `home`",
};

const BY_HEAD = new Map();
for (const command of COMMANDS) if (!BY_HEAD.has(command.head)) BY_HEAD.set(command.head, command);

export const READ_TOOL_IDS = Object.freeze([...new Set(COMMANDS.filter((c) => c.kind === "read").flatMap((c) => [c.toolId, ...Object.values(c.sub || {}).map((s) => s.toolId)]))]);

// ------------------------------------------------------------------- refs

// `#3` resolves against the last numbered result set. The index maps to an id
// that came from a real tool result, so a typed reference can never invent an
// entity — the same guarantee the model has via SourceRefs.
function resolveRef(word, ctx) {
  const value = String(word || "").trim();
  if (!value) return "";
  const hash = value.match(/^#(\d+)$/);
  if (!hash) return value;
  const index = Number(hash[1]) - 1;
  const hit = (ctx?.refs || [])[index];
  return hit?.id || "";
}

// ----------------------------------------------------------- prepare verbs

const PREPARE_VERBS = {
  followup: {
    tool: "message.prepare_followup",
    describe: (id, flags) =>
      `Prepare a follow-up email for opportunity ${id}${flags.contact ? ` to contact ${flags.contact}` : ""}. ` +
      `${flags.about ? `Focus on: ${flags.about}. ` : ""}Write the subject and body yourself, then present it as a proposal for me to confirm.`,
  },
  pitch: {
    tool: "generation.prepare_asset",
    require: ["slug"],
    describe: (id, flags) =>
      `Prepare a pitch generation request for opportunity ${id} with slug "${flags.slug}"` +
      `${flags.cta ? `, call to action "${flags.cta}"` : ""}${flags.notes ? `. Instructions: ${flags.notes}` : ""}. Present it as a proposal for me to confirm.`,
  },
  handoff: {
    tool: "worklog.prepare_handoff",
    describe: (id, flags) =>
      `Prepare the Worklog delivery handoff for opportunity ${id}` +
      `${flags["budget-minutes"] ? ` with a budget of ${flags["budget-minutes"]} minutes` : ""}. Present it as a proposal for me to confirm.`,
  },
  "next-action": {
    tool: "opportunity.prepare_next_action",
    require: ["do", "by"],
    describe: (id, flags) => `Prepare a next-action update for opportunity ${id}: set the next action to "${flags.do}" due ${flags.by}. Present it as a proposal for me to confirm.`,
  },
};

function buildPrepare({ words, flags }, ctx) {
  const verb = String(words[0] || "").toLowerCase();
  if (!verb) return { error: `prepare needs a verb: ${Object.keys(PREPARE_VERBS).join(", ")}` };
  const spec = PREPARE_VERBS[verb];
  if (!spec) return { error: `unknown prepare verb "${verb}" — try ${Object.keys(PREPARE_VERBS).join(", ")}` };

  const target = resolveRef(words[1], ctx);
  if (!target) return { error: `prepare ${verb} needs an opportunity id or a #n from the last results` };

  for (const required of spec.require || []) {
    if (!flags[required]) return { error: `prepare ${verb} needs --${required}` };
  }
  if (verb === "next-action" && !/^\d{4}-\d{2}-\d{2}/.test(flags.by || "")) {
    return { error: "--by must be a date like 2026-09-01" };
  }
  return { message: spec.describe(target, flags), toolHint: spec.tool };
}

// ------------------------------------------------------------------ parse

/**
 * Parse one input line.
 * @param {string} line
 * @param {{refs?: Array<{id: string}>}} ctx  the last numbered result set, for #n
 * @returns {{kind: "empty"|"local"|"read"|"turn"|"unknown"|"error", …}}
 */
export function parseCommand(line, ctx = {}) {
  const text = String(line ?? "").trim();
  if (!text) return { kind: "empty" };

  const tokens = tokenize(text);
  if (tokens.error) return { kind: "error", message: tokens.error, line: text };

  const [rawHead, ...rest] = tokens.words;
  const head = String(rawHead || "").toLowerCase();
  const command = BY_HEAD.get(head);

  if (!command) {
    const hint = NOT_A_TOOL[head];
    return {
      kind: "unknown",
      head,
      line: text,
      message: hint || `not a command: ${head}`,
      // The second Enter turns this into `ask <line>`; see TerminalSurface.
      askable: true,
    };
  }

  if (command.kind === "local") {
    return { kind: "local", head, action: command.action, args: command.fixedWords || rest, line: text };
  }

  // A read command may have a sub-verb (opp activity, campaign status).
  let toolId = command.toolId;
  let words = rest;
  if (command.sub && rest.length) {
    const sub = command.sub[String(rest[0]).toLowerCase()];
    if (sub) {
      toolId = sub.toolId;
      words = rest.slice(1);
    }
  }

  const built = command.build({ words, flags: tokens.flags }, ctx);
  if (built.error) return { kind: "error", message: `${head}: ${built.error}`, line: text };

  if (command.kind === "read") return { kind: "read", head, toolId, args: built.args, line: text };
  return { kind: "turn", head, message: built.message, toolHint: built.toolHint, line: text };
}

// ------------------------------------------------------------- completion

const TOP = Object.freeze([...new Set(COMMANDS.map((c) => c.head))].sort());

/**
 * Tab completion. Returns { completion } for a single unambiguous match,
 * { candidates } when several match, or {} when there is nothing to offer —
 * and the caller MUST let Tab move focus in that last case (WCAG 2.1.2).
 */
export function completions(line) {
  const text = String(line ?? "");
  if (!text.trim()) return {};

  const parts = text.split(/\s+/);
  const trailingSpace = /\s$/.test(text);

  if (parts.length === 1 && !trailingSpace) {
    const matches = TOP.filter((head) => head.startsWith(parts[0].toLowerCase()));
    if (matches.length === 1) return { completion: `${matches[0]} ` };
    if (matches.length > 1) return { candidates: matches };
    return {};
  }

  const command = BY_HEAD.get(String(parts[0]).toLowerCase());
  if (!command) return {};

  const subs = command.head === "prepare" ? Object.keys(PREPARE_VERBS) : Object.keys(command.sub || {});
  if (!subs.length) return {};

  const partial = trailingSpace ? "" : String(parts[1] || "").toLowerCase();
  if (parts.length > 2 || (parts.length === 2 && trailingSpace)) return {};

  const matches = subs.filter((sub) => sub.startsWith(partial)).sort();
  if (matches.length === 1) return { completion: `${parts[0]} ${matches[0]} ` };
  if (matches.length > 1) return { candidates: matches };
  return {};
}

// ------------------------------------------------------------------- help

// help renders from COMMANDS itself, so the reference cannot drift from the
// implementation the way a hand-maintained list does.
export function helpRows() {
  const rows = COMMANDS.filter((command) => !command.alias).map((command) => ({
    kind: command.kind,
    usage: command.usage || (command.build && command.build.length ? `${command.head} <id|#n>` : command.head),
    summary: command.summary || "",
    subs: Object.entries(command.sub || {}).map(([verb, spec]) => ({ usage: `${command.head} ${verb} <id|#n>`, summary: spec.summary || "" })),
  }));
  return rows;
}
