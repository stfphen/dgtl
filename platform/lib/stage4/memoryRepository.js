import { MemoryStage3Repository } from "../stage3/memoryRepository.js";

function clone(value) { return structuredClone(value); }

export class MemoryStage4Repository extends MemoryStage3Repository {
  constructor(seed = {}) {
    super(seed);
    this.integrationOperations = clone(seed.integrationOperations || []);
  }
  async transaction(work) {
    const snapshot = clone({
      companies:this.companies,contacts:this.contacts,opportunities:this.opportunities,research:this.research,campaigns:this.campaigns,messages:this.messages,activities:this.activities,assets:this.assets,externalLinks:this.externalLinks,generationJobs:this.generationJobs,
      importBatches:this.importBatches,importRows:this.importRows,importReviews:this.importReviews,campaignMembers:this.campaignMembers,deliveryAttempts:this.deliveryAttempts,suppressions:this.suppressions,providerEvents:this.providerEvents,inboundReplies:this.inboundReplies,operationExceptions:this.operationExceptions,workerHeartbeats:this.workerHeartbeats,
      artifactFamilies:this.artifactFamilies,artifactDeployments:this.artifactDeployments,messageArtifacts:this.messageArtifacts,integrationOperations:this.integrationOperations
    });
    try { return await work(this); } catch (error) { Object.assign(this, snapshot); throw error; }
  }
  async createIntegrationOperation(record) {
    const existing = await this.findIntegrationOperationByIdempotency(record.teamId, record.idempotencyKey);
    if (existing) return existing;
    this.integrationOperations.push(record); return record;
  }
  async getIntegrationOperation(id, teamId) { return this.integrationOperations.find((item) => item.id === id && item.teamId === teamId) || null; }
  async findIntegrationOperationByIdempotency(teamId, key) { return this.integrationOperations.find((item) => item.teamId === teamId && item.idempotencyKey === key) || null; }
  async listIntegrationOperations(teamId, { status = "", connectorId = "", localEntityType = "", localEntityId = "" } = {}) {
    const statuses = status ? [].concat(status) : null;
    return this.integrationOperations
      .filter((item) => item.teamId === teamId
        && (!statuses || statuses.includes(item.status))
        && (!connectorId || item.connectorId === connectorId)
        && (!localEntityType || item.localEntityType === localEntityType)
        && (!localEntityId || item.localEntityId === localEntityId))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  async updateIntegrationOperation(id, teamId, values, expectedStatus) {
    const record = await this.getIntegrationOperation(id, teamId);
    if (!record || (expectedStatus && ![].concat(expectedStatus).includes(record.status))) return null;
    Object.assign(record, values); return record;
  }
  async getExternalLinkById(id, teamId) { return this.externalLinks.find((item) => item.id === id && item.teamId === teamId) || null; }
  async listExternalLinksForEntity(teamId, localEntityType, localEntityId, externalSystem = "") {
    return this.externalLinks.filter((item) => item.teamId === teamId && item.localEntityType === localEntityType && item.localEntityId === localEntityId && (!externalSystem || item.externalSystem === externalSystem));
  }
  async listExternalLinksBySystem(teamId, externalSystem, { externalObjectType = "", externalId = "", syncState = "", localEntityType = "" } = {}) {
    return this.externalLinks.filter((item) => item.teamId === teamId && item.externalSystem === externalSystem
      && (!externalObjectType || item.externalObjectType === externalObjectType)
      && (!externalId || item.externalId === externalId)
      && (!syncState || item.syncState === syncState)
      && (!localEntityType || item.localEntityType === localEntityType));
  }
  async updateExternalLink(id, teamId, values, expectedSyncState) {
    const record = await this.getExternalLinkById(id, teamId);
    if (!record || (expectedSyncState && ![].concat(expectedSyncState).includes(record.syncState))) return null;
    Object.assign(record, values); return record;
  }
}
