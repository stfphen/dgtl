import { MemoryCoreRepository } from "../core/memoryRepository.js";

function clone(value) { return structuredClone(value); }

export class MemoryStage2Repository extends MemoryCoreRepository {
  constructor(seed = {}) {
    super(seed);
    this.importBatches = clone(seed.importBatches || []);
    this.importRows = clone(seed.importRows || []);
    this.importReviews = clone(seed.importReviews || []);
    this.campaignMembers = clone(seed.campaignMembers || []);
    this.deliveryAttempts = clone(seed.deliveryAttempts || []);
    this.suppressions = clone(seed.suppressions || []);
    this.legacySuppressions = clone(seed.legacySuppressions || []);
    this.providerEvents = clone(seed.providerEvents || []);
    this.inboundReplies = clone(seed.inboundReplies || []);
    this.operationExceptions = clone(seed.operationExceptions || []);
    this.workerHeartbeats = clone(seed.workerHeartbeats || []);
  }

  async transaction(work) {
    const snapshot = clone({
      companies: this.companies, contacts: this.contacts, opportunities: this.opportunities,
      research: this.research, campaigns: this.campaigns, messages: this.messages,
      activities: this.activities, importBatches: this.importBatches, importRows: this.importRows,
      importReviews: this.importReviews, campaignMembers: this.campaignMembers,
      deliveryAttempts: this.deliveryAttempts, suppressions: this.suppressions,
      providerEvents: this.providerEvents, inboundReplies: this.inboundReplies,
      operationExceptions: this.operationExceptions, workerHeartbeats: this.workerHeartbeats
    });
    try { return await work(this); }
    catch (error) { Object.assign(this, snapshot); throw error; }
  }

  async createImportBatch(batch, rows) { this.importBatches.push(batch); this.importRows.push(...rows); return batch; }
  async listImportBatches(teamId) { return this.importBatches.filter((item) => item.teamId === teamId); }
  async getImportBatch(id, teamId) { return this.importBatches.find((item) => item.id === id && item.teamId === teamId) || null; }
  async listImportRows(batchId, teamId) { return this.importRows.filter((item) => item.importBatchId === batchId && item.teamId === teamId).sort((a, b) => a.rowNumber - b.rowNumber); }
  async updateImportBatch(id, teamId, patch) { return this.patch(this.importBatches, id, teamId, patch); }
  async updateImportRow(id, teamId, patch) { return this.patch(this.importRows, id, teamId, patch); }
  async createImportReview(record) { this.importReviews.push(record); return record; }
  async updateCompany(id, teamId, patch) { return this.patch(this.companies, id, teamId, patch); }
  async updateContact(id, teamId, patch) { return this.patch(this.contacts, id, teamId, patch); }
  async updateOpportunity(id, teamId, patch) { return this.patch(this.opportunities, id, teamId, patch); }

  patch(collection, id, teamId, values) {
    const record = collection.find((item) => item.id === id && item.teamId === teamId);
    if (!record) return null;
    Object.assign(record, values);
    return record;
  }

