import { productionTransportStatus } from "../stage2/transport.js";

/**
 * HOME aggregation service (Stage 5).
 *
 * A read-only projection over the canonical Stage 1-4 systems. It owns no
 * business state, persists nothing, and derives every item from live
 * canonical rows (plus the freshness-stamped Worklog snapshots Stage 4
 * already stores). When a source condition is resolved in its authoritative
 * workflow, the HOME item disappears naturally.
 *
 * Section failures degrade individually: one failing source marks its own
 * section degraded and the rest of the snapshot still renders.
 */

const SEVERITY_ORDER = ["critical", "action_required", "due_today", "upcoming", "informational"];
const DELIVERY_READY_STAGES = new Set(["won", "delivery", "delivery_ready"]);
const APPROVAL_ROLES = new Set(["owner", "admin"]);
const WRITE_ROLES = new Set(["owner", "admin", "sales"]);
const RUNNING_JOB_STATES = new Set(["queued", "claimed", "running", "validating"]);
const OPEN_TASK_STATES = new Set(["queued", "retry"]);

const dayOf = (value) => (value ? String(new Date(value).toISOString()).slice(0, 10) : "");

function severityRank(severity) {
  const rank = SEVERITY_ORDER.indexOf(severity);
  return rank === -1 ? SEVERITY_ORDER.length : rank;
}

export class HomeService {
  constructor({ teamId, actor, repository, worklogConnector = null, now = () => new Date(), transportStatus = productionTransportStatus }) {
    if (!String(teamId || "").trim()) throw Object.assign(new Error("teamId is required."), { status: 400 });
    this.teamId = teamId;
    this.actor = actor || {};
    this.repository = repository;
    this.worklogConnector = worklogConnector;
    this.now = now;
    this.transportStatus = transportStatus;
  }

  at() { return new Date(this.now()).toISOString(); }
  today() { return dayOf(this.now()); }
  canApprove() { return APPROVAL_ROLES.has(this.actor.role); }
  canWrite() { return WRITE_ROLES.has(this.actor.role); }

