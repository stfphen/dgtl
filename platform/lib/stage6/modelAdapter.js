/**
 * ChatModelAdapter: the one bounded provider abstraction. The rest of Core
 * never sees vendor response objects — an adapter returns either
 *   { type: "tool_call", toolId, args }        (request ONE registered tool)
 * or
 *   { type: "final", content }                 (the grounded answer)
 * from completeTurn({ system, messages, tools }), where messages is a
 * provider-neutral transcript: { role: "user"|"assistant"|"tool_result",
 * content, toolId? }.
 *
 * Adapters available:
 *  - deterministic: a rule-based planner with zero external dependencies. It
 *    is the acceptance authority for tests, rehearsals, and CI, and lets the
 *    whole /chat surface run with no AI provider configured.
 *  - scripted: test-only, replays an exact step list.
 *  - anthropic: the single optional real provider, using the Claude SDK the
 *    platform already ships. Server-side key, fixed endpoint (no browser or
 *    model influence over the URL), bounded tokens, timeout, one retry.
 *
 * Provider states: configured | unconfigured | healthy | degraded |
 * unavailable | disabled. An unconfigured provider is not a platform failure.
 */

const OUTPUT_CHAR_CAP = 8000;

const clampText = (value, cap = OUTPUT_CHAR_CAP) => {
  const text = String(value ?? "");
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
};

// ---------------------------------------------------------------- scripted

export function createScriptedAdapter(steps = [], { id = "scripted-test" } = {}) {
  let cursor = 0;
  return {
    id, model: "scripted-test-model", availability: "configured", supportsTools: true,
    async completeTurn(input) {
      const step = steps[cursor] ?? { type: "final", content: "Scripted adapter exhausted." };
      cursor += 1;
      if (typeof step === "function") return step(input);
      return step;
    },
    async health() { return { state: "healthy", provider: id }; },
  };
}

// ------------------------------------------------------------ deterministic

/**
 * Rule-based planner over the registered tools. No model, no network. It
 * resolves entities through core.search, reads through the registered read
 * tools, and proposes prepare-actions with template content — enough to
 * exercise every Stage 6 boundary deterministically.
 */
