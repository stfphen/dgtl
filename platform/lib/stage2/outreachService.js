import crypto from "node:crypto";
import { createCoreId, stableFingerprint } from "../core/ids.js";
import { CoreService } from "../core/service.js";
import { normalizeDomain, normalizeEmail } from "./normalization.js";
import { evaluateCoreRatePolicy, loadCoreRatePolicy, retryDelayMs } from "./ratePolicy.js";
import { createTestTransport } from "./testTransport.js";

const WRITE_ROLES = new Set(["owner", "admin", "sales"]);
const APPROVE_ROLES = new Set(["owner", "admin"]);
const SUPPRESSION_EVENTS = new Map([["bounced", "hard_bounce"], ["complained", "complaint"], ["rejected", "provider_rejection"]]);
const ACTIVITY_EVENTS = new Set(["queued", "sent", "delivered", "delivery_delayed", "bounced", "complained", "rejected", "failed", "reply_received"]);

function required(value, label) { const result = String(value || "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }
function requireRole(role, allowed, operation) { if (!allowed.has(role)) throw Object.assign(new Error(`Role ${role || "unknown"} cannot ${operation}.`), { status: 403 }); }
function contentHash(subject, body) { return crypto.createHash("sha256").update(`${subject}\n\n${body}`).digest("hex"); }
function approvalHash({ subject, body, recipientEmail, senderEmail }) { return crypto.createHash("sha256").update([normalizeEmail(senderEmail), normalizeEmail(recipientEmail), String(subject || ""), String(body || "")].join("\n")).digest("hex"); }

export function buildPersonalizationContext({ company, contact, opportunity, research = [], campaign }) {
  return Object.freeze({
    company: { id: company.id, name: company.displayName, domain: company.normalizedDomain, website: company.websiteUrl, industry: company.industry, category: company.category, location: [company.city, company.region, company.country].filter(Boolean).join(", ") },
    contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, fullName: contact.fullName, title: contact.title, role: contact.role, email: contact.normalizedEmail || contact.email },
    opportunity: { id: opportunity.id, name: opportunity.name, stage: opportunity.stage, approachAngle: opportunity.approachAngle, offer: opportunity.offer, entryOffer: opportunity.entryOffer, qualification: opportunity.qualification },
    research: research.map((item) => ({ id: item.id, category: item.signalCategory, content: item.content, sourceType: item.sourceType, sourceUrl: item.sourceUrl, capturedAt: item.capturedAt, verificationStatus: item.verificationStatus })),
    campaign: { id: campaign.id, name: campaign.name, instructions: campaign.personalizationConfig?.instructions || "", sequence: campaign.sequence || [] }
  });
}

export function renderPersonalizedMessage(template = {}, context = {}) {
  const values = {
    first_name: context.contact?.firstName || context.contact?.fullName || "there",
    full_name: context.contact?.fullName || "",
    company: context.company?.name || "",
    title: context.contact?.title || "",
    approach_angle: context.opportunity?.approachAngle || "",
    offer: context.opportunity?.entryOffer || context.opportunity?.offer || "",
    recent_signal: context.research?.find((item) => item.category === "recent_signal")?.content || context.research?.[0]?.content || ""
  };
  const render = (value) => String(value || "").replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => values[key] ?? "");
  return { subject: render(template.subject), body: render(template.body) };
}