  async createCampaign(record) { this.campaigns.push(record); return record; }
  async listCampaigns(teamId) { return this.campaigns.filter((item) => item.teamId === teamId); }
  async getCampaign(id, teamId) { return this.campaigns.find((item) => item.id === id && item.teamId === teamId) || null; }
  async updateCampaign(id, teamId, patch) { return this.patch(this.campaigns, id, teamId, patch); }
  async addCampaignMember(record) {
    if (this.campaignMembers.some((item) => item.campaignId === record.campaignId && item.opportunityId === record.opportunityId && item.contactId === record.contactId)) return null;
    this.campaignMembers.push(record); return record;
  }
  async listCampaignMembers(campaignId, teamId) { return this.campaignMembers.filter((item) => item.campaignId === campaignId && item.teamId === teamId); }
  async createMessage(record) { this.messages.push(record); return record; }
  async getMessage(id, teamId) { return this.messages.find((item) => item.id === id && item.teamId === teamId) || null; }
  async listMessages(teamId, filters = {}) { return this.messages.filter((item) => item.teamId === teamId && (!filters.campaignId || item.campaignId === filters.campaignId)); }
  async findMessagesByExternalId(teamId, providerMessageId) { return this.messages.filter((item) => item.teamId === teamId && item.externalMessageId === providerMessageId); }
  async updateMessage(id, teamId, patch, expected = {}) {
    const record = await this.getMessage(id, teamId);
    if (!record || Object.entries(expected).some(([key, value]) => record[key] !== value)) return null;
    Object.assign(record, patch); return record;
  }
  async claimDueMessages(teamId, now, limit, workerId, leaseCutoff, workerConcurrency) {
    const active = this.messages.filter((item) => item.teamId === teamId && item.queueState === "sending" && item.lockedAt >= leaseCutoff).length;
    const available = Math.max(0, Number(workerConcurrency || 1) - active);
    return this.messages.filter((item) => item.teamId === teamId && ["queued", "retry"].includes(item.queueState) && (!item.scheduledAt || item.scheduledAt <= now) && (!item.nextAttemptAt || item.nextAttemptAt <= now)).slice(0, Math.min(limit, available)).flatMap((item) => {
      if (item.lockedAt) return [];
      Object.assign(item, { queueState: "sending", lockedAt: now, lockedBy: workerId });
      return [item];
    });
  }
  async recoverExpiredLeases(teamId, leaseCutoff, now) {
    const recovered = [];
    for (const message of this.messages.filter((item) => item.teamId === teamId && item.queueState === "sending" && item.lockedAt < leaseCutoff)) {
      const attempt = this.deliveryAttempts.find((item) => item.teamId === teamId && item.messageId === message.id && item.attemptNumber === Number(message.attemptCount || 0) + 1 && item.status === "sending");
      const outcomeUnknown = Boolean(attempt);
      Object.assign(message, {
        status: outcomeUnknown ? "delivery_uncertain" : "queued",
        queueState: outcomeUnknown ? "delivery_uncertain" : "retry",
        nextAttemptAt: outcomeUnknown ? "" : now,
        deliveryUncertainAt: outcomeUnknown ? now : "",
        failureReason: outcomeUnknown ? "Worker lease expired after delivery started; provider outcome is unknown." : "Worker lease expired before delivery started.",
        lockedAt: "", lockedBy: "", updatedAt: now
      });
      if (attempt) Object.assign(attempt, { status: "outcome_unknown", errorCode: "worker_lease_expired", errorMessage: "Worker lease expired before the provider result was persisted.", completedAt: now });
      recovered.push({ ...message, outcomeUnknown });
    }
    return recovered;
  }
  async createDeliveryAttempt(record) { this.deliveryAttempts.push(record); return record; }
  async updateDeliveryAttempt(id, teamId, patch) { return this.patch(this.deliveryAttempts, id, teamId, patch); }
  async listRatePolicyUsage(teamId, since) { return this.messages.filter((item) => {
    if (item.teamId !== teamId || !["sent", "sending", "delivery_uncertain"].includes(item.queueState)) return false;
    return String(item.sentAt || item.lockedAt || item.deliveryUncertainAt || item.lastAttemptAt || item.updatedAt || "") >= since;
  }); }
  async createSuppression(record) {
    const existing = this.suppressions.find((item) => item.teamId === record.teamId && item.active && ((record.normalizedEmail && item.normalizedEmail === record.normalizedEmail) || (record.normalizedDomain && item.normalizedDomain === record.normalizedDomain)));
    if (existing) return existing;
    this.suppressions.push(record); return record;
  }
  async listSuppressions(teamId) { return [...this.suppressions, ...this.legacySuppressions].filter((item) => item.teamId === teamId && item.active !== false); }
  async createProviderEvent(record) {
    const existing = this.providerEvents.find((item) => item.teamId === record.teamId && item.provider === record.provider && item.providerEventId === record.providerEventId);
    if (existing) return { ...existing, duplicate: true };
    this.providerEvents.push(record); return record;
  }
  async createInboundReply(record) { this.inboundReplies.push(record); return record; }
  async createOperationException(record) { this.operationExceptions.push(record); return record; }
  async listOperationExceptions(teamId, status = "open") { return this.operationExceptions.filter((item) => item.teamId === teamId && (!status || item.status === status)); }
  async updateOperationException(id, teamId, patch) { return this.patch(this.operationExceptions, id, teamId, patch); }
  async recordWorkerHeartbeat(record) {
    const existing = this.workerHeartbeats.find((item) => item.teamId === record.teamId && item.workerId === record.workerId);
    if (!existing) { this.workerHeartbeats.push(record); return record; }
    Object.assign(existing, {
      ...record,
      lastStartedAt: record.lastStartedAt || existing.lastStartedAt,
      lastSuccessAt: record.lastSuccessAt || existing.lastSuccessAt,
      lastErrorAt: record.lastErrorAt || existing.lastErrorAt
    });
    return existing;
  }
  async getOperationalHealth(teamId, activeSince) {
    const messages = this.messages.filter((item) => item.teamId === teamId);
    const heartbeats = this.workerHeartbeats.filter((item) => item.teamId === teamId);
    return {
      pendingOutbox: messages.filter((item) => ["queued", "retry"].includes(item.queueState)).length,
      retryCount: messages.filter((item) => item.queueState === "retry").length,
      deadLetterCount: messages.filter((item) => item.queueState === "dead_letter").length,
      uncertainCount: messages.filter((item) => item.queueState === "delivery_uncertain").length,
      failedImports: this.importBatches.filter((item) => item.teamId === teamId && item.status === "failed").length,
      unresolvedExceptions: this.operationExceptions.filter((item) => item.teamId === teamId && item.status === "open").length,
      lastSuccessfulWorkerCycle: heartbeats.map((item) => item.lastSuccessAt).filter(Boolean).sort().at(-1) || "",
      workerRunning: heartbeats.some((item) => item.state === "running" && item.updatedAt >= activeSince)
    };
  }
}