  /**
   * The full dashboard read model. Base reads run in parallel; each section
   * is computed from whichever sources loaded, and a failed source degrades
   * only the sections that need it.
   */
  async snapshot() {
    const teamId = this.teamId;
    const sources = await this.#loadSources(teamId);
    const failed = (names) => names.filter((name) => sources[name]?.error);
    const section = (names, build) => {
      const missing = failed(names);
      if (missing.length) {
        return { state: "degraded", error: `Unavailable source${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`, data: null };
      }
      try { return { state: "ok", data: build() }; }
      catch (error) { return { state: "degraded", error: error?.message || "Section failed.", data: null }; }
    };

    const worklogHealth = await this.#worklogHealth();
    const attention = section(
      ["opportunities", "campaigns", "draftMessages", "messageCounts", "importBatches", "generationJobs", "artifactDeployments", "integrationOperations", "projectLinks", "clientLinks", "exceptions"],
      () => this.#buildAttention(sources, worklogHealth),
    );

    return {
      generatedAt: this.at(),
      actorRole: this.actor.role || "",
      attention,
      today: section(["opportunities", "campaigns", "draftMessages", "generationJobs", "integrationOperations", "projectLinks"], () => this.#buildToday(sources)),
      approvals: section(["campaigns", "draftMessages", "generationJobs", "integrationOperations", "importBatches"], () => this.#buildApprovals(sources)),
      pipeline: section(["stageCounts", "opportunities", "projectLinks"], () => this.#buildPipeline(sources)),
      outreach: section(["campaigns", "messageCounts", "health"], () => this.#buildOutreach(sources)),
      delivery: section(["projectLinks", "clientLinks", "integrationOperations", "opportunities"], () => this.#buildDelivery(sources)),
      generation: section(["generationJobs", "artifacts", "artifactDeployments"], () => this.#buildGeneration(sources)),
      systemHealth: section(["health"], () => this.#buildSystemHealth(sources, worklogHealth)),
      recentActivity: section(["activities"], () => this.#buildRecentActivity(sources)),
      quickLinks: this.#buildQuickLinks(),
    };
  }

  async #loadSources(teamId) {
    const activeSince = new Date(new Date(this.now()).getTime() - 10 * 60_000).toISOString();
    const loaders = {
      opportunities: () => this.repository.listOpportunities(teamId),
      stageCounts: () => this.repository.countOpportunitiesByStage(teamId),
      campaigns: () => this.repository.listCampaigns(teamId),
      draftMessages: () => this.repository.listMessagesByStatus(teamId, ["draft"], 50),
      messageCounts: () => this.repository.countMessagesByQueueState(teamId),
      importBatches: () => this.repository.listImportBatches(teamId),
      generationJobs: () => this.repository.listGenerationJobs(teamId),
      artifacts: () => this.repository.listArtifacts(teamId),
      artifactDeployments: () => this.repository.listArtifactDeployments(teamId),
      integrationOperations: () => this.repository.listIntegrationOperations(teamId, { connectorId: "worklog" }),
      projectLinks: () => this.repository.listExternalLinksBySystem(teamId, "worklog", { externalObjectType: "project", syncState: "linked" }),
      clientLinks: () => this.repository.listExternalLinksBySystem(teamId, "worklog", { externalObjectType: "client", syncState: "linked" }),
      exceptions: () => this.repository.listOperationExceptions(teamId, "open"),
      activities: () => this.repository.listTeamActivities(teamId, 20),
      health: () => this.repository.getOperationalHealth(teamId, activeSince),
    };
    const entries = Object.entries(loaders);
    const settled = await Promise.allSettled(entries.map(([, load]) => load()));
    const sources = {};
    entries.forEach(([name], index) => {
      const result = settled[index];
      sources[name] = result.status === "fulfilled"
        ? { data: result.value }
        : { error: result.reason?.message || "load failed", data: null };
    });
    return sources;
  }

  /** Live connector probe, bounded so a hung Worklog cannot stall HOME. */
  async #worklogHealth({ timeoutMs = 3000 } = {}) {
    const connector = this.worklogConnector;
    if (!connector || !connector.configured()) return { state: "unconfigured", checkedAt: this.at() };
    if (!connector.authorizedForTeam(this.teamId)) return { state: "team_not_enabled", checkedAt: this.at() };
    try {
      return await Promise.race([
        connector.health(),
        new Promise((resolve) => setTimeout(() => resolve({ state: "unavailable", error: "Health probe timed out.", checkedAt: this.at(), lastSuccessAt: connector.lastSuccessAt }), timeoutMs)),
      ]);
    } catch (error) {
      return { state: "unavailable", error: error?.message || "Worklog probe failed.", checkedAt: this.at() };
    }
  }

  /**
   * Deterministic attention derivation. Ordering: severity class first
   * (critical > action_required > due_today > upcoming > informational),
   * then oldest timestamp/due date, then stable key. Every item is a
   * projection of a canonical state and disappears when that state resolves.
   */
  #buildAttention(sources, worklogHealth) {
    const items = [];
    const today = this.today();
    const push = (item) => items.push({ recommendedAction: "", dueDate: "", ...item });

    // --- critical: failures, unknown external outcomes, broken links -------
    const counts = sources.messageCounts.data || [];
    const countFor = (queueState) => counts.filter((row) => row.queueState === queueState).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const deadLetters = countFor("dead_letter");
    if (deadLetters > 0) push({ key: "outreach:dead_letter", source: "outreach", severity: "critical", title: `${deadLetters} dead-letter message${deadLetters === 1 ? "" : "s"}`, explanation: "Delivery exhausted every retry; each needs review before any resend.", entityType: "outbox", entityId: "", href: "/operations/outbox", at: this.at(), actionCategory: "resolve_failure" });
    const uncertain = countFor("delivery_uncertain");
    if (uncertain > 0) push({ key: "outreach:delivery_uncertain", source: "outreach", severity: "critical", title: `${uncertain} message${uncertain === 1 ? "" : "s"} with unknown delivery outcome`, explanation: "The provider outcome was lost; quarantined until reviewed.", entityType: "outbox", entityId: "", href: "/operations/outbox", at: this.at(), actionCategory: "resolve_failure" });

    for (const deployment of sources.artifactDeployments.data || []) {
      if (deployment.status === "outcome_unknown") push({ key: `deployment:${deployment.id}:unknown`, source: "generation", severity: "critical", title: "Artifact deployment outcome unknown", explanation: "The deployment response was lost; verify before any retry.", entityType: "artifact", entityId: deployment.artifactId, href: `/artifacts/${deployment.artifactId}`, at: deployment.uncertainAt || deployment.updatedAt, actionCategory: "resolve_failure" });
      if (deployment.status === "deployment_failed") push({ key: `deployment:${deployment.id}:failed`, source: "generation", severity: "critical", title: "Artifact deployment failed", explanation: "The deployment adapter reported a failure.", entityType: "artifact", entityId: deployment.artifactId, href: `/artifacts/${deployment.artifactId}`, at: deployment.completedAt || deployment.updatedAt, actionCategory: "resolve_failure" });
    }
    for (const operation of sources.integrationOperations.data || []) {
      if (operation.status === "outcome_unknown") push({ key: `operation:${operation.id}:unknown`, source: "delivery", severity: "critical", title: `Worklog ${operation.action} outcome unknown`, explanation: "Worklog may have committed the change; reconcile before retrying.", entityType: "integration_operation", entityId: operation.id, href: operation.localEntityType === "opportunity" ? `/opportunities/${encodeURIComponent(operation.localEntityId)}` : "/operations/worklog", at: operation.uncertainAt || operation.updatedAt, actionCategory: "reconcile" });
      if (operation.status === "failed") push({ key: `operation:${operation.id}:failed`, source: "delivery", severity: "critical", title: `Worklog ${operation.action} failed`, explanation: operation.errorMetadata?.message || "The consequential operation was rejected.", entityType: "integration_operation", entityId: operation.id, href: operation.localEntityType === "opportunity" ? `/opportunities/${encodeURIComponent(operation.localEntityId)}` : "/operations/worklog", at: operation.completedAt || operation.updatedAt, actionCategory: "resolve_failure" });
    }
    for (const batch of sources.importBatches.data || []) {
      if (batch.status === "failed") push({ key: `import:${batch.id}:failed`, source: "imports", severity: "critical", title: `Import "${batch.filename || batch.id}" failed`, explanation: "The batch stopped before completion.", entityType: "import_batch", entityId: batch.id, href: `/imports/${batch.id}`, at: batch.updatedAt, actionCategory: "resolve_failure" });
    }
    for (const job of sources.generationJobs.data || []) {
      if (job.status === "failed" || job.status === "validation_failed") push({ key: `job:${job.id}:${job.status}`, source: "generation", severity: "critical", title: job.status === "failed" ? "Generation job failed" : "Generated output failed validation", explanation: `${job.requestedSkill || job.requestedTool || "Job"} · ${job.slug || job.id}`, entityType: "generation_job", entityId: job.id, href: `/generation-jobs/${job.id}`, at: job.completedAt || job.updatedAt, actionCategory: "resolve_failure" });
    }
    for (const link of [...(sources.projectLinks.data || []), ...(sources.clientLinks.data || [])]) {
      if (link.lastVerifiedState === "missing") push({ key: `link:${link.id}:missing`, source: "delivery", severity: "critical", title: `Worklog ${link.externalObjectType} "${link.metadata?.name || link.externalId}" no longer exists`, explanation: "Repair the link to a replacement or retire it.", entityType: link.localEntityType, entityId: link.localEntityId, href: link.localEntityType === "company" ? `/companies/${encodeURIComponent(link.localEntityId)}` : `/opportunities/${encodeURIComponent(link.localEntityId)}`, at: link.lastVerifiedAt || link.updatedAt, actionCategory: "repair_link" });
    }
    if (["auth_failed", "unreachable", "throttled", "degraded"].includes(worklogHealth?.state)) {
      push({ key: `worklog:connector:${worklogHealth.state}`, source: "operations", severity: "critical", title: `Worklog connector ${worklogHealth.state.replace("_", " ")}`, explanation: worklogHealth.error || "The delivery bridge cannot reach Worklog.", entityType: "connector", entityId: "worklog", href: "/operations/worklog", at: worklogHealth.checkedAt || this.at(), actionCategory: "resolve_failure" });
    }

    // --- action required: approvals, reviews, handoffs, exceptions ---------
    for (const item of this.#approvalItems(sources)) {
      push({ key: `approval:${item.key}`, source: item.source, severity: "action_required", title: item.title, explanation: item.explanation, entityType: item.entityType, entityId: item.entityId, href: item.href, at: item.at, actionCategory: "approve", recommendedAction: this.canApprove() ? "Review and approve" : "Awaiting owner/admin approval" });
    }
    for (const exception of (sources.exceptions.data || []).slice(0, 15)) {
      push({ key: `exception:${exception.id}`, source: "operations", severity: "action_required", title: exception.summary || exception.exceptionType, explanation: `${exception.exceptionType} · ${exception.sourceEntityType}`, entityType: "operation_exception", entityId: exception.id, href: "/operations/exceptions", at: exception.createdAt, actionCategory: "resolve_exception" });
    }
    const linkedOpportunityIds = new Set((sources.projectLinks.data || []).map((link) => link.localEntityId));
    for (const opportunity of sources.opportunities.data || []) {
      if (opportunity.status === "closed") continue;
      if (DELIVERY_READY_STAGES.has(String(opportunity.stage || "").toLowerCase()) && !linkedOpportunityIds.has(opportunity.id)) {
        push({ key: `handoff:${opportunity.id}`, source: "delivery", severity: "action_required", title: `"${opportunity.name}" is delivery-ready but not handed off`, explanation: "Create or link its Worklog delivery project.", entityType: "opportunity", entityId: opportunity.id, href: `/opportunities/${encodeURIComponent(opportunity.id)}`, at: opportunity.updatedAt, actionCategory: "handoff" });
      }
      const due = dayOf(opportunity.nextActionAt);
      if (due && due < today) {
        push({ key: `next-action:${opportunity.id}`, source: "sales", severity: "action_required", title: `Overdue: ${opportunity.nextAction || "next action"} — ${opportunity.name}`, explanation: `Due ${due}.`, entityType: "opportunity", entityId: opportunity.id, href: `/opportunities/${encodeURIComponent(opportunity.id)}`, at: opportunity.nextActionAt, dueDate: due, actionCategory: "follow_up" });
      } else if (due && due === today) {
        push({ key: `next-action:${opportunity.id}`, source: "sales", severity: "due_today", title: `${opportunity.nextAction || "Next action"} — ${opportunity.name}`, explanation: "Due today.", entityType: "opportunity", entityId: opportunity.id, href: `/opportunities/${encodeURIComponent(opportunity.id)}`, at: opportunity.nextActionAt, dueDate: due, actionCategory: "follow_up" });
      } else if (due && due > today && (new Date(due) - new Date(today)) <= 7 * 86_400_000) {
        push({ key: `next-action:${opportunity.id}`, source: "sales", severity: "upcoming", title: `${opportunity.nextAction || "Next action"} — ${opportunity.name}`, explanation: `Due ${due}.`, entityType: "opportunity", entityId: opportunity.id, href: `/opportunities/${encodeURIComponent(opportunity.id)}`, at: opportunity.nextActionAt, dueDate: due, actionCategory: "follow_up" });
      }
    }
    for (const link of sources.projectLinks.data || []) {
      const overdueTasks = Number(link.statusSnapshot?.overdueTasks || 0);
      if (overdueTasks > 0 && link.lastVerifiedState !== "missing") {
        push({ key: `worklog-overdue:${link.id}`, source: "delivery", severity: "due_today", title: `${overdueTasks} overdue delivery task${overdueTasks === 1 ? "" : "s"} — ${link.metadata?.name || link.externalId}`, explanation: `From the Worklog snapshot of ${link.snapshotAt || "unknown time"}.`, entityType: "opportunity", entityId: link.localEntityId, href: `/opportunities/${encodeURIComponent(link.localEntityId)}`, at: link.snapshotAt || link.updatedAt, actionCategory: "delivery" });
      }
    }

    items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)
      || String(a.at || "").localeCompare(String(b.at || ""))
      || a.key.localeCompare(b.key));
    return { items, counts: SEVERITY_ORDER.reduce((acc, severity) => ({ ...acc, [severity]: items.filter((item) => item.severity === severity).length }), {}) };
  }

  #approvalItems(sources) {
    const items = [];
    for (const campaign of sources.campaigns.data || []) {
      if (campaign.approvalState === "review") items.push({ key: `campaign:${campaign.id}`, source: "outreach", title: `Campaign "${campaign.name}" awaiting approval`, explanation: "Drafts are generated; approve the campaign to unlock queuing.", entityType: "campaign", entityId: campaign.id, href: `/campaigns/${campaign.id}`, at: campaign.updatedAt, kind: "campaign" });
    }
    const draftsByCampaign = new Map();
    for (const message of sources.draftMessages.data || []) {
      const key = message.campaignId || "none";
      const group = draftsByCampaign.get(key) || { count: 0, at: message.createdAt, campaignId: message.campaignId };
      group.count += 1;
      if (String(message.createdAt || "") < String(group.at || "")) group.at = message.createdAt;
      draftsByCampaign.set(key, group);
    }
    for (const [key, group] of draftsByCampaign) {
      items.push({ key: `messages:${key}`, source: "outreach", title: `${group.count} draft message${group.count === 1 ? "" : "s"} awaiting content approval`, explanation: "Each message's exact content needs approval before queuing.", entityType: "campaign", entityId: group.campaignId || "", href: group.campaignId ? `/campaigns/${group.campaignId}` : "/campaigns", at: group.at, kind: "message" });
    }
    for (const job of sources.generationJobs.data || []) {
      if (job.status === "draft") items.push({ key: `job-input:${job.id}`, source: "generation", title: `Generation brief awaiting approval — ${job.slug || job.id}`, explanation: "Approve the exact context before an agent can claim the job.", entityType: "generation_job", entityId: job.id, href: `/generation-jobs/${job.id}`, at: job.createdAt, kind: "generation_input" });
      if (job.status === "awaiting_review") items.push({ key: `job-review:${job.id}`, source: "generation", title: `Generated result awaiting review — ${job.slug || job.id}`, explanation: "A validated result needs owner/admin approval to become an Artifact.", entityType: "generation_job", entityId: job.id, href: `/generation-jobs/${job.id}`, at: job.resultSubmittedAt || job.updatedAt, kind: "artifact_review" });
    }
    for (const operation of sources.integrationOperations.data || []) {
      if (operation.status === "draft") items.push({ key: `operation:${operation.id}`, source: "delivery", title: `Worklog ${operation.action} awaiting approval`, explanation: "Approve the exact payload before execution.", entityType: "integration_operation", entityId: operation.id, href: operation.localEntityType === "opportunity" ? `/opportunities/${encodeURIComponent(operation.localEntityId)}` : "/operations/worklog", at: operation.requestedAt, kind: "integration_operation" });
      if (operation.status === "approved") items.push({ key: `operation-exec:${operation.id}`, source: "delivery", title: `Worklog ${operation.action} approved, awaiting execution`, explanation: "Execute it to perform the Worklog change.", entityType: "integration_operation", entityId: operation.id, href: operation.localEntityType === "opportunity" ? `/opportunities/${encodeURIComponent(operation.localEntityId)}` : "/operations/worklog", at: operation.approvedAt || operation.updatedAt, kind: "integration_operation" });
    }
    for (const batch of sources.importBatches.data || []) {
      if (["staged", "mapped", "review"].includes(batch.status)) items.push({ key: `import:${batch.id}`, source: "imports", title: `Import "${batch.filename || batch.id}" awaiting review`, explanation: "Duplicate decisions and the apply step need review.", entityType: "import_batch", entityId: batch.id, href: `/imports/${batch.id}`, at: batch.updatedAt, kind: "import" });
    }
    return items.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")) || a.key.localeCompare(b.key));
  }

  #buildToday(sources) {
    const today = this.today();
    const items = [];
    for (const opportunity of sources.opportunities.data || []) {
      if (opportunity.status === "closed") continue;
      const due = dayOf(opportunity.nextActionAt);
      if (due && due <= today) items.push({ kind: "next_action", overdue: due < today, title: opportunity.nextAction || "Next action", subtitle: opportunity.name, href: `/opportunities/${encodeURIComponent(opportunity.id)}`, dueDate: due });
    }
    for (const link of sources.projectLinks.data || []) {
      const overdueTasks = Number(link.statusSnapshot?.overdueTasks || 0);
      if (overdueTasks > 0) items.push({ kind: "delivery_task", overdue: true, title: `${overdueTasks} overdue Worklog task${overdueTasks === 1 ? "" : "s"}`, subtitle: link.metadata?.name || `Project ${link.externalId}`, href: `/opportunities/${encodeURIComponent(link.localEntityId)}`, dueDate: today });
    }
    const approvals = this.#approvalItems(sources);
    if (approvals.length) items.push({ kind: "approvals", overdue: false, title: `${approvals.length} item${approvals.length === 1 ? "" : "s"} waiting for approval`, subtitle: "Across campaigns, messages, generation, and delivery", href: "#approvals", dueDate: today });
    items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || String(a.dueDate).localeCompare(String(b.dueDate)));
    // Calendar events are a future source: items stay {kind, title, subtitle, href, dueDate}
    // so a calendar adapter can merge without reshaping HOME.
    return { date: today, items };
  }

