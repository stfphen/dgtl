import crypto from "node:crypto";

export const CORE_ID_PREFIXES = Object.freeze({
  company: "company",
  contact: "contact",
  opportunity: "opportunity",
  research: "research",
  campaign: "campaign",
  message: "message",
  activity: "activity",
  asset: "artifact",
  externalLink: "external_link",
  generationJob: "generation_job",
  importBatch: "import_batch",
  importRow: "import_row",
  campaignMember: "campaign_member",
  deliveryAttempt: "delivery_attempt",
  providerEvent: "provider_event",
  suppression: "suppression",
  operationException: "operation_exception",
  inboundReply: "inbound_reply",
  artifactFamily: "artifact_family",
  artifactDeployment: "artifact_deployment",
  messageArtifact: "message_artifact",
  integrationOperation: "integration_operation"
});

export function createCoreId(entityType, randomUUID = crypto.randomUUID) {
  const prefix = CORE_ID_PREFIXES[entityType];
  if (!prefix) throw new Error(`Unknown Core entity type: ${entityType}`);
  return `${prefix}_${randomUUID()}`;
}

export function legacyCoreId(entityType, legacySource, legacyId) {
  const prefix = CORE_ID_PREFIXES[entityType];
  const source = String(legacySource || "").trim().replace(/[^a-z0-9_-]+/gi, "_");
  const sourceId = String(legacyId || "").trim();
  if (!prefix || !source || !sourceId) {
    throw new Error("entityType, legacySource, and legacyId are required for a legacy Core ID.");
  }
  return `${prefix}_${source}_${sourceId}`;
}

export function stableFingerprint(value, length = 16) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

export function isCoreId(entityType, value) {
  const prefix = CORE_ID_PREFIXES[entityType];
  return Boolean(prefix && String(value || "").startsWith(`${prefix}_`));
}