export function createDeterministicAdapter({ id = "deterministic" } = {}) {
  return {
    id, model: "deterministic-rules", availability: "configured", supportsTools: true,
    async completeTurn({ messages, tools }) {
      const available = new Set(tools.map((tool) => tool.id));
      const userText = [...messages].reverse().find((message) => message.role === "user")?.content?.toLowerCase() || "";
      const toolResults = messages.filter((message) => message.role === "tool_result");
      const resultFor = (toolId) => [...toolResults].reverse().find((message) => message.toolId === toolId);
      const parsed = (message) => { try { return JSON.parse(message.content); } catch { return {}; } };
      const wants = (...words) => words.some((word) => userText.includes(word));
      const call = (toolId, args = {}) => (available.has(toolId) ? { type: "tool_call", toolId, args } : { type: "final", content: `The ${toolId} tool is not available to you.` });

      // Entity resolution first when the request names something specific.
      const needsEntity = wants("find ", "about ", "for ", "blocking", "follow-up", "followup", "handoff", "pitch", "next action", "deal", "stands");
      const searchDone = resultFor("core.search");
      const quoted = userText.match(/(?:find|about|for|with|blocking)\s+([a-z0-9][a-z0-9 &.-]{2,40}?)(?:[,.?!]|$| and | from | at )/);

      if (wants("attention", "today", "approvals waiting", "important today")) {
        const snapshotDone = resultFor("home.get_snapshot");
        if (!snapshotDone) return call("home.get_snapshot");
        const snapshot = parsed(snapshotDone);
        const attention = Array.isArray(snapshot.attention) ? snapshot.attention : [];
        const lines = attention.slice(0, 6).map((item) => `- [${item.severity}] ${item.title}`);
        return { type: "final", content: clampText(lines.length ? `Here is what needs attention right now:\n${lines.join("\n")}\nApprovals waiting: ${snapshot.approvals?.count ?? 0}.` : "Nothing needs your attention right now.") };
      }

      if (needsEntity && !searchDone && quoted) return call("core.search", { query: quoted[1].trim() });

      const proposalResult = toolResults.find((message) => { try { return JSON.parse(message.content).proposalId; } catch { return false; } });
      if (proposalResult) {
        const body = parsed(proposalResult);
        return { type: "final", content: clampText(`I prepared the action for your review: ${body.impactSummary || "see the proposal card"}. Nothing has happened yet — confirm it with the button to proceed.`) };
      }

      if (searchDone) {
        const results = parsed(searchDone).results || [];
        const opportunities = results.filter((result) => result.kind === "opportunity");
        const companies = results.filter((result) => result.kind === "company");
        if (!results.length) return { type: "final", content: "I could not find a matching DGTL record for that name." };

        if (wants("follow-up", "followup") && !resultFor("message.prepare_followup")) {
          const target = opportunities[0];
          if (!target) return { type: "final", content: "I found no opportunity to attach a follow-up to; open the company first." };
          if (!resultFor("opportunity.get")) return call("opportunity.get", { opportunityId: target.id });
          const graph = parsed(resultFor("opportunity.get"));
          const contact = (graph.contacts || []).find((row) => row.primary) || (graph.contacts || [])[0];
          if (!contact) return { type: "final", content: "That opportunity has no contact on record, so I cannot prepare a follow-up." };
          return call("message.prepare_followup", {
            opportunityId: target.id, contactId: contact.id,
            subject: `Following up on ${graph.opportunity?.name || target.title}`,
            body: `Hi ${contact.name || "there"},\n\nFollowing up on ${graph.opportunity?.name || target.title}. Would a short call this week work to move things forward?\n\nBest,\nDGTL`,
          });
        }
        if (wants("handoff", "delivery project") && !resultFor("worklog.prepare_handoff")) {
          const target = opportunities[0];
          if (!target) return { type: "final", content: "I found no opportunity to hand off." };
          return call("worklog.prepare_handoff", { opportunityId: target.id });
        }
        if (wants("pitch", "asset") && wants("create", "prepare", "generate") && !resultFor("generation.prepare_asset")) {
          const target = opportunities[0];
          if (!target) return { type: "final", content: "I found no opportunity to generate a pitch for." };
          const slug = (target.title || "pitch").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "pitch";
          return call("generation.prepare_asset", { opportunityId: target.id, slug: `${slug}-pitch`, intendedCta: "Book a discovery call" });
        }
        if (wants("next action") && !resultFor("opportunity.prepare_next_action")) {
          const target = opportunities[0];
          if (target) return call("opportunity.prepare_next_action", { opportunityId: target.id, nextAction: "Follow up", nextActionAt: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) });
        }
        if (wants("blocking", "delivery") && opportunities[0]) {
          if (!resultFor("opportunity.get")) return call("opportunity.get", { opportunityId: opportunities[0].id });
          if (!resultFor("worklog.get_delivery_summary")) return call("worklog.get_delivery_summary", { opportunityId: opportunities[0].id });
          const graph = parsed(resultFor("opportunity.get"));
          const delivery = parsed(resultFor("worklog.get_delivery_summary"));
          const failedJobs = (graph.generationJobs || []).filter((job) => ["failed", "validation_failed"].includes(job.status));
          const parts = [];
          if (!delivery.linked) parts.push("it is not linked to a Worklog delivery project yet");
          if (delivery.pendingOperations?.length) parts.push(`${delivery.pendingOperations.length} Worklog operation(s) are pending approval/execution`);
          if (failedJobs.length) parts.push(`generation job ${failedJobs[0].id} is ${failedJobs[0].status}`);
          if (delivery.snapshot?.overdueTasks) parts.push(`${delivery.snapshot.overdueTasks} delivery task(s) are overdue`);
          return { type: "final", content: clampText(parts.length ? `Blocking "${graph.opportunity?.name}": ${parts.join("; ")}.` : `Nothing appears to be blocking "${graph.opportunity?.name}" right now.`) };
        }
        // Generic entity answer.
        if (opportunities[0]) {
          if (!resultFor("opportunity.get")) return call("opportunity.get", { opportunityId: opportunities[0].id });
          const graph = parsed(resultFor("opportunity.get"));
          const opportunity = graph.opportunity || {};
          return { type: "final", content: clampText(`"${opportunity.name}" is in stage "${opportunity.stage}" (${opportunity.status}). Next action: ${opportunity.nextAction || "none"} ${opportunity.nextActionAt ? `due ${String(opportunity.nextActionAt).slice(0, 10)}` : ""}. ${graph.worklogLink ? "It has a linked Worklog delivery project." : "No Worklog delivery link yet."}`) };
        }
        if (companies[0]) {
          if (!resultFor("company.get")) return call("company.get", { companyId: companies[0].id });
          const graph = parsed(resultFor("company.get"));
          return { type: "final", content: clampText(`${graph.company?.name}: ${graph.opportunities?.length || 0} opportunit${(graph.opportunities?.length || 0) === 1 ? "y" : "ies"}, relationship "${graph.company?.relationshipStatus}".${(graph.research || []).length ? " Research on file was reviewed as data only." : ""}`) };
        }
        return { type: "final", content: clampText(`Closest matches: ${results.slice(0, 3).map((result) => `${result.title} (${result.kind})`).join(", ")}. Tell me which one you mean.`) };
      }

      if (wants("exception")) return resultFor("operations.list_exceptions") ? { type: "final", content: clampText(`Open exceptions: ${(parsed(resultFor("operations.list_exceptions")).exceptions || []).map((item) => item.summary).join("; ") || "none"}.`) } : call("operations.list_exceptions");
      if (wants("recent", "happened")) return resultFor("activity.list_recent") ? { type: "final", content: clampText(`Recent activity: ${(parsed(resultFor("activity.list_recent")).activity || []).slice(0, 5).map((item) => item.summary).join("; ") || "none"}.`) } : call("activity.list_recent");
      return { type: "final", content: "I can report on attention, today, approvals, entities, delivery, and exceptions, or prepare follow-ups, pitches, and Worklog handoffs for your confirmation. What would you like?" };
    },
    async health() { return { state: "healthy", provider: id }; },
  };
}

