import { MemoryStage2Repository } from "../stage2/memoryRepository.js";

function clone(value) { return structuredClone(value); }
function patch(collection, id, teamId, values) { const record = collection.find((item) => item.id === id && item.teamId === teamId); if (!record) return null; Object.assign(record, values); return record; }

export class MemoryStage3Repository extends MemoryStage2Repository {
  constructor(seed = {}) {
    super(seed);
    this.artifactFamilies = clone(seed.artifactFamilies || []);
    this.artifactDeployments = clone(seed.artifactDeployments || []);
    this.messageArtifacts = clone(seed.messageArtifacts || []);
  }
  async transaction(work) {
    const snapshot = clone({
      companies:this.companies,contacts:this.contacts,opportunities:this.opportunities,research:this.research,campaigns:this.campaigns,messages:this.messages,activities:this.activities,assets:this.assets,externalLinks:this.externalLinks,generationJobs:this.generationJobs,
      importBatches:this.importBatches,importRows:this.importRows,importReviews:this.importReviews,campaignMembers:this.campaignMembers,deliveryAttempts:this.deliveryAttempts,suppressions:this.suppressions,providerEvents:this.providerEvents,inboundReplies:this.inboundReplies,operationExceptions:this.operationExceptions,workerHeartbeats:this.workerHeartbeats,
      artifactFamilies:this.artifactFamilies,artifactDeployments:this.artifactDeployments,messageArtifacts:this.messageArtifacts
    });
    try{return await work(this);}catch(error){Object.assign(this,snapshot);throw error;}
  }
  async reserveArtifactFamily(record, { revision = false } = {}) {
    const existing = this.artifactFamilies.find((item) => item.teamId === record.teamId && item.kind === record.kind && item.slug === record.slug);
    if (existing && !revision) throw Object.assign(new Error("Artifact slug is already reserved; choose revision explicitly."), { status: 409, code: "slug_collision" });
    if (existing) return existing;
    this.artifactFamilies.push(record); return record;
  }
  async getArtifactFamily(id, teamId) { return this.artifactFamilies.find((item) => item.id === id && item.teamId === teamId) || null; }
  async listGenerationJobs(teamId) { return this.generationJobs.filter((item) => item.teamId === teamId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); }
  async getGenerationJob(id, teamId) { return this.generationJobs.find((item) => item.id === id && item.teamId === teamId) || null; }
  async findGenerationJobByIdempotency(teamId, key) { return this.generationJobs.find((item) => item.teamId === teamId && item.idempotencyKey === key) || null; }
  async updateGenerationJob(id, teamId, values, expectedStatus) { const record = await this.getGenerationJob(id, teamId); if (!record || expectedStatus && ![].concat(expectedStatus).includes(record.status)) return null; Object.assign(record, values); return record; }
  async claimGenerationJob(teamId, workerId, now, leaseExpiresAt) {
    const record = this.generationJobs.find((item) => item.teamId === teamId && (item.status === "queued" || (["claimed","running","validating"].includes(item.status) && item.leaseExpiresAt && item.leaseExpiresAt < now)));
    if (!record) return null;
    Object.assign(record, { status: "claimed", claimedBy: workerId, claimedAt: now, heartbeatAt: now, leaseExpiresAt, attemptCount: Number(record.attemptCount || 0) + 1, updatedAt: now }); return record;
  }
  async listArtifacts(teamId) { return this.assets.filter((item) => item.teamId === teamId).sort((a,b)=>Number(b.versionNumber||0)-Number(a.versionNumber||0)); }
  async getArtifact(id, teamId) { return this.assets.find((item) => item.id === id && item.teamId === teamId) || null; }
  async findArtifactByJob(jobId, teamId) { return this.assets.find((item) => item.generationJobId === jobId && item.teamId === teamId) || null; }
  async nextArtifactVersion(familyId, teamId) { return Math.max(0, ...this.assets.filter((item)=>item.teamId===teamId&&item.artifactFamilyId===familyId).map((item)=>Number(item.versionNumber||0))) + 1; }
  async createArtifactVersion(record) { if (await this.findArtifactByJob(record.generationJobId, record.teamId)) return this.findArtifactByJob(record.generationJobId, record.teamId); this.assets.push(record); return record; }
  async updateArtifactDeploymentFields(id, teamId, values) { return patch(this.assets, id, teamId, values); }
  async createArtifactDeployment(record) { const existing=this.artifactDeployments.find((item)=>item.teamId===record.teamId&&item.idempotencyKey===record.idempotencyKey); if(existing)return existing; this.artifactDeployments.push(record); return record; }
  async listArtifactDeployments(teamId, artifactId="") { return this.artifactDeployments.filter((item)=>item.teamId===teamId&&(!artifactId||item.artifactId===artifactId)); }
  async getArtifactDeployment(id, teamId) { return this.artifactDeployments.find((item)=>item.id===id&&item.teamId===teamId)||null; }
  async updateArtifactDeployment(id,teamId,values,expectedStatus){const record=await this.getArtifactDeployment(id,teamId);if(!record||expectedStatus&&![].concat(expectedStatus).includes(record.status))return null;Object.assign(record,values);return record;}
  async claimArtifactDeployment(teamId,workerId,now,leaseExpiresAt){const record=this.artifactDeployments.find((item)=>item.teamId===teamId&&(item.status==="deploy_queued"||(item.status==="deploying"&&item.leaseExpiresAt&&item.leaseExpiresAt<now)));if(!record)return null;Object.assign(record,{status:"deploying",claimedBy:workerId,claimedAt:now,leaseExpiresAt,attemptCount:Number(record.attemptCount||0)+1,updatedAt:now});return record;}
  async createMessageArtifact(record){const existing=this.messageArtifacts.find((item)=>item.messageId===record.messageId&&item.artifactId===record.artifactId);if(existing)return existing;this.messageArtifacts.push(record);return record;}
  async listMessageArtifacts(messageId,teamId){return this.messageArtifacts.filter((item)=>item.messageId===messageId&&item.teamId===teamId);}
}
