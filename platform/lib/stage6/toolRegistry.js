import crypto from "node:crypto";
import { requireGenerationAdapter, safeSlug } from "../stage3/registry.js";

/**
 * Stage 6 tool registry: the ONLY operations the model can request. Every
 * tool is a server-owned identifier over an existing Stage 1-5 service.
 * There is no shell, SQL, HTTP, filesystem, or code tool, and unknown tool
 * ids fail closed. Arguments are strictly validated (unknown keys rejected —
 * the model can never supply teamId or any security scope), and outputs are
 * bounded before they reach model context.
 *
 * Classifications:
 *   read     — executes immediately when the actor's role allows it.
 *   prepare  — produces an ActionProposal preview; NOTHING mutates until a
 *              human explicitly confirms in the UI, after which the existing
 *              native domain service performs the safe draft/request state.
 * Approval-gated systems (campaign/message/artifact/deployment/operation
 * approval) and restricted operations (sending, deploying, deleting, direct
 * Worklog writes, SQL, shell, DNS, GitHub) are deliberately NOT tools.
 */

const READ_ROLES = ["owner", "admin", "sales", "contractor", "viewer"];
const WRITE_ROLES = ["owner", "admin", "sales"];

export const RESTRICTED_OPERATIONS = Object.freeze([
  "production email send", "message queueing/sending", "production deployment",
  "artifact approval", "campaign/message approval", "integration-operation approval or execution",
  "direct Worklog mutation", "destructive delete", "DNS", "GitHub writes", "SQL", "shell",
  "filesystem", "arbitrary HTTP",
]);

const truncate = (value, max = 300) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
const fail = (message, status = 400, code = "invalid_tool_arguments") => {
  throw Object.assign(new Error(message), { status, code });
};

/** Strict argument validation: unknown keys are rejected, not ignored. */
function validateArgs(args, spec, toolId) {
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  for (const key of Object.keys(input)) {
    if (!spec[key]) fail(`Tool ${toolId} does not accept argument "${key}".`, 400, "unknown_argument");
  }
  const clean = {};
  for (const [key, rule] of Object.entries(spec)) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") {
      if (rule.required) fail(`Tool ${toolId} requires "${key}".`);
      if (rule.default !== undefined) clean[key] = rule.default;
      continue;
    }
    if (rule.type === "string") {
      if (typeof raw !== "string") fail(`"${key}" must be a string.`);
      const text = raw.trim();
      if (rule.maxLength && text.length > rule.maxLength) fail(`"${key}" exceeds ${rule.maxLength} characters.`);
      if (rule.pattern && !rule.pattern.test(text)) fail(`"${key}" has an invalid format.`);
      if (rule.enum && !rule.enum.includes(text)) fail(`"${key}" must be one of: ${rule.enum.join(", ")}.`);
      clean[key] = text;
    } else if (rule.type === "number") {
      const value = Number(raw);
      if (!Number.isFinite(value)) fail(`"${key}" must be a number.`);
      if (rule.min !== undefined && value < rule.min) fail(`"${key}" must be >= ${rule.min}.`);
      if (rule.max !== undefined && value > rule.max) fail(`"${key}" must be <= ${rule.max}.`);
      clean[key] = value;
    } else if (rule.type === "boolean") {
      clean[key] = raw === true || raw === "true";
    }
  }
  return clean;
}

const ref = (kind, id, label, href, extra = {}) => ({ kind, id: String(id), label: truncate(label, 120), href, ...extra });
const untrusted = (text, max = 300) => ({ untrusted: true, text: truncate(text, max) });

async function requireOpportunity(context, id) {
  const opportunity = await context.repository.getOpportunity(id, context.teamId);
  if (!opportunity) fail("Opportunity is not available to this team.", 404, "not_found");
  return opportunity;
}

