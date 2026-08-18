import { createCoreId } from "../core/ids.js";
import { consumeRateLimit } from "../rateLimit.js";
import { ASSISTANT_POLICY_VERSION, buildSystemPolicy } from "./policy.js";
import { TOOL_INDEX, hashPayload, requireTool, toolsForActor, validateToolArgs } from "./toolRegistry.js";
import { summarizeToolResult } from "./summarizeToolResult.js";
import { ArtifactAutomationService } from "../stage3/service.js";

/**
 * AssistantService: the Stage 6 orchestration boundary. The model may
 * interpret, reason, and propose; this service validates, authorizes, and
 * executes — the model is never the authority. Every turn is bounded, every
 * tool call is validated and audited, every consequential intent becomes an
 * ActionProposal that only an explicit human confirmation (revalidated at
 * execution time) can turn into the normal native draft/request state.
 */

const WRITE_ROLES = new Set(["owner", "admin", "sales"]);

export const TURN_LIMITS = Object.freeze({
  maxInputChars: 4000,
  maxIterations: 8,
  maxToolCalls: 6,
  maxToolResultChars: 6000,
  maxTotalToolChars: 24000,
  maxHistoryMessages: 20,
  turnTimeoutMs: 60_000,
  turnsPerMinute: 10,
  proposalTtlMs: 24 * 3600_000,
  // Terminal read commands get their own, much larger budget. They are
  // deterministic and cost nothing to run, so throttling them at the model's
  // 10/min would make the terminal feel broken for no benefit — and a separate
  // bucket means typing `home` repeatedly can never exhaust the allowance for
  // an actual model turn.
  readCommandsPerMinute: 60,
});

const iso = (value = new Date()) => new Date(value).toISOString();
function fail(message, status = 400, code = "") {
  throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}
const clamp = (value, cap) => { const text = String(value ?? ""); return text.length > cap ? `${text.slice(0, cap)}…` : text; };