  #buildApprovals(sources) {
    const items = this.#approvalItems(sources);
    return { items, count: items.length, canApprove: this.canApprove() };
  }

  #buildPipeline(sources) {
    const stages = (sources.stageCounts.data || []).map((row) => ({
      stage: row.stage, count: Number(row.count || 0),
      knownValue: Number(row.knownValue || 0), unknownValueCount: Number(row.unknownValueCount || 0),
    }));
    const opportunities = (sources.opportunities.data || []).filter((opportunity) => opportunity.status !== "closed");
    const today = this.today();
    const linkedIds = new Set((sources.projectLinks.data || []).map((link) => link.localEntityId));
    const fourteenDaysAgo = new Date(new Date(this.now()).getTime() - 14 * 86_400_000).toISOString();
    return {
      activeCount: opportunities.length,
      stages,
      knownValueTotal: stages.reduce((sum, row) => sum + row.knownValue, 0),
      unknownValueCount: stages.reduce((sum, row) => sum + row.unknownValueCount, 0),
      needingAction: opportunities.filter((opportunity) => dayOf(opportunity.nextActionAt) && dayOf(opportunity.nextActionAt) <= today).length,
      recentWins: opportunities.filter((opportunity) => String(opportunity.stage || "").toLowerCase() === "won" && String(opportunity.updatedAt || "") >= fourteenDaysAgo).slice(0, 5).map((opportunity) => ({ id: opportunity.id, name: opportunity.name, href: `/opportunities/${encodeURIComponent(opportunity.id)}` })),
      awaitingHandoff: opportunities.filter((opportunity) => DELIVERY_READY_STAGES.has(String(opportunity.stage || "").toLowerCase()) && !linkedIds.has(opportunity.id)).length,
    };
  }

  #buildOutreach(sources) {
    const counts = sources.messageCounts.data || [];
    const byQueue = (state) => counts.filter((row) => row.queueState === state).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const byStatus = (status) => counts.filter((row) => row.status === status).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const campaigns = sources.campaigns.data || [];
    return {
      activeCampaigns: campaigns.filter((campaign) => campaign.approvalState === "approved").length,
      reviewCampaigns: campaigns.filter((campaign) => campaign.approvalState === "review").length,
      draftMessages: byStatus("draft"),
      queued: byQueue("queued") + byQueue("retry"),
      sent: byQueue("sent"),
      delivered: byStatus("delivered"),
      bounced: byStatus("bounced"),
      suppressed: byQueue("suppressed"),
      deadLetter: byQueue("dead_letter"),
      deliveryUncertain: byQueue("delivery_uncertain"),
      health: sources.health.data || null,
    };
  }

  #buildDelivery(sources) {
    const projectLinks = sources.projectLinks.data || [];
    const operations = sources.integrationOperations.data || [];
    const opportunities = (sources.opportunities.data || []).filter((opportunity) => opportunity.status !== "closed");
    const linkedIds = new Set(projectLinks.map((link) => link.localEntityId));
    const snapshots = projectLinks.map((link) => link.statusSnapshot || {});
    const oldestSnapshotAt = projectLinks.map((link) => link.snapshotAt).filter(Boolean).sort()[0] || "";
    return {
      linkedProjects: projectLinks.filter((link) => link.lastVerifiedState !== "missing").length,
      staleLinks: projectLinks.filter((link) => link.lastVerifiedState === "missing").length,
      awaitingHandoff: opportunities.filter((opportunity) => DELIVERY_READY_STAGES.has(String(opportunity.stage || "").toLowerCase()) && !linkedIds.has(opportunity.id)).length,
      overdueTasks: snapshots.reduce((sum, snapshot) => sum + Number(snapshot.overdueTasks || 0), 0),
      loggedMinutes: snapshots.reduce((sum, snapshot) => sum + Number(snapshot.loggedMinutes || 0), 0),
      billableMinutes: snapshots.reduce((sum, snapshot) => sum + Number(snapshot.billableMinutes || 0), 0),
      budgetRiskProjects: projectLinks.filter((link) => Number(link.statusSnapshot?.budgetUsedPct || 0) >= 80).map((link) => ({ name: link.metadata?.name || link.externalId, budgetUsedPct: link.statusSnapshot.budgetUsedPct, href: `/opportunities/${encodeURIComponent(link.localEntityId)}` })),
      pendingOperations: operations.filter((operation) => ["draft", "approved", "executing", "outcome_unknown"].includes(operation.status)).length,
      oldestSnapshotAt,
      source: "worklog",
    };
  }

  #buildGeneration(sources) {
    const jobs = sources.generationJobs.data || [];
    const deployments = sources.artifactDeployments.data || [];
    const artifacts = sources.artifacts.data || [];
    return {
      running: jobs.filter((job) => RUNNING_JOB_STATES.has(job.status)).length,
      awaitingInputApproval: jobs.filter((job) => job.status === "draft").length,
      awaitingReview: jobs.filter((job) => job.status === "awaiting_review").length,
      failed: jobs.filter((job) => ["failed", "validation_failed"].includes(job.status)).length,
      approvedArtifacts: artifacts.filter((artifact) => ["approved", "deployed"].includes(artifact.status)).length,
      deploymentsPending: deployments.filter((deployment) => ["deploy_queued", "deploying"].includes(deployment.status)).length,
      deploymentsFailed: deployments.filter((deployment) => deployment.status === "deployment_failed").length,
      deploymentsUnknown: deployments.filter((deployment) => deployment.status === "outcome_unknown").length,
    };
  }

  #buildSystemHealth(sources, worklogHealth) {
    const health = sources.health.data || {};
    const entries = [];
    const lastCycle = health.lastSuccessfulWorkerCycle || "";
    const cycleAgeMs = lastCycle ? new Date(this.now()) - new Date(lastCycle) : null;
    entries.push({
      id: "outbox_worker", label: "Outbox worker",
      state: health.workerRunning ? "healthy" : lastCycle ? (cycleAgeMs <= 24 * 3600_000 ? "healthy" : "degraded") : "unconfigured",
      detail: health.workerRunning ? "Running now" : lastCycle ? `Last successful cycle ${lastCycle}` : "No worker cycle recorded yet",
      freshness: lastCycle,
    });
    let transport = { enabled: false };
    try { transport = this.transportStatus(); } catch { transport = { enabled: false }; }
    entries.push({
      id: "email_transport", label: "Production email",
      state: transport.enabled ? "healthy" : "disabled",
      detail: transport.enabled ? "Production transport enabled" : "Disabled intentionally — test transport only",
      freshness: "",
    });
    const worklogStateMap = { connected: "healthy", unconfigured: "unconfigured", team_not_enabled: "unconfigured", auth_failed: "degraded", throttled: "degraded", insufficient_permission: "degraded", unreachable: "unavailable", unavailable: "unavailable", degraded: "degraded" };
    entries.push({
      id: "worklog_connector", label: "Worklog connector",
      state: worklogStateMap[worklogHealth?.state] || "degraded",
      detail: worklogHealth?.state === "connected" ? `Connected as ${worklogHealth.identity?.email || "integration account"}` : worklogHealth?.state === "unconfigured" ? "Not configured on this server" : worklogHealth?.state === "team_not_enabled" ? "Configured for a different team" : worklogHealth?.error || worklogHealth?.state || "Unknown",
      freshness: worklogHealth?.checkedAt || "",
    });
    const backlogIssues = Number(health.deadLetterCount || 0) + Number(health.uncertainCount || 0);
    entries.push({
      id: "outbox_backlog", label: "Outbox backlog",
      state: backlogIssues > 0 ? "degraded" : "healthy",
      detail: backlogIssues > 0 ? `${health.deadLetterCount || 0} dead-letter · ${health.uncertainCount || 0} uncertain` : `${health.pendingOutbox || 0} pending`,
      freshness: "",
    });
    entries.push({
      id: "exceptions", label: "Operations exceptions",
      state: Number(health.unresolvedExceptions || 0) > 0 ? "degraded" : "healthy",
      detail: `${health.unresolvedExceptions || 0} unresolved`,
      freshness: "",
    });
    return { entries, checkedAt: this.at() };
  }

  #buildRecentActivity(sources) {
    return {
      items: (sources.activities.data || []).map((activity) => ({
        id: activity.id, activityType: activity.activityType, summary: activity.summary || activity.activityType,
        occurredAt: activity.occurredAt, actorType: activity.actorType,
        href: activity.opportunityId ? `/opportunities/${encodeURIComponent(activity.opportunityId)}`
          : activity.companyId ? `/companies/${encodeURIComponent(activity.companyId)}`
          : activity.campaignId ? `/campaigns/${activity.campaignId}`
          : activity.contactId ? `/contacts/${encodeURIComponent(activity.contactId)}`
          : "/companies",
      })),
    };
  }

  #buildQuickLinks() {
    const links = [
      { label: "Review approvals", href: "#approvals", write: false },
      { label: "Opportunities needing action", href: "/opportunities", write: false },
      { label: "Import prospects", href: "/imports/new", write: true },
      { label: "Create campaign", href: "/campaigns/new", write: true },
      { label: "Generate sales asset", href: "/opportunities", write: true },
      { label: "Delivery handoffs", href: "/operations/worklog", write: false },
      { label: "Open exceptions", href: "/operations/exceptions", write: false },
    ];
    return links.filter((link) => !link.write || this.canWrite());
  }

  /** Bounded, team-scoped command-palette search returning flat deep links. */
  async search(query, { perKind = 5 } = {}) {
    const trimmed = String(query || "").trim();
    if (trimmed.length < 2) return { query: trimmed, results: [] };
    const raw = await this.repository.searchEntities(this.teamId, trimmed, perKind);
    const results = [
      ...(raw.companies || []).map((row) => ({ kind: "company", id: row.id, title: row.displayName, subtitle: row.normalizedDomain || "", status: row.relationshipStatus || "", href: `/companies/${encodeURIComponent(row.id)}` })),
      ...(raw.contacts || []).map((row) => ({ kind: "contact", id: row.id, title: row.fullName || row.email, subtitle: [row.title, row.email].filter(Boolean).join(" · "), status: "", href: `/contacts/${encodeURIComponent(row.id)}` })),
      ...(raw.opportunities || []).map((row) => ({ kind: "opportunity", id: row.id, title: row.name, subtitle: "", status: row.stage || "", href: `/opportunities/${encodeURIComponent(row.id)}` })),
      ...(raw.campaigns || []).map((row) => ({ kind: "campaign", id: row.id, title: row.name, subtitle: "", status: row.approvalState || row.status || "", href: `/campaigns/${row.id}` })),
      ...(raw.artifacts || []).map((row) => ({ kind: "artifact", id: row.id, title: `${row.slug} v${row.versionNumber || 1}`, subtitle: row.kind || "", status: row.status || "", href: `/artifacts/${row.id}` })),
      ...(raw.generationJobs || []).map((row) => ({ kind: "generation_job", id: row.id, title: row.slug || row.id, subtitle: row.requestedSkill || "", status: row.status || "", href: `/generation-jobs/${row.id}` })),
      ...(raw.worklogProjects || []).map((row) => ({ kind: "worklog_project", id: row.id, title: row.metadata?.name || `Project ${row.externalId}`, subtitle: "Worklog project", status: "linked", href: `/opportunities/${encodeURIComponent(row.localEntityId)}` })),
    ];
    return { query: trimmed, results: results.slice(0, 30) };
  }
}