export const TOOLS = [
  // ------------------------------------------------------------------ READ
  {
    id: "home.get_snapshot",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "The HOME operating snapshot: attention items (priority-ordered), today, approvals, pipeline, delivery, outreach, generation, system health, recent activity. The single attention truth.",
    argsSpec: {},
    async execute(context) {
      const snapshot = await context.services.home.snapshot();
      const pick = (section, map) => (section.state === "ok" ? map(section.data) : { unavailable: section.error });
      const attention = pick(snapshot.attention, (data) => data.items.slice(0, 10).map((item) => ({ severity: item.severity, title: truncate(item.title, 160), explanation: truncate(item.explanation, 160), href: item.href })));
      return {
        data: {
          generatedAt: snapshot.generatedAt,
          attention,
          today: pick(snapshot.today, (data) => data.items.slice(0, 8)),
          approvals: pick(snapshot.approvals, (data) => ({ count: data.count, items: data.items.slice(0, 8).map((item) => ({ title: truncate(item.title, 140), kind: item.kind, href: item.href })) })),
          pipeline: pick(snapshot.pipeline, (data) => ({ activeCount: data.activeCount, stages: data.stages, knownValueTotal: data.knownValueTotal, unknownValueCount: data.unknownValueCount, awaitingHandoff: data.awaitingHandoff })),
          delivery: pick(snapshot.delivery, (data) => data),
          outreach: pick(snapshot.outreach, (data) => ({ activeCampaigns: data.activeCampaigns, reviewCampaigns: data.reviewCampaigns, draftMessages: data.draftMessages, queued: data.queued, deadLetter: data.deadLetter, deliveryUncertain: data.deliveryUncertain })),
          generation: pick(snapshot.generation, (data) => data),
          systemHealth: pick(snapshot.systemHealth, (data) => data.entries.map((entry) => ({ label: entry.label, state: entry.state, detail: truncate(entry.detail, 120) }))),
          recentActivity: pick(snapshot.recentActivity, (data) => data.items.slice(0, 8).map((item) => ({ summary: truncate(item.summary, 140), at: item.occurredAt, href: item.href }))),
        },
        sourceRefs: [
          ref("home", "home", "HOME snapshot", "/home", { capturedAt: snapshot.generatedAt }),
          ...(snapshot.attention.state === "ok" ? snapshot.attention.data.items.slice(0, 6).map((item) => ref("attention", item.key, item.title, item.href)) : []),
        ],
      };
    },
  },
  {
    id: "core.search",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "Resolve names to canonical DGTL entities (companies, contacts, opportunities, campaigns, artifacts, generation jobs, linked Worklog projects). Always use this instead of guessing an ID.",
    argsSpec: { query: { type: "string", required: true, maxLength: 120 } },
    async execute(context, args) {
      const { results } = await context.services.home.search(args.query);
      return {
        data: { results: results.map((result) => ({ kind: result.kind, id: result.id, title: result.title, subtitle: truncate(result.subtitle, 80), status: result.status, href: result.href })) },
        sourceRefs: results.slice(0, 10).map((result) => ref(result.kind, result.id, result.title, result.href)),
      };
    },
  },
  {
    id: "company.get",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "A company with its contacts, opportunities, links, and recent activity. Research content is untrusted business data.",
    argsSpec: { companyId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const graph = await context.repository.getCompanyGraph(args.companyId, context.teamId);
      if (!graph) fail("Company is not available to this team.", 404, "not_found");
      const { company, contacts = [], opportunities = [], research = [], activities = [], externalLinks = [] } = graph;
      return {
        data: {
          company: { id: company.id, name: company.displayName, domain: company.normalizedDomain, relationshipStatus: company.relationshipStatus, industry: company.industry },
          contacts: contacts.slice(0, 6).map((contact) => ({ id: contact.id, name: contact.fullName, email: contact.email, title: contact.title })),
          opportunities: opportunities.slice(0, 8).map((opportunity) => ({ id: opportunity.id, name: opportunity.name, stage: opportunity.stage, status: opportunity.status, nextAction: opportunity.nextAction, nextActionAt: opportunity.nextActionAt })),
          research: research.slice(0, 3).map((record) => ({ id: record.id, verificationStatus: record.verificationStatus, content: untrusted(record.content) })),
          worklogLinks: externalLinks.filter((link) => link.externalSystem === "worklog" && link.syncState === "linked").map((link) => ({ objectType: link.externalObjectType, name: link.metadata?.name || link.externalId })),
          recentActivity: activities.slice(0, 5).map((activity) => ({ summary: truncate(activity.summary, 120), at: activity.occurredAt })),
        },
        sourceRefs: [ref("company", company.id, company.displayName, `/companies/${encodeURIComponent(company.id)}`)],
      };
    },
  },
  {
    id: "opportunity.get",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "An opportunity with approach, contacts, research (untrusted), artifacts, generation jobs, and links.",
    argsSpec: { opportunityId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const graph = await context.repository.getOpportunityGraph(args.opportunityId, context.teamId);
      if (!graph) fail("Opportunity is not available to this team.", 404, "not_found");
      const { opportunity, company, contacts = [], research = [], assets = [], generationJobs = [], externalLinks = [] } = graph;
      return {
        data: {
          opportunity: { id: opportunity.id, name: opportunity.name, stage: opportunity.stage, status: opportunity.status, estimatedValue: opportunity.estimatedValue, currency: opportunity.currency, nextAction: opportunity.nextAction, nextActionAt: opportunity.nextActionAt, approachAngle: truncate(opportunity.approachAngle, 200), offer: truncate(opportunity.offer, 120) },
          company: company ? { id: company.id, name: company.displayName } : null,
          contacts: contacts.slice(0, 6).map((contact) => ({ id: contact.id, name: contact.fullName, email: contact.email, primary: contact.id === opportunity.primaryContactId })),
          research: research.slice(0, 3).map((record) => ({ id: record.id, verificationStatus: record.verificationStatus, content: untrusted(record.content) })),
          artifacts: assets.slice(0, 5).map((asset) => ({ id: asset.id, kind: asset.kind, slug: asset.slug, version: asset.versionNumber || asset.version, status: asset.status })),
          generationJobs: generationJobs.slice(0, 5).map((job) => ({ id: job.id, status: job.status, slug: job.slug })),
          worklogLink: externalLinks.find((link) => link.externalSystem === "worklog" && link.externalObjectType === "project" && link.syncState === "linked") ? true : false,
        },
        sourceRefs: [
          ref("opportunity", opportunity.id, opportunity.name, `/opportunities/${encodeURIComponent(opportunity.id)}`),
          ...(company ? [ref("company", company.id, company.displayName, `/companies/${encodeURIComponent(company.id)}`)] : []),
        ],
      };
    },
  },
  {
    id: "opportunity.get_activity",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "Recent canonical activity for one opportunity.",
    argsSpec: { opportunityId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const graph = await context.repository.getOpportunityGraph(args.opportunityId, context.teamId);
      if (!graph) fail("Opportunity is not available to this team.", 404, "not_found");
      return {
        data: { activity: (graph.activities || []).slice(0, 15).map((activity) => ({ type: activity.activityType, summary: truncate(activity.summary, 140), at: activity.occurredAt })) },
        sourceRefs: [ref("opportunity", graph.opportunity.id, graph.opportunity.name, `/opportunities/${encodeURIComponent(graph.opportunity.id)}`)],
      };
    },
  },
  {
    id: "campaign.get",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "A campaign with member count and message states.",
    argsSpec: { campaignId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const campaign = await context.repository.getCampaign(args.campaignId, context.teamId);
      if (!campaign) fail("Campaign is not available to this team.", 404, "not_found");
      const [members, messages] = await Promise.all([
        context.repository.listCampaignMembers(campaign.id, context.teamId),
        context.repository.listMessages(context.teamId, { campaignId: campaign.id }),
      ]);
      const byStatus = {};
      for (const message of messages) byStatus[message.status] = (byStatus[message.status] || 0) + 1;
      return {
        data: {
          campaign: { id: campaign.id, name: campaign.name, status: campaign.status, approvalState: campaign.approvalState },
          memberCount: members.length,
          messagesByStatus: byStatus,
          messages: messages.slice(0, 5).map((message) => ({ id: message.id, status: message.status, queueState: message.queueState, subject: truncate(message.subject, 100) })),
        },
        sourceRefs: [ref("campaign", campaign.id, campaign.name, `/campaigns/${campaign.id}`)],
      };
    },
  },
  {
    id: "campaign.get_status",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "Compact campaign status counts only.",
    argsSpec: { campaignId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const campaign = await context.repository.getCampaign(args.campaignId, context.teamId);
      if (!campaign) fail("Campaign is not available to this team.", 404, "not_found");
      const messages = await context.repository.listMessages(context.teamId, { campaignId: campaign.id });
      const byQueue = {};
      for (const message of messages) byQueue[message.queueState] = (byQueue[message.queueState] || 0) + 1;
      return {
        data: { id: campaign.id, name: campaign.name, approvalState: campaign.approvalState, status: campaign.status, messageCount: messages.length, byQueueState: byQueue },
        sourceRefs: [ref("campaign", campaign.id, campaign.name, `/campaigns/${campaign.id}`)],
      };
    },
  },
  {
    id: "generation.get_job",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "A generation job's state, validation outcome, and error metadata.",
    argsSpec: { jobId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const job = await context.repository.getGenerationJob(args.jobId, context.teamId);
      if (!job) fail("Generation job is not available to this team.", 404, "not_found");
      return {
        data: {
          job: { id: job.id, status: job.status, slug: job.slug, adapterId: job.adapterId, artifactKind: job.artifactKind, createdAt: job.createdAt },
          validation: job.validationResults?.passed !== undefined ? { passed: job.validationResults.passed, checks: job.validationResults.checks || {} } : null,
          error: job.errorMetadata?.message ? truncate(job.errorMetadata.message, 200) : "",
        },
        sourceRefs: [ref("generation_job", job.id, job.slug || job.id, `/generation-jobs/${job.id}`)],
      };
    },
  },
  {
    id: "artifact.get",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "An immutable artifact version's identity, status, and deployment URL.",
    argsSpec: { artifactId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const artifact = await context.repository.getArtifact(args.artifactId, context.teamId);
      if (!artifact) fail("Artifact is not available to this team.", 404, "not_found");
      return {
        data: { artifact: { id: artifact.id, kind: artifact.kind, slug: artifact.slug, version: artifact.versionNumber || artifact.version, status: artifact.status, deploymentUrl: artifact.deploymentUrl || "", checksum: truncate(artifact.contentChecksum, 16) } },
        sourceRefs: [ref("artifact", artifact.id, `${artifact.slug} v${artifact.versionNumber || artifact.version}`, `/artifacts/${artifact.id}`)],
      };
    },
  },
  {
    id: "worklog.get_delivery_summary",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "The Worklog delivery state for an opportunity from stored Stage 4 snapshots (Worklog stays authoritative; freshness included). Never calls Worklog live.",
    argsSpec: { opportunityId: { type: "string", required: true, maxLength: 80 } },
    async execute(context, args) {
      const view = await context.services.worklog.opportunityDeliveryView(args.opportunityId);
      return {
        data: {
          linked: Boolean(view.link),
          snapshot: view.snapshot ? { ...view.snapshot, source: "worklog" } : null,
          snapshotAt: view.snapshotAt || "",
          pendingOperations: (view.operations || []).filter((operation) => ["draft", "approved", "executing", "outcome_unknown"].includes(operation.status)).map((operation) => ({ id: operation.id, action: operation.action, status: operation.status })),
        },
        sourceRefs: [
          ref("opportunity", view.opportunity.id, view.opportunity.name, `/opportunities/${encodeURIComponent(view.opportunity.id)}`),
          ...(view.link ? [ref("worklog_project", view.link.externalId, view.link.metadata?.name || `Project ${view.link.externalId}`, `/operations/worklog`, { snapshotAt: view.snapshotAt || "" })] : []),
        ],
      };
    },
  },
  {
    id: "operations.list_exceptions",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "Open operational exceptions across all systems.",
    argsSpec: {},
    async execute(context) {
      const exceptions = await context.repository.listOperationExceptions(context.teamId, "open");
      return {
        data: { exceptions: exceptions.slice(0, 15).map((exception) => ({ id: exception.id, type: exception.exceptionType, severity: exception.severity, summary: truncate(exception.summary, 140), at: exception.createdAt })) },
        sourceRefs: [ref("operations", "exceptions", "Exception desk", "/operations/exceptions")],
      };
    },
  },
  {
    id: "activity.list_recent",
    classification: "read",
    allowedRoles: READ_ROLES,
    description: "Recent canonical business activity across the team.",
    argsSpec: {},
    async execute(context) {
      const activities = await context.repository.listTeamActivities(context.teamId, 15);
      return {
        data: { activity: activities.map((activity) => ({ type: activity.activityType, summary: truncate(activity.summary, 140), at: activity.occurredAt })) },
        sourceRefs: [ref("home", "activity", "Recent activity", "/home")],
      };
    },
  },

  // --------------------------------------------------------------- PREPARE
  {
    id: "message.prepare_followup",
    classification: "prepare",
    allowedRoles: WRITE_ROLES,
    description: "Propose a follow-up email draft for a contact on an opportunity. Produces a preview only; a human must click 'Create draft'. The created Message will be draft/unapproved/unqueued/unsent — chat can never queue or send.",
    argsSpec: {
      opportunityId: { type: "string", required: true, maxLength: 80 },
      contactId: { type: "string", maxLength: 80 },
      subject: { type: "string", required: true, maxLength: 200 },
      body: { type: "string", required: true, maxLength: 4000 },
    },
    async execute(context, args) {
      const graph = await context.repository.getOpportunityGraph(args.opportunityId, context.teamId);
      if (!graph) fail("Opportunity is not available to this team.", 404, "not_found");
      const contacts = graph.contacts || [];
      const contact = args.contactId
        ? contacts.find((row) => row.id === args.contactId)
        : contacts.find((row) => row.id === graph.opportunity.primaryContactId) || contacts[0];
      if (!contact) fail("No contact is available on this opportunity; add one first or specify contactId.", 409, "no_contact");
      if (!contact.email) fail(`Contact ${contact.fullName || contact.id} has no email address.`, 409, "no_contact_email");
      const payload = { opportunityId: graph.opportunity.id, contactId: contact.id, subject: args.subject, body: args.body, recipientEmail: contact.normalizedEmail || contact.email };
      return {
        proposalDraft: {
          actionId: "message.prepare_followup",
          targetEntityType: "opportunity",
          targetEntityId: graph.opportunity.id,
          payload,
          impactSummary: `Create ONE canonical draft Message to ${contact.fullName || contact.email} (${payload.recipientEmail}) on "${graph.opportunity.name}". It stays draft/unapproved/unqueued/unsent until the normal campaign approval flow.`,
          preconditions: { contactEmail: payload.recipientEmail, contactUpdatedAt: contact.updatedAt || "", opportunityUpdatedAt: graph.opportunity.updatedAt || "" },
        },
        data: { preview: { to: payload.recipientEmail, subject: args.subject, body: truncate(args.body, 500) } },
        sourceRefs: [
          ref("opportunity", graph.opportunity.id, graph.opportunity.name, `/opportunities/${encodeURIComponent(graph.opportunity.id)}`),
          ref("contact", contact.id, contact.fullName || contact.email, `/contacts/${encodeURIComponent(contact.id)}`),
        ],
      };
    },
  },
  {
    id: "generation.prepare_asset",
    classification: "prepare",
    allowedRoles: WRITE_ROLES,
    description: "Propose a Stage 3 sales-asset generation request (pitch). Produces a preview only; confirmation creates the normal draft GenerationJob — never approved, claimed, executed, or deployed by chat.",
    argsSpec: {
      opportunityId: { type: "string", required: true, maxLength: 80 },
      slug: { type: "string", required: true, maxLength: 60, pattern: /^[a-z0-9][a-z0-9-]{0,60}$/ },
      adapterId: { type: "string", default: "pitch.pages", enum: ["pitch.pages", "pitch.composer"] },
      artifactKind: { type: "string", default: "pitch", enum: ["pitch"] },
      instructions: { type: "string", maxLength: 600 },
      intendedCta: { type: "string", maxLength: 120 },
    },
    async execute(context, args) {
      const graph = await context.repository.getOpportunityGraph(args.opportunityId, context.teamId);
      if (!graph) fail("Opportunity is not available to this team.", 404, "not_found");
      requireGenerationAdapter(args.adapterId, args.artifactKind);
      const slug = safeSlug(args.slug);
      const payload = { opportunityId: graph.opportunity.id, slug, adapterId: args.adapterId, artifactKind: args.artifactKind, instructions: args.instructions || "", intendedCta: args.intendedCta || "" };
      return {
        proposalDraft: {
          actionId: "generation.prepare_asset",
          targetEntityType: "opportunity",
          targetEntityId: graph.opportunity.id,
          payload,
          impactSummary: `Create a Stage 3 generation brief (${args.adapterId}, slug "${slug}") for "${graph.opportunity.name}". The job starts as a draft brief requiring its own input approval; nothing generates, deploys, or sends.`,
          preconditions: { opportunityUpdatedAt: graph.opportunity.updatedAt || "", researchCount: (graph.research || []).length },
        },
        data: { preview: { adapter: args.adapterId, slug, researchAvailable: (graph.research || []).length, approachAngle: truncate(graph.opportunity.approachAngle, 160), offer: truncate(graph.opportunity.offer, 120), cta: args.intendedCta || "" } },
        sourceRefs: [ref("opportunity", graph.opportunity.id, graph.opportunity.name, `/opportunities/${encodeURIComponent(graph.opportunity.id)}`)],
      };
    },
  },
  {
    id: "worklog.prepare_handoff",
    classification: "prepare",
    allowedRoles: WRITE_ROLES,
    requiresWorklog: true,
    description: "Propose the Stage 4 Worklog delivery handoff for a won opportunity. Preview only; confirmation creates the normal draft IntegrationOperation — chat never approves, executes, or writes to Worklog.",
    argsSpec: {
      opportunityId: { type: "string", required: true, maxLength: 80 },
      budgetMinutes: { type: "number", min: 0, max: 10_000_000 },
      billable: { type: "boolean", default: true },
    },
    async execute(context, args) {
      const preview = await context.services.worklog.previewProjectHandoff(args.opportunityId, { budgetMinutes: args.budgetMinutes, billable: args.billable });
      const existing = await context.services.worklog.linkedLinkFor("opportunity", preview.opportunity.id, "project");
      if (existing) fail("This opportunity is already linked to a Worklog project.", 409, "already_linked");
      const payload = { opportunityId: preview.opportunity.id, budgetMinutes: args.budgetMinutes ?? null, billable: args.billable !== false };
      return {
        proposalDraft: {
          actionId: "worklog.prepare_handoff",
          targetEntityType: "opportunity",
          targetEntityId: preview.opportunity.id,
          payload,
          impactSummary: `Draft the Stage 4 Worklog handoff for "${preview.opportunity.name}": project "${preview.payload.name}" for client "${preview.payload.clientName}" (code ${preview.payload.code}). The IntegrationOperation stays draft until its own owner/admin approval and execution; no Worklog write happens now.${preview.willCreateClient ? ` Worklog client "${preview.payload.clientName}" would be created with the project.` : ""}`,
          preconditions: { opportunityUpdatedAt: preview.opportunity.updatedAt || "", proposedName: preview.payload.name, proposedClient: preview.payload.clientName },
        },
        data: { preview: preview.payload },
        sourceRefs: [ref("opportunity", preview.opportunity.id, preview.opportunity.name, `/opportunities/${encodeURIComponent(preview.opportunity.id)}`)],
      };
    },
  },
  {
    id: "opportunity.prepare_next_action",
    classification: "prepare",
    allowedRoles: WRITE_ROLES,
    description: "Propose updating an opportunity's next action and due date. Preview shows current vs new; confirmation applies the narrow update only.",
    argsSpec: {
      opportunityId: { type: "string", required: true, maxLength: 80 },
      nextAction: { type: "string", required: true, maxLength: 200 },
      nextActionAt: { type: "string", required: true, maxLength: 30, pattern: /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/ },
    },
    async execute(context, args) {
      const opportunity = await requireOpportunity(context, args.opportunityId);
      const nextActionAt = new Date(args.nextActionAt);
      if (Number.isNaN(nextActionAt.getTime())) fail("nextActionAt must be a valid date.");
      const payload = { opportunityId: opportunity.id, nextAction: args.nextAction, nextActionAt: nextActionAt.toISOString() };
      return {
        proposalDraft: {
          actionId: "opportunity.prepare_next_action",
          targetEntityType: "opportunity",
          targetEntityId: opportunity.id,
          payload,
          impactSummary: `Change "${opportunity.name}" next action from "${opportunity.nextAction || "(none)"}" (${opportunity.nextActionAt || "no date"}) to "${args.nextAction}" due ${payload.nextActionAt.slice(0, 10)}. Nothing else changes.`,
          preconditions: { currentNextAction: opportunity.nextAction || "", currentNextActionAt: opportunity.nextActionAt || "", opportunityUpdatedAt: opportunity.updatedAt || "" },
        },
        data: { preview: { current: { nextAction: opportunity.nextAction || "", nextActionAt: opportunity.nextActionAt || "" }, proposed: { nextAction: args.nextAction, nextActionAt: payload.nextActionAt } } },
        sourceRefs: [ref("opportunity", opportunity.id, opportunity.name, `/opportunities/${encodeURIComponent(opportunity.id)}`)],
      };
    },
  },
];