/** Provider-facing tool description: JSON Schema with additionalProperties:false. */
function toolInputSchema(tool) {
  const properties = {};
  const required = [];
  for (const [key, rule] of Object.entries(tool.argsSpec)) {
    properties[key] = rule.type === "number" ? { type: "number" } : rule.type === "boolean" ? { type: "boolean" } : { type: "string", ...(rule.enum ? { enum: rule.enum } : {}) };
    if (rule.required) required.push(key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

export class AssistantService {
  constructor({ teamId, actor, repository, adapter, services, now = () => new Date(), idFactory = createCoreId, limits = TURN_LIMITS, rateLimiter = consumeRateLimit }) {
    if (!String(teamId || "").trim()) fail("teamId is required.", 400);
    this.teamId = teamId;
    this.actor = actor || {};
    this.repository = repository;
    this.adapter = adapter || null;
    this.services = services || {};
    this.now = now;
    this.idFactory = idFactory;
    this.limits = limits;
    this.rateLimiter = rateLimiter;
  }

  at() { return iso(this.now()); }
  #worklogConfigured() { const connector = this.services.worklog?.connector; return Boolean(connector?.configured?.() && connector?.authorizedForTeam?.(this.teamId)); }
  #toolContext() { return { teamId: this.teamId, actor: this.actor, repository: this.repository, services: this.services }; }

  async health() {
    if (!this.adapter) return { state: "unconfigured", detail: "No chat model provider is configured (CORE_CHAT_PROVIDER)." };
    if (this.adapter.availability === "disabled") return { state: "disabled", detail: "DGTL.chat is disabled by configuration." };
    try {
      const providerHealth = await this.adapter.health();
      return { state: providerHealth.state || "healthy", provider: this.adapter.id, model: this.adapter.model, policyVersion: ASSISTANT_POLICY_VERSION };
    } catch (error) {
      return { state: "unavailable", provider: this.adapter.id, detail: error?.message || "Provider health check failed." };
    }
  }

  // -------------------------------------------------------------- threads

  async createThread({ title = "" } = {}) {
    const at = this.at();
    return this.repository.createAssistantThread({
      id: this.idFactory("assistantThread"), teamId: this.teamId, userId: this.actor.id,
      title: clamp(title, 120), status: "idle", policyVersion: ASSISTANT_POLICY_VERSION,
      lastMessageAt: "", createdAt: at, updatedAt: at,
    });
  }

  async #requireOwnThread(threadId) {
    const thread = await this.repository.getAssistantThread(threadId, this.teamId);
    if (!thread) fail("Thread not found.", 404, "thread_not_found");
    if (thread.userId !== this.actor.id) fail("This thread belongs to another user.", 403, "thread_forbidden");
    return thread;
  }

  async listThreads() { return this.repository.listAssistantThreads(this.teamId, this.actor.id, 30); }

  async getThread(threadId) {
    const thread = await this.#requireOwnThread(threadId);
    const [messages, proposals] = await Promise.all([
      this.repository.listAssistantMessages(thread.id, this.teamId, 100),
      this.repository.listActionProposals(thread.id, this.teamId),
    ]);
    return { thread, messages, proposals };
  }

  // ----------------------------------------------------------------- turn

  async handleTurn({ threadId, userMessage }) {
    const text = String(userMessage || "").trim();
    if (!text) fail("Message is required.", 400);
    if (text.length > this.limits.maxInputChars) fail(`Message exceeds ${this.limits.maxInputChars} characters.`, 400, "input_too_long");
    if (!this.adapter) fail("DGTL.chat has no model provider configured. Core keeps working; ask an admin to set CORE_CHAT_PROVIDER.", 503, "assistant_unconfigured");
    const rate = this.rateLimiter(`chat:turn:${this.teamId}:${this.actor.id}`, { limit: this.limits.turnsPerMinute, windowMs: 60_000, now: Number(new Date(this.now())) });
    if (!rate.allowed) fail(`Rate limit reached; retry in ${rate.retryAfterSeconds}s.`, 429, "rate_limited");

    const thread = await this.#requireOwnThread(threadId);
    const turnId = this.idFactory("assistantTurn");
    const startedAt = this.at();
    // Thread concurrency: CAS idle -> running. A second concurrent turn 409s.
    const running = await this.repository.updateAssistantThread(thread.id, this.teamId, { status: "running", activeTurnId: turnId, updatedAt: startedAt }, ["idle"]);
    if (!running) fail("Another turn is already running on this thread.", 409, "turn_in_progress");

    try {
      await this.repository.createAssistantMessage({
        id: this.idFactory("assistantMessage"), teamId: this.teamId, threadId: thread.id, turnId,
        role: "user", content: text, sourceRefs: [], toolSummary: [], providerMetadata: {},
        policyVersion: ASSISTANT_POLICY_VERSION, status: "completed", createdAt: startedAt,
      });

      const availableTools = toolsForActor(this.actor, { worklogConfigured: this.#worklogConfigured() });
      const providerTools = availableTools.map((tool) => ({ id: tool.id, description: tool.description, inputSchema: toolInputSchema(tool) }));
      const system = buildSystemPolicy({ actorRole: this.actor.role || "unknown", toolIds: availableTools.map((tool) => tool.id) });

      const history = (await this.repository.listAssistantMessages(thread.id, this.teamId, 200))
        .filter((message) => ["user", "assistant"].includes(message.role))
        .slice(-this.limits.maxHistoryMessages)
        .map((message) => ({ role: message.role, content: clamp(message.content, 2000) }));

      const transcript = [...history];
      const toolSummary = [];
      const sourceRefs = [];
      const proposals = [];
      let toolCalls = 0;
      let totalToolChars = 0;
      let finalContent = "";
      let usageTotals = { inputTokens: 0, outputTokens: 0 };
      const deadline = Number(new Date(this.now())) + this.limits.turnTimeoutMs;

      for (let iteration = 0; iteration < this.limits.maxIterations; iteration += 1) {
        if (Number(new Date(this.now())) > deadline) { finalContent = "This turn exceeded its time budget; here is what I gathered so far. Ask again to continue."; break; }
        const step = await this.adapter.completeTurn({ system, messages: transcript, tools: providerTools });
        if (step.usage) { usageTotals.inputTokens += Number(step.usage.inputTokens || 0); usageTotals.outputTokens += Number(step.usage.outputTokens || 0); }

        if (step.type === "final") { finalContent = clamp(step.content, 8000); break; }
        if (step.type !== "tool_call") { finalContent = "The model returned an unusable step; try again."; break; }

        toolCalls += 1;
        const callId = step.callId || `call_${toolCalls}`;
        if (toolCalls > this.limits.maxToolCalls) { finalContent = "I reached the tool budget for one turn. Here is what I have; ask a follow-up to continue."; break; }

        const runId = this.idFactory("assistantToolRun");
        const runStartedAt = this.at();
        let resultPayload;
        let runStatus = "completed";
        let runError = "";
        let targetRefs = [];
        try {
          const tool = requireTool(step.toolId, this.actor, { worklogConfigured: this.#worklogConfigured() });
          const args = validateToolArgs(tool, step.args);
          const outcome = await tool.execute(this.#toolContext(), args);
          targetRefs = outcome.sourceRefs || [];
          for (const refItem of targetRefs) if (!sourceRefs.some((existing) => existing.kind === refItem.kind && existing.id === refItem.id)) sourceRefs.push(refItem);
          let proposalId = "";
          if (outcome.proposalDraft) {
            const proposal = await this.#persistProposal(thread.id, turnId, outcome.proposalDraft);
            proposals.push(proposal);
            proposalId = proposal.id;
          }
          resultPayload = clamp(JSON.stringify({ ...(outcome.data || {}), ...(proposalId ? { proposalId, impactSummary: outcome.proposalDraft.impactSummary, requiresHumanConfirmation: true } : {}) }), this.limits.maxToolResultChars);
        } catch (error) {
          runStatus = "rejected";
          runError = clamp(error?.message || "Tool failed.", 300);
          resultPayload = JSON.stringify({ error: runError, code: error?.code || "tool_error" });
        }
        totalToolChars += resultPayload.length;
        await this.repository.createAssistantToolRun({
          id: runId, teamId: this.teamId, threadId: thread.id, turnId,
          toolId: String(step.toolId).slice(0, 80), classification: TOOL_INDEX[step.toolId]?.classification || "unknown",
          arguments: runStatus === "completed" ? step.args || {} : {}, targetRefs,
          status: runStatus, error: runError, startedAt: runStartedAt, completedAt: this.at(), createdAt: runStartedAt,
        });
        toolSummary.push({ toolId: String(step.toolId).slice(0, 80), status: runStatus, ...(runError ? { error: runError } : {}) });
        transcript.push({ role: "assistant_tool_call", toolId: step.toolId, args: step.args || {}, callId });
        transcript.push({ role: "tool_result", toolId: step.toolId, callId, content: resultPayload });
        if (totalToolChars > this.limits.maxTotalToolChars) { finalContent = "I reached the context budget for one turn; ask a follow-up to continue."; break; }
      }
      if (!finalContent) finalContent = "I reached the reasoning budget for this turn without a final answer. Try a narrower question.";

      const finishedAt = this.at();
      const assistantMessage = await this.repository.createAssistantMessage({
        id: this.idFactory("assistantMessage"), teamId: this.teamId, threadId: thread.id, turnId,
        role: "assistant", content: finalContent, sourceRefs, toolSummary,
        providerMetadata: { provider: this.adapter.id, model: this.adapter.model, toolCalls, elapsedMs: Number(new Date(finishedAt)) - Number(new Date(startedAt)), usage: usageTotals },
        policyVersion: ASSISTANT_POLICY_VERSION, status: "completed", createdAt: finishedAt,
      });
      await this.repository.updateAssistantThread(thread.id, this.teamId, { status: "idle", activeTurnId: "", lastMessageAt: finishedAt, title: thread.title || clamp(text, 80), updatedAt: finishedAt }, ["running"]);
      return { turnId, message: assistantMessage, proposals };
    } catch (error) {
      await this.repository.updateAssistantThread(thread.id, this.teamId, { status: "idle", activeTurnId: "", updatedAt: this.at() }, ["running"]).catch(() => {});
      throw error;
    }
  }

  // ------------------------------------------------------- read command
  //
  // The DGTL.chat terminal's deterministic path: the user types `home` or
  // `opp #2`, the client names the tool, and it runs with NO model involved.
  //
  // This is a strict SUBSET of what handleTurn can already reach, and the gate
  // below is what makes that true. It cannot:
  //   - reach a prepare tool, so it can never create an ActionProposal
  //   - reach a tool the actor's role does not advertise (requireTool)
  //   - pass an argument the tool does not declare, including teamId
  //     (validateToolArgs rejects unknown keys)
  //   - name a tool that is not in the registry (fails closed, and is audited)
  //
  // Team always comes from the session, never the request body. Every call
  // writes the same assistant_tool_runs audit row a model tool call writes.
  async runReadCommand({ threadId, toolId, args = {} }) {
    const id = String(toolId || "").trim();
    if (!id) fail("toolId is required.", 400);

    const thread = await this.#requireOwnThread(threadId);

    // requireTool fails closed on an unknown id AND on a tool this role may not
    // see, so an unadvertised tool cannot be invoked by name.
    const tool = requireTool(id, this.actor, { worklogConfigured: this.#worklogConfigured() });

    // The hard boundary. Everything above this line the model could also do;
    // this line is what stops the route becoming a second way to act.
    if (tool.classification !== "read") {
      fail(`${id} is not a read command. Consequential actions must go through a chat turn so they become a proposal you confirm.`, 400, "command_not_readable");
    }

    const rate = this.rateLimiter(`chat:command:${this.teamId}:${this.actor.id}`, {
      limit: this.limits.readCommandsPerMinute, windowMs: 60_000, now: Number(new Date(this.now())),
    });
    if (!rate.allowed) fail(`Command rate limit reached; retry in ${rate.retryAfterSeconds}s.`, 429, "rate_limited");

    const validated = validateToolArgs(tool, args);
    const turnId = this.idFactory("assistantTurn");
    const runId = this.idFactory("assistantToolRun");
    const startedAt = this.at();

    let data = {};
    let sourceRefs = [];
    let status = "completed";
    let error = "";
    try {
      const outcome = await tool.execute(this.#toolContext(), validated);
      data = outcome.data || {};
      sourceRefs = outcome.sourceRefs || [];
    } catch (executionError) {
      status = "rejected";
      error = clamp(executionError?.message || "Command failed.", 300);
    }

    await this.repository.createAssistantToolRun({
      id: runId, teamId: this.teamId, threadId: thread.id, turnId,
      toolId: id.slice(0, 80), classification: "read",
      arguments: status === "completed" ? validated : {}, targetRefs: sourceRefs,
      status, error, startedAt, completedAt: this.at(), createdAt: startedAt,
    });

    if (status !== "completed") fail(error || "Command failed.", 400, "command_failed");

    const summary = summarizeToolResult(id, data);
    const toolSummary = [{ toolId: id.slice(0, 80), status }];
    const at = this.at();

    // Persisted so switching to the bubble-chat view — or reloading — still
    // shows what the command printed. The user message is the raw command line;
    // the output is a system_notice, NOT role "assistant", because no model
    // spoke. That distinction is worth keeping honest in the transcript.
    await this.repository.createAssistantMessage({
      id: this.idFactory("assistantMessage"), teamId: this.teamId, threadId: thread.id, turnId,
      role: "user", content: clamp(`> ${id}`, 200), sourceRefs: [], toolSummary: [], providerMetadata: {},
      policyVersion: ASSISTANT_POLICY_VERSION, status: "completed", createdAt: startedAt,
    });
    const message = await this.repository.createAssistantMessage({
      id: this.idFactory("assistantMessage"), teamId: this.teamId, threadId: thread.id, turnId,
      role: "system_notice", content: clamp(summary, 8000), sourceRefs, toolSummary,
      providerMetadata: { provider: "command", model: "", noticeKind: "command", toolId: id },
      policyVersion: ASSISTANT_POLICY_VERSION, status: "completed", createdAt: at,
    });
    await this.repository.updateAssistantThread(thread.id, this.teamId, {
      lastMessageAt: at, title: thread.title || clamp(id, 80), updatedAt: at,
    }).catch(() => {});

    // `data` is returned live for the terminal's rich panel but is never stored;
    // only the text summary above is persisted.
    return { turnId, toolId: id, data, sourceRefs, toolSummary, message, summary };
  }

  async #persistProposal(threadId, turnId, draft) {
    const at = this.at();
    return this.repository.createActionProposal({
      id: this.idFactory("actionProposal"), teamId: this.teamId, threadId, turnId,
      actionId: draft.actionId, targetEntityType: draft.targetEntityType, targetEntityId: draft.targetEntityId,
      payload: draft.payload, payloadHash: hashPayload(draft.payload), impactSummary: draft.impactSummary,
      preconditions: draft.preconditions || {}, proposedBy: this.actor.id, status: "proposed",
      expiresAt: iso(Number(new Date(this.now())) + this.limits.proposalTtlMs), createdAt: at, updatedAt: at,
    });
  }

  // ------------------------------------------------------------ proposals

  async rejectProposal(proposalId) {
    const proposal = await this.repository.getActionProposal(proposalId, this.teamId);
    if (!proposal) fail("Proposal not found.", 404, "proposal_not_found");
    await this.#requireOwnThread(proposal.threadId);
    const rejected = await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "rejected", updatedAt: this.at() }, ["proposed"]);
    if (!rejected) fail("Only an open proposal can be rejected.", 409, "invalid_state");
    return rejected;
  }

  /**
   * Explicit human confirmation. The model never confirms; this method runs
   * only from an authenticated UI click. It re-checks ownership, role, and
   * payload hash, revalidates material preconditions against fresh canonical
   * state (stale => no mutation), and is idempotent: a second confirmation
   * of an executed proposal returns the existing result.
   */
  async confirmProposal(proposalId) {
    const proposal = await this.repository.getActionProposal(proposalId, this.teamId);
    if (!proposal) fail("Proposal not found.", 404, "proposal_not_found");
    await this.#requireOwnThread(proposal.threadId);
    if (!WRITE_ROLES.has(this.actor.role)) fail("Your role cannot perform this action.", 403);
    const tool = TOOL_INDEX[proposal.actionId];
    if (!tool || !tool.allowedRoles.includes(this.actor.role)) fail("This action is not available to your role.", 403);

    if (proposal.status === "executed") return { proposal, idempotent: true };
    if (proposal.expiresAt && this.at() > proposal.expiresAt) {
      await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "expired", updatedAt: this.at() }, ["proposed"]);
      fail("This proposal has expired; ask the assistant to prepare it again.", 409, "proposal_expired");
    }
    if (hashPayload(proposal.payload) !== proposal.payloadHash) {
      await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "rejected", error: "payload_tampered", updatedAt: this.at() }, ["proposed"]);
      fail("The proposal payload no longer matches its hash; it was invalidated.", 409, "payload_tampered");
    }

    const confirmed = await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "confirmed", confirmedBy: this.actor.id, confirmedAt: this.at(), updatedAt: this.at() }, ["proposed"]);
    if (!confirmed) {
      const current = await this.repository.getActionProposal(proposal.id, this.teamId);
      if (current?.status === "executed") return { proposal: current, idempotent: true };
      fail("This proposal is already being processed or is no longer open.", 409, "invalid_state");
    }

    const stale = async (reason) => {
      const updated = await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "stale", error: reason, updatedAt: this.at() }, ["confirmed"]);
      fail(`The underlying state changed since this was proposed (${reason}); nothing was created. Ask the assistant to prepare it again.`, 409, "proposal_stale");
      return updated;
    };

    try {
      const result = await this.#executeProposal(confirmed, stale);
      const executed = await this.repository.updateActionProposal(proposal.id, this.teamId, {
        status: "executed", executedAt: this.at(), resultEntityType: result.entityType, resultEntityId: result.entityId, updatedAt: this.at(),
      }, ["confirmed"]);
      await this.repository.createAssistantMessage({
        id: this.idFactory("assistantMessage"), teamId: this.teamId, threadId: proposal.threadId, turnId: proposal.turnId || "",
        role: "system_notice", content: result.notice, sourceRefs: result.sourceRefs || [], toolSummary: [],
        providerMetadata: {}, policyVersion: ASSISTANT_POLICY_VERSION, status: "completed", createdAt: this.at(),
      });
      return { proposal: executed, result };
    } catch (error) {
      if (error?.code !== "proposal_stale") {
        await this.repository.updateActionProposal(proposal.id, this.teamId, { status: "failed", error: clamp(error?.message || "execution failed", 300), updatedAt: this.at() }, ["confirmed"]);
      }
      throw error;
    }
  }

  /** Each action maps to the existing native domain service — never beyond a safe draft/request state. */
  async #executeProposal(proposal, stale) {
    const payload = proposal.payload || {};
    if (proposal.actionId === "message.prepare_followup") {
      const graph = await this.repository.getOpportunityGraph(payload.opportunityId, this.teamId);
      if (!graph) return stale("opportunity_missing");
      const contact = (graph.contacts || []).find((row) => row.id === payload.contactId);
      if (!contact) return stale("contact_missing");
      const currentEmail = contact.normalizedEmail || contact.email;
      if (currentEmail !== proposal.preconditions?.contactEmail) return stale("contact_email_changed");
      const at = this.at();
      const contentHash = hashPayload({ subject: payload.subject, body: payload.body });
      const message = await this.repository.createMessage({
        id: this.idFactory("message"), teamId: this.teamId, tenantId: graph.opportunity.tenantId || "",
        opportunityId: graph.opportunity.id, campaignId: null, contactId: contact.id,
        channel: "email", direction: "outbound", subject: payload.subject, body: payload.body,
        renderedSubject: payload.subject, renderedBody: payload.body, contentHash,
        status: "draft", recipientEmail: currentEmail, senderEmail: "",
        personalizationContext: { source: "dgtl_chat", proposalId: proposal.id },
        provider: "test", queueState: "not_queued", attemptCount: 0, maxAttempts: 3,
        metadata: { assistantProposalId: proposal.id }, createdAt: at, updatedAt: at,
      });
      await this.repository.createActivity({
        id: this.idFactory("activity"), teamId: this.teamId, tenantId: graph.opportunity.tenantId || "",
        companyId: graph.opportunity.companyId || "", contactId: contact.id, opportunityId: graph.opportunity.id,
        campaignId: "", messageId: message.id, activityType: "message_drafted", occurredAt: at,
        actorType: "user", actorId: this.actor.id, summary: `Drafted via DGTL.chat for ${contact.fullName || currentEmail}`,
        metadata: { assistantProposalId: proposal.id }, createdAt: at, updatedAt: at,
      });
      return { entityType: "message", entityId: message.id, notice: `Draft Message created for ${contact.fullName || currentEmail} — draft, unapproved, unqueued, unsent. Approval and queueing stay in the campaign workflow.`, sourceRefs: [{ kind: "opportunity", id: graph.opportunity.id, label: graph.opportunity.name, href: `/opportunities/${encodeURIComponent(graph.opportunity.id)}` }] };
    }
    if (proposal.actionId === "generation.prepare_asset") {
      const opportunity = await this.repository.getOpportunity(payload.opportunityId, this.teamId);
      if (!opportunity) return stale("opportunity_missing");
      const automation = new ArtifactAutomationService({ teamId: this.teamId, actor: this.actor, repository: this.repository, now: () => new Date(this.now()), idFactory: this.idFactory });
      const job = await automation.requestGeneration({
        opportunityId: payload.opportunityId, artifactKind: payload.artifactKind, adapterId: payload.adapterId,
        slug: payload.slug, instructions: payload.instructions, intendedCta: payload.intendedCta, selectedResearchIds: [],
      });
      return { entityType: "generation_job", entityId: job.id, notice: `Generation brief ${job.id} created as a normal Stage 3 draft — it still needs its own input approval before any agent can claim it.`, sourceRefs: [{ kind: "generation_job", id: job.id, label: job.slug || job.id, href: `/generation-jobs/${job.id}` }] };
    }
    if (proposal.actionId === "worklog.prepare_handoff") {
      const existing = await this.services.worklog.linkedLinkFor("opportunity", payload.opportunityId, "project");
      if (existing) return stale("already_linked");
      const { operation } = await this.services.worklog.requestProjectHandoff(payload.opportunityId, { budgetMinutes: payload.budgetMinutes ?? undefined, billable: payload.billable });
      return { entityType: "integration_operation", entityId: operation.id, notice: `Worklog handoff drafted as IntegrationOperation ${operation.id} — it still needs its own owner/admin approval and execution; no Worklog write has happened.`, sourceRefs: [{ kind: "integration_operation", id: operation.id, label: operation.action, href: "/operations/worklog" }] };
    }
    if (proposal.actionId === "opportunity.prepare_next_action") {
      const opportunity = await this.repository.getOpportunity(payload.opportunityId, this.teamId);
      if (!opportunity) return stale("opportunity_missing");
      if ((opportunity.nextAction || "") !== (proposal.preconditions?.currentNextAction || "") || (opportunity.nextActionAt || "") !== (proposal.preconditions?.currentNextActionAt || "")) {
        return stale("next_action_changed_elsewhere");
      }
      const updated = await this.repository.updateOpportunity(opportunity.id, this.teamId, { nextAction: payload.nextAction, nextActionAt: payload.nextActionAt, updatedAt: this.at() });
      return { entityType: "opportunity", entityId: updated.id, notice: `Next action updated: "${payload.nextAction}" due ${String(payload.nextActionAt).slice(0, 10)}.`, sourceRefs: [{ kind: "opportunity", id: updated.id, label: updated.name, href: `/opportunities/${encodeURIComponent(updated.id)}` }] };
    }
    fail(`No executor exists for action ${proposal.actionId}.`, 400);
  }
}