// -------------------------------------------------------------- anthropic

/**
 * Single optional real provider, delegating to the ONE shared Claude
 * transport (lib/ai/claudeBackend.js#runChatToolTurn — API-key path only;
 * the subscription/Agent-SDK path is deliberately not used for chat because
 * its bypassed-permission mode is not an acceptable substrate for a
 * client-defined tool loop). Server-side key, fixed endpoint, bounded.
 */
export function createAnthropicAdapter({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.CORE_CHAT_MODEL || "claude-sonnet-5", timeoutMs = 30_000, maxTokens = 1200 } = {}) {
  if (!apiKey) return null;
  return {
    id: "anthropic", model, availability: "configured", supportsTools: true,
    async completeTurn({ system, messages, tools }) {
      const { runChatToolTurn } = await import("../ai/claudeBackend.js");
      return runChatToolTurn({ system, messages, tools, model, timeoutMs, maxTokens });
    },
    async health() {
      return { state: "healthy", provider: "anthropic", note: "configured; liveness verified on first turn" };
    },
  };
}

// ------------------------------------------------------------------ factory

let adapterSingleton;
export function getChatAdapter() {
  if (adapterSingleton !== undefined) return adapterSingleton;
  const provider = String(process.env.CORE_CHAT_PROVIDER || "").trim().toLowerCase();
  if (!provider) adapterSingleton = null;
  else if (provider === "disabled") adapterSingleton = { id: "disabled", model: "", availability: "disabled", supportsTools: false, async completeTurn() { throw Object.assign(new Error("DGTL.chat is disabled."), { status: 503 }); }, async health() { return { state: "disabled" }; } };
  else if (provider === "deterministic" || provider === "test") adapterSingleton = createDeterministicAdapter();
  else if (provider === "anthropic") adapterSingleton = createAnthropicAdapter() || null;
  else adapterSingleton = null;
  return adapterSingleton;
}
export function __resetChatAdapterForTests() { adapterSingleton = undefined; }