export const TOOL_INDEX = Object.freeze(Object.fromEntries(TOOLS.map((tool) => [tool.id, tool])));

export function toolsForActor(actor, { worklogConfigured = false } = {}) {
  return TOOLS.filter((tool) => tool.allowedRoles.includes(actor?.role) && (!tool.requiresWorklog || worklogConfigured));
}

export function requireTool(toolId, actor, { worklogConfigured = false } = {}) {
  const tool = TOOL_INDEX[toolId];
  if (!tool) fail(`Unknown tool: ${String(toolId).slice(0, 60)}.`, 400, "unknown_tool");
  if (!tool.allowedRoles.includes(actor?.role)) fail(`Tool ${toolId} is not available to this role.`, 403, "tool_forbidden");
  if (tool.requiresWorklog && !worklogConfigured) fail(`Tool ${toolId} requires the Worklog connector to be configured.`, 409, "tool_unavailable");
  return tool;
}

export function validateToolArgs(tool, args) {
  return validateArgs(args, tool.argsSpec, tool.id);
}

export function hashPayload(payload) {
  const canonical = (value) => Array.isArray(value)
    ? `[${value.map(canonical).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
      : JSON.stringify(value ?? null);
  return crypto.createHash("sha256").update(canonical(payload)).digest("hex");
}