export class OutreachService {
  constructor({ teamId, actor = {}, repository, transport = createTestTransport(), ratePolicy = loadCoreRatePolicy(), leaseMs = 5 * 60_000, idFactory = createCoreId, now = () => new Date().toISOString() } = {}) {
    this.teamId = required(teamId, "teamId"); this.actor = actor; this.repository = repository;
    this.transport = transport; this.ratePolicy = ratePolicy; this.leaseMs = leaseMs; this.idFactory = idFactory; this.now = now;
  }
  listCampaigns() { return this.repository.listCampaigns(this.teamId); }
  async getCampaign(id) {
    const campaign = await this.repository.getCampaign(required(id, "campaignId"), this.teamId);
    if (!campaign) return null;
    return { ...campaign, members: await this.repository.listCampaignMembers(campaign.id, this.teamId), messages: await this.repository.listMessages(this.teamId, { campaignId: campaign.id }) };
  }
  async createCampaign(input = {}) {
    requireRole(this.actor.role, WRITE_ROLES, "create campaigns");
    const at = this.now();
    return this.repository.createCampaign({
      id: this.idFactory("campaign"), teamId: this.teamId, tenantId: input.tenantId || "", name: required(input.name, "name"), kind: "outreach",
      status: "draft", ownerUserId: input.ownerUserId || this.actor.id || "", source: input.source || "canonical",
      audienceDefinition: input.audienceDefinition || {}, sequence: input.sequence || [], sendingIdentity: input.sendingIdentity || {},
      approvalState: "draft", personalizationConfig: input.personalizationConfig || {}, metrics: {}, metadata: input.metadata || {}, createdAt: at, updatedAt: at
    });
  }
  async addCohort(campaignId, selections = []) {
    requireRole(this.actor.role, WRITE_ROLES, "edit campaign cohorts");
    const campaign = await this.repository.getCampaign(campaignId, this.teamId);
    if (!campaign) throw new Error("Campaign is not available to this team.");
    const core = new CoreService({ teamId: this.teamId, repository: this.repository });
    const added = [];
    for (const selection of selections) {
      const opportunity = await core.getOpportunity(selection.opportunityId);
      const contact = await core.getContact(selection.contactId || opportunity?.primaryContactId);
      if (!opportunity || !contact) throw new Error("Campaign members must reference available canonical opportunities and contacts.");
      if (contact.companyId && contact.companyId !== opportunity.companyId) throw new Error("Campaign contact and opportunity must belong to the same company.");
      const member = await this.repository.addCampaignMember({ id: this.idFactory("campaignMember"), teamId: this.teamId, tenantId: campaign.tenantId, campaignId, opportunityId: opportunity.id, contactId: contact.id, importBatchId: selection.importBatchId || opportunity.importBatchId || "", status: "active", personalizationContext: {}, createdBy: this.actor.id || "", createdAt: this.now(), updatedAt: this.now() });
      if (member) added.push(member);
    }
    if (added.length && campaign.approvalState === "approved") await this.repository.updateCampaign(campaign.id, this.teamId, { status: "draft", approvalState: "draft", approvedBy: "", approvedAt: "", updatedAt: this.now() });
    return added;
  }
  async draftMessages(campaignId, template) {
    requireRole(this.actor.role, WRITE_ROLES, "draft messages");
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign is not available to this team.");
    const core = new CoreService({ teamId: this.teamId, repository: this.repository });
    const created = [];
    for (const member of campaign.members) {
      if (campaign.messages.some((message) => message.opportunityId === member.opportunityId && message.contactId === member.contactId)) continue;
      const [opportunity, contact] = await Promise.all([core.getOpportunity(member.opportunityId), core.getContact(member.contactId)]);
      const graph = await core.getOpportunityGraph(opportunity.id);
      const context = buildPersonalizationContext({ company: graph.company, contact, opportunity, research: graph.research, campaign });
      const rendered = renderPersonalizedMessage(template, context);
      if (!rendered.subject.trim() || !rendered.body.trim()) {
        await this.exception("failed_personalization", "message", member.id, "Personalization produced empty content.", { campaignId });
        continue;
      }
      const at = this.now();
      const message = await this.repository.createMessage({
        id: this.idFactory("message"), teamId: this.teamId, tenantId: campaign.tenantId, opportunityId: opportunity.id, campaignId,
        contactId: contact.id, channel: "email", direction: "outbound", subject: rendered.subject, body: rendered.body, renderedSubject: rendered.subject,
        renderedBody: rendered.body, contentHash: contentHash(rendered.subject, rendered.body), status: "draft", recipientEmail: contact.normalizedEmail || normalizeEmail(contact.email),
        senderEmail: campaign.sendingIdentity?.email || "", personalizationContext: context, provider: "test", queueState: "not_queued", attemptCount: 0,
        maxAttempts: 3, metadata: { template }, createdAt: at, updatedAt: at
      });
      await core.createActivity({ companyId: opportunity.companyId, contactId: contact.id, opportunityId: opportunity.id, campaignId, messageId: message.id, activityType: "message_drafted", actorType: "user", actorId: this.actor.id, summary: `Drafted for ${contact.fullName || contact.email}` });
      created.push(message);
    }
    if (created.length) await this.repository.updateCampaign(campaign.id, this.teamId, { status: "review", approvalState: "review", updatedAt: this.now() });
    return created;
  }
  async approveCampaign(campaignId) {
    requireRole(this.actor.role, APPROVE_ROLES, "approve campaigns");
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign is not available to this team.");
    if (!campaign.members.length) throw new Error("Campaign requires at least one canonical cohort member.");
    if (!campaign.messages.length) throw new Error("Campaign requires at least one rendered message.");
    const at = this.now();
    return this.repository.updateCampaign(campaign.id, this.teamId, { status: "approved", approvalState: "approved", approvedBy: this.actor.id || "", approvedAt: at, updatedAt: at });
  }
  async editMessage(messageId, { subject, body }) {
    requireRole(this.actor.role, WRITE_ROLES, "edit messages");
    const message = await this.repository.getMessage(messageId, this.teamId);
    if (!message) throw new Error("Message is not available to this team.");
    const hash = contentHash(subject, body);
    const changedAfterApproval = message.approvedContentHash && message.approvedContentHash !== approvalHash({ subject, body, recipientEmail: message.approvedRecipientEmail, senderEmail: message.approvedSenderEmail });
    return this.repository.updateMessage(message.id, this.teamId, {
      subject, body, renderedSubject: subject, renderedBody: body, contentHash: hash,
      ...(changedAfterApproval ? { status: "draft", approvedSubject: "", approvedBody: "", approvedContentHash: "", approvedRecipientEmail: "", approvedSenderEmail: "", approvedBy: "", approvedAt: "", queueState: "not_queued" } : {}), updatedAt: this.now()
    });
  }
  async approveMessage(messageId) {
    requireRole(this.actor.role, APPROVE_ROLES, "approve messages");
    const message = await this.repository.getMessage(messageId, this.teamId);
    if (!message) throw new Error("Message is not available to this team.");
    if (!message.recipientEmail) throw new Error("Recipient email is required before approval.");
    const contact = await this.repository.getContact(message.contactId, this.teamId);
    if (!contact || normalizeEmail(contact.normalizedEmail || contact.email) !== normalizeEmail(message.recipientEmail)) throw new Error("Message recipient no longer matches the team-owned contact.");
    const at = this.now();
    const approvedRecipientEmail = normalizeEmail(message.recipientEmail);
    const approvedSenderEmail = normalizeEmail(message.senderEmail);
    const approved = await this.repository.updateMessage(message.id, this.teamId, { status: "approved", approvedSubject: message.renderedSubject, approvedBody: message.renderedBody, approvedRecipientEmail, approvedSenderEmail, approvedContentHash: approvalHash({ subject: message.renderedSubject, body: message.renderedBody, recipientEmail: approvedRecipientEmail, senderEmail: approvedSenderEmail }), approvedBy: this.actor.id || "", approvedAt: at, updatedAt: at });
    await this.activityForMessage(approved, "message_approved", "Message content approved");
    return approved;
  }
  async queueMessage(messageId, { scheduledAt = "" } = {}) {
    requireRole(this.actor.role, APPROVE_ROLES, "queue messages");
    const message = await this.repository.getMessage(messageId, this.teamId);
    if (!message || message.status !== "approved" || !message.approvedContentHash) throw new Error("Only an approved immutable message can be queued.");
    const campaign = await this.repository.getCampaign(message.campaignId, this.teamId);
    if (!campaign || campaign.approvalState !== "approved") throw new Error("Campaign approval is required before queueing.");
    await this.assertApprovalIntegrity(message);
    const suppressions = await this.repository.listSuppressions(this.teamId);
    const email = normalizeEmail(message.approvedRecipientEmail); const domain = normalizeDomain(email.split("@")[1]);
    const suppression = suppressions.find((item) => item.normalizedEmail === email || (item.normalizedDomain && item.normalizedDomain === domain));
    if (suppression) {
      const blocked = await this.repository.updateMessage(message.id, this.teamId, { status: "suppressed", queueState: "suppressed", failureReason: suppression.reason, updatedAt: this.now() });
      await this.exception("suppressed_recipient", "message", message.id, "Recipient is suppressed.", { suppressionId: suppression.id, reason: suppression.reason });
      await this.activityForMessage(blocked, "suppression_applied", `Suppressed: ${suppression.reason}`);
      return blocked;
    }
    const queued = await this.repository.updateMessage(message.id, this.teamId, { status: "queued", queueState: "queued", scheduledAt: scheduledAt || this.now(), nextAttemptAt: scheduledAt || this.now(), idempotencyKey: message.idempotencyKey || `core:${this.teamId}:${message.id}:${message.approvedContentHash}`, updatedAt: this.now() });
    await this.activityForMessage(queued, "message_queued", "Message added to durable outbox");
    return queued;
  }
  async processOutbox({ limit = 50, workerId = "stage2-test-worker" } = {}) {
    if (!this.transport?.authorized || !["test", "production"].includes(this.transport?.mode)) throw new Error("Outbox transport is not explicitly authorized.");
    const now = this.now();
    const leaseCutoff = new Date(new Date(now).getTime() - this.leaseMs).toISOString();
    await this.repository.recordWorkerHeartbeat({ teamId: this.teamId, workerId, state: "running", lastStartedAt: now, metadata: { transport: this.transport.name }, updatedAt: now });
    try {
      const recovered = await this.repository.recoverExpiredLeases(this.teamId, leaseCutoff, now);
      for (const item of recovered.filter((entry) => entry.outcomeUnknown)) {
        await this.exception("delivery_outcome_uncertain", "message", item.id, "Worker lease expired after delivery began; automatic retry is blocked.", { previousWorker: item.lockedBy || "" });
        await this.activityForMessage(item, "delivery_uncertain", "Delivery outcome requires manual provider review");
      }
      const claimLimit = Math.min(Math.max(Number(limit) || 1, 1), 100, this.ratePolicy.batchLimit);
      const claimed = await this.repository.claimDueMessages(this.teamId, now, claimLimit, workerId, leaseCutoff, this.ratePolicy.workerConcurrency);
      const sentSince = new Date(new Date(now).getTime() - 24 * 60 * 60_000).toISOString();
      const rateUsage = await this.repository.listRatePolicyUsage(this.teamId, sentSince);
      const sentThisCycle = [];
      const results = [];
      for (const message of claimed) {
        const current = await this.repository.getMessage(message.id, this.teamId);
        if (!current || current.queueState !== "sending" || current.lockedBy !== workerId) { results.push({ id: message.id, outcome: "already_finalized" }); continue; }
        const held = await this.preflightClaimedMessage(current, workerId, now);
        if (held) { results.push(held); continue; }
        const rate = evaluateCoreRatePolicy({ message: current, sentMessages: rateUsage, cycleMessages: sentThisCycle, policy: this.ratePolicy });
        if (!rate.allowed) {
          const retryAt = new Date(new Date(now).getTime() + this.ratePolicy.retryBackoffMaxMs).toISOString();
          await this.repository.updateMessage(current.id, this.teamId, { status: "queued", queueState: "retry", nextAttemptAt: retryAt, failureReason: rate.reason, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
          results.push({ id: current.id, outcome: "rate_limited", reason: rate.reason }); continue;
        }
        const attemptNumber = Number(current.attemptCount || 0) + 1;
        const attemptId = this.idFactory("deliveryAttempt");
        await this.repository.createDeliveryAttempt({ id: attemptId, teamId: this.teamId, messageId: current.id, attemptNumber, transport: this.transport.name, status: "sending", providerMessageId: "", errorCode: "", errorMessage: "", startedAt: this.now(), completedAt: null, metadata: {} });
        let result;
        try { result = await this.transport.send({ idempotencyKey: current.idempotencyKey, from: current.approvedSenderEmail, to: current.approvedRecipientEmail, subject: current.approvedSubject, body: current.approvedBody }); }
        catch (error) { result = { ok: false, outcomeUnknown: true, retryable: false, code: "transport_unknown_result", error: error.message }; }
        await this.repository.updateDeliveryAttempt(attemptId, this.teamId, { status: result.ok ? "sent" : (result.outcomeUnknown ? "outcome_unknown" : "failed"), providerMessageId: result.providerMessageId || "", errorCode: result.code || "", errorMessage: result.error || "", completedAt: this.now(), metadata: { simulated: result.simulated === true, duplicate: result.duplicate === true, ...(result.providerMetadata || {}) } });
        if (result.outcomeUnknown) {
          const uncertain = await this.repository.updateMessage(current.id, this.teamId, { status: "delivery_uncertain", queueState: "delivery_uncertain", attemptCount: attemptNumber, lastAttemptAt: now, deliveryUncertainAt: this.now(), failureReason: result.error || result.code, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
          await this.exception("delivery_outcome_uncertain", "message", current.id, "Provider outcome is unknown; automatic retry is blocked.", { attemptNumber, code: result.code });
          await this.activityForMessage(uncertain, "delivery_uncertain", "Provider outcome requires manual review", { attemptNumber });
          results.push({ id: current.id, outcome: "delivery_uncertain" }); continue;
        }
        if (result.ok) {
          const sent = await this.repository.updateMessage(current.id, this.teamId, { status: "sent", queueState: "sent", attemptCount: attemptNumber, lastAttemptAt: now, sentAt: this.now(), provider: this.transport.name, externalMessageId: result.providerMessageId, providerMetadata: { simulated: result.simulated === true, ...(result.providerMetadata || {}) }, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
          if (sent) { await this.activityForMessage(sent, "sent", `${this.transport.name} accepted message`, { providerMessageId: result.providerMessageId, simulated: result.simulated === true }); sentThisCycle.push(sent); results.push({ id: sent.id, outcome: "sent" }); }
          continue;
        }
        const exhausted = !result.retryable || attemptNumber >= Number(current.maxAttempts || 3);
        const retryAt = new Date(new Date(now).getTime() + retryDelayMs(attemptNumber, this.ratePolicy)).toISOString();
        const failed = await this.repository.updateMessage(current.id, this.teamId, { status: exhausted ? "dead_letter" : "queued", queueState: exhausted ? "dead_letter" : "retry", attemptCount: attemptNumber, lastAttemptAt: now, nextAttemptAt: exhausted ? "" : retryAt, permanentFailureAt: !result.retryable ? now : "", deadLetteredAt: exhausted ? now : "", failureReason: result.error || result.code, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
        if (exhausted) await this.exception("dead_letter_message", "message", current.id, "Message exhausted delivery attempts.", { attempts: attemptNumber, reason: result.error });
        await this.activityForMessage(failed, exhausted ? "failed" : "message_retry_scheduled", exhausted ? "Message dead-lettered" : "Retry scheduled", { attemptNumber });
        results.push({ id: current.id, outcome: exhausted ? "dead_letter" : "retry" });
      }
      await this.repository.recordWorkerHeartbeat({ teamId: this.teamId, workerId, state: "idle", lastSuccessAt: this.now(), lastErrorCode: "", metadata: { transport: this.transport.name, processed: results.length }, updatedAt: this.now() });
      return results;
    } catch (error) {
      await this.repository.recordWorkerHeartbeat({ teamId: this.teamId, workerId, state: "error", lastErrorAt: this.now(), lastErrorCode: error.code || error.name || "worker_error", metadata: { transport: this.transport.name }, updatedAt: this.now() });
      throw error;
    }
  }
  approvalIntegrityIssue(message, contact) {
    if (!message?.approvedContentHash) return "Approval snapshot is missing.";
    const expected = approvalHash({ subject: message.approvedSubject, body: message.approvedBody, recipientEmail: message.approvedRecipientEmail, senderEmail: message.approvedSenderEmail });
    if (expected !== message.approvedContentHash) return "Approved envelope/content hash does not match its snapshot.";
    if (message.approvedSubject !== message.renderedSubject || message.approvedBody !== message.renderedBody || message.contentHash !== contentHash(message.renderedSubject, message.renderedBody)) return "Rendered message changed after approval.";
    if (normalizeEmail(message.recipientEmail) !== normalizeEmail(message.approvedRecipientEmail) || normalizeEmail(message.senderEmail) !== normalizeEmail(message.approvedSenderEmail)) return "Message envelope changed after approval.";
    if (!contact || normalizeEmail(contact.normalizedEmail || contact.email) !== normalizeEmail(message.approvedRecipientEmail)) return "Contact email changed after approval.";
    return "";
  }
  async assertApprovalIntegrity(message) {
    const contact = await this.repository.getContact(message.contactId, this.teamId);
    const issue = this.approvalIntegrityIssue(message, contact);
    if (!issue) return;
    await this.repository.updateMessage(message.id, this.teamId, { status: "draft", queueState: "not_queued", approvedContentHash: "", approvedRecipientEmail: "", approvedSenderEmail: "", approvedBy: "", approvedAt: "", failureReason: issue, updatedAt: this.now() });
    throw new Error(`Message approval is invalid: ${issue}`);
  }
  async preflightClaimedMessage(message, workerId, now) {
    const campaign = await this.repository.getCampaign(message.campaignId, this.teamId);
    if (!campaign || campaign.status === "paused") {
      await this.repository.updateMessage(message.id, this.teamId, { status: "paused", queueState: "paused", failureReason: "Campaign paused after queueing.", lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
      return { id: message.id, outcome: "campaign_paused" };
    }
    if (campaign.approvalState !== "approved") {
      await this.repository.updateMessage(message.id, this.teamId, { status: "review_required", queueState: "review_required", failureReason: "Campaign approval changed after queueing.", lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
      await this.exception("message_review_required", "message", message.id, "Campaign approval changed after queueing.");
      return { id: message.id, outcome: "review_required" };
    }
    const contact = await this.repository.getContact(message.contactId, this.teamId);
    const approvalIssue = this.approvalIntegrityIssue(message, contact);
    if (approvalIssue) {
      const held = await this.repository.updateMessage(message.id, this.teamId, { status: "review_required", queueState: "review_required", failureReason: approvalIssue, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
      await this.exception("message_review_required", "message", message.id, approvalIssue);
      await this.activityForMessage(held, "message_review_required", approvalIssue);
      return { id: message.id, outcome: "review_required" };
    }
    const suppressions = await this.repository.listSuppressions(this.teamId);
    const email = normalizeEmail(message.approvedRecipientEmail);
    const domain = normalizeDomain(email.split("@")[1]);
    const suppression = suppressions.find((item) => item.normalizedEmail === email || (item.normalizedDomain && item.normalizedDomain === domain));
    if (suppression) {
      const blocked = await this.repository.updateMessage(message.id, this.teamId, { status: "suppressed", queueState: "suppressed", failureReason: suppression.reason, lockedAt: "", lockedBy: "", updatedAt: this.now() }, { queueState: "sending", lockedBy: workerId });
      await this.exception("suppressed_recipient", "message", message.id, "Recipient became suppressed after queueing.", { suppressionId: suppression.id, reason: suppression.reason });
      await this.activityForMessage(blocked, "suppression_applied", `Suppressed before delivery: ${suppression.reason}`);
      return { id: message.id, outcome: "suppressed" };
    }
    return null;
  }
  async retryMessage(messageId) {
    requireRole(this.actor.role, APPROVE_ROLES, "retry messages");
    const message = await this.repository.getMessage(messageId, this.teamId);
    if (!message || !["dead_letter", "failed"].includes(message.queueState)) throw new Error("Only failed or dead-letter messages can be retried.");
    return this.repository.updateMessage(message.id, this.teamId, { status: "queued", queueState: "retry", maxAttempts: Number(message.attemptCount || 0) + 1, nextAttemptAt: this.now(), deadLetteredAt: "", permanentFailureAt: "", lockedAt: "", lockedBy: "", updatedAt: this.now() });
  }
  async resolveException(exceptionId, { resolution = "resolved", assignedTo = "" } = {}) {
    requireRole(this.actor.role, APPROVE_ROLES, "resolve exceptions");
    const exceptions = await this.repository.listOperationExceptions(this.teamId, "open");
    const exception = exceptions.find((item) => item.id === exceptionId);
    if (!exception) throw new Error("Open exception is not available to this team.");
    const at = this.now();
    return this.repository.updateOperationException(exception.id, this.teamId, { status: "resolved", assignedTo, resolvedBy: this.actor.id || "", resolvedAt: at, resolution: { action: resolution }, updatedAt: at });
  }
  async recordProviderEvent(input = {}) {
    const candidates = input.messageId ? [await this.repository.getMessage(input.messageId, this.teamId)].filter(Boolean) : await this.repository.findMessagesByExternalId(this.teamId, input.providerMessageId);
    const message = candidates.length === 1 ? candidates[0] : null;
    const event = await this.repository.createProviderEvent({ id: this.idFactory("providerEvent"), teamId: this.teamId, messageId: message?.id || "", provider: required(input.provider, "provider"), providerEventId: required(input.providerEventId, "providerEventId"), providerMessageId: input.providerMessageId || message?.externalMessageId || "", eventType: required(input.eventType, "eventType"), occurredAt: input.occurredAt || this.now(), payloadReference: input.payloadReference || "", metadata: { ...(input.metadata || {}), associationState: message ? "associated" : "review_required", candidateMessageIds: candidates.map((item) => item.id) }, createdAt: this.now() });
    if (event.duplicate) return event;
    if (!message) {
      await this.exception("unmatched_provider_event", "provider_event", event.id, "Signed provider event could not be deterministically associated.", { providerMessageId: input.providerMessageId, candidateMessageIds: candidates.map((item) => item.id) });
      return event;
    }
    const deliveryMessage = await this.repository.updateMessage(message.id, this.teamId, { status: event.eventType, providerMetadata: { ...(message.providerMetadata || {}), lastEventType: event.eventType, lastProviderEventId: event.providerEventId, lastProviderEventAt: event.occurredAt }, updatedAt: this.now() }) || message;
    if (SUPPRESSION_EVENTS.has(event.eventType)) await this.createSystemSuppression({ email: message.approvedRecipientEmail || message.recipientEmail, contactId: message.contactId, reason: SUPPRESSION_EVENTS.get(event.eventType), source: "provider", provider: event.provider, externalEventId: event.providerEventId });
    if (event.eventType === "failed") await this.exception("provider_failed", "message", message.id, "Provider reported a delivery failure.", { providerEventId: event.providerEventId });
    if (ACTIVITY_EVENTS.has(event.eventType)) await this.activityForMessage(deliveryMessage, event.eventType, `Provider event: ${event.eventType}`, { providerEventId: event.providerEventId });
    return event;
  }
  async suppress(input = {}) {
    requireRole(this.actor.role, APPROVE_ROLES, "manage suppressions");
    return this.createSystemSuppression(input);
  }
  async createSystemSuppression(input = {}) {
    const at = this.now();
    return this.repository.createSuppression({ id: this.idFactory("suppression"), teamId: this.teamId, tenantId: input.tenantId || "", contactId: input.contactId || "", normalizedEmail: normalizeEmail(input.email), normalizedDomain: normalizeDomain(input.domain), reason: required(input.reason, "reason"), source: input.source || "manual", provider: input.provider || "", externalEventId: input.externalEventId || "", metadata: input.metadata || {}, active: true, createdBy: this.actor.id || "", createdAt: at, updatedAt: at });
  }
  async getHealth({ activeWindowMs = 10 * 60_000 } = {}) {
    const activeSince = new Date(new Date(this.now()).getTime() - activeWindowMs).toISOString();
    return {
      ...(await this.repository.getOperationalHealth(this.teamId, activeSince)),
      providerAdapterMode: this.transport.name,
      productionTransportEnabled: this.transport.mode === "production" && this.transport.authorized === true
    };
  }
  async associateReply(input = {}) {
    const all = await this.repository.listMessages(this.teamId);
    let candidates = [];
    if (input.inReplyTo) candidates = all.filter((item) => item.externalMessageId === input.inReplyTo);
    if (!candidates.length && input.senderEmail) candidates = all.filter((item) => normalizeEmail(item.recipientEmail) === normalizeEmail(input.senderEmail) && item.status === "sent");
    candidates.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
    const exact = input.inReplyTo && candidates.length === 1 ? candidates[0] : (!input.inReplyTo && candidates.length === 1 ? candidates[0] : null);
    const at = input.receivedAt || this.now();
    const reply = await this.repository.createInboundReply({ id: this.idFactory("inboundReply"), teamId: this.teamId, messageId: exact?.id || "", contactId: exact?.contactId || "", companyId: exact?.personalizationContext?.company?.id || "", opportunityId: exact?.opportunityId || "", campaignId: exact?.campaignId || "", provider: input.provider || "fixture", providerMessageId: input.providerMessageId || "", inReplyTo: input.inReplyTo || "", normalizedSender: normalizeEmail(input.senderEmail), associationState: exact ? "associated" : "review_required", candidateMessageIds: candidates.map((item) => item.id), receivedAt: at, metadata: input.metadata || {}, createdAt: this.now(), updatedAt: this.now() });
    if (exact) await this.activityForMessage(exact, "reply_received", "Reply associated with outbound message", { inboundReplyId: reply.id });
    else await this.exception("unresolved_reply", "inbound_reply", reply.id, "Inbound reply requires association review.", { candidateMessageIds: reply.candidateMessageIds });
    return reply;
  }
  async exception(type, entityType, entityId, summary, details = {}) {
    const at = this.now();
    return this.repository.createOperationException({ id: this.idFactory("operationException"), teamId: this.teamId, exceptionType: type, severity: "warning", sourceEntityType: entityType, sourceEntityId: entityId, status: "open", summary, details, createdAt: at, updatedAt: at });
  }
  async activityForMessage(message, activityType, summary, metadata = {}) {
    if (!message) return null;
    const core = new CoreService({ teamId: this.teamId, repository: this.repository, idFactory: this.idFactory, now: this.now });
    return core.createActivity({ companyId: message.personalizationContext?.company?.id || "", contactId: message.contactId, opportunityId: message.opportunityId, campaignId: message.campaignId, messageId: message.id, activityType, actorType: this.actor.id ? "user" : "system", actorId: this.actor.id || "", summary, metadata });
  }
}

export { approvalHash, contentHash };
