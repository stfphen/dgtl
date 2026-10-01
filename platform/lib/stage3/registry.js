const ADAPTERS = Object.freeze({
  "pitch.pages": Object.freeze({
    id: "pitch.pages",
    displayName: "DGTL Pitch Pages",
    artifactKinds: ["pitch"],
    skillName: "dgtl-pitch-pages",
    sourceDirectory: "engine/dgtl-pitch-pages",
    workflowVersion: "1",
    executionMode: "authorized_agent",
    availability: "supported",
    requiredContext: ["company.displayName", "opportunity.approachAngle", "opportunity.offer", "contacts"],
    allowedOutputPatterns: ["pitches/<slug>/**", "pitches/pitches.index.json"],
    validators: ["pitch.manifest", "pitch.registry", "pitch.paths", "repo.links"],
    supportsPreview: true,
    supportsDeployment: true
  }),
  "pitch.composer": Object.freeze({
    id: "pitch.composer",
    displayName: "DGTL Pitch Composer",
    artifactKinds: ["pitch"],
    skillName: "dgtl-pitch-composer",
    sourceDirectory: "engine/dgtl-pitch-composer",
    workflowVersion: "1",
    executionMode: "authorized_agent",
    availability: "supported",
    requiredContext: ["company.displayName", "opportunity.approachAngle", "opportunity.offer", "contacts"],
    allowedOutputPatterns: ["pitches/<slug>/**", "pitches/pitches.index.json"],
    validators: ["pitch.manifest", "pitch.registry", "pitch.paths", "repo.links"],
    supportsPreview: true,
    supportsDeployment: true
  }),
  "pitch.teaser": Object.freeze({
    id: "pitch.teaser",
    displayName: "DGTL Pitch Teaser",
    artifactKinds: ["teaser"],
    skillName: "dgtl-pitch-teasers",
    sourceDirectory: "engine/dgtl-pitch-teasers",
    workflowVersion: "1",
    executionMode: "authorized_agent",
    availability: "supported",
    requiredContext: ["company.displayName", "opportunity.approachAngle", "approvedPitchArtifactId"],
    allowedOutputPatterns: ["pitches/<slug>/teaser.html", "pitches/<slug>/pitch.json"],
    validators: ["pitch.manifest", "pitch.paths", "repo.links"],
    supportsPreview: true,
    supportsDeployment: true
  }),
  "audit.digital": Object.freeze({
    id: "audit.digital",
    displayName: "DGTL Digital Audit",
    artifactKinds: ["audit"],
    skillName: "dgtl-client-audit",
    sourceDirectory: null,
    workflowVersion: null,
    executionMode: "authorized_agent",
    availability: "installed_unavailable",
    unavailableReason: "The generator exists only as an installed external skill and is not versioned under engine/.",
    allowedOutputPatterns: [], validators: [], supportsPreview: false, supportsDeployment: false
  }),
  "report.client": Object.freeze({
    id: "report.client",
    displayName: "DGTL Client Report",
    artifactKinds: ["report"],
    skillName: "dgtl-client-reports",
    sourceDirectory: null,
    workflowVersion: null,
    executionMode: "authorized_agent",
    availability: "installed_unavailable",
    unavailableReason: "Report generation is an installed external ledger workflow, not an engine-owned Core adapter.",
    allowedOutputPatterns: [], validators: [], supportsPreview: false, supportsDeployment: false
  }),
  "brand-kit.asset": Object.freeze({
    id: "brand-kit.asset",
    displayName: "DGTL Brand Kit Surface",
    artifactKinds: ["other"],
    skillName: "dgtl-brand-kit",
    sourceDirectory: "engine/dgtl-brand-kit",
    workflowVersion: "1",
    executionMode: "authorized_agent",
    availability: "disabled",
    unavailableReason: "The skill intentionally writes to arbitrary product locations and is too broad for the Stage 3 allow-list.",
    allowedOutputPatterns: [], validators: [], supportsPreview: false, supportsDeployment: false
  })
});

const DEPLOYMENTS = Object.freeze({
  "pitch.local-preview": Object.freeze({ id: "pitch.local-preview", displayName: "Pitch isolated preview", artifactKinds: ["pitch", "teaser"], mode: "test", availability: "supported", production: false, supportsDryRun: true }),
  "pitch.portal": Object.freeze({ id: "pitch.portal", displayName: "DGTL pitch deploy portal", artifactKinds: ["pitch", "teaser"], mode: "http_worker", availability: "disabled", production: true, supportsDryRun: false, requiredGate: "CORE_ARTIFACT_PRODUCTION_DEPLOY_AUTHORIZED" }),
  "report.portal": Object.freeze({ id: "report.portal", displayName: "DGTL report deploy portal", artifactKinds: ["report", "audit"], mode: "http_worker", availability: "disabled", production: true, supportsDryRun: false, requiredGate: "CORE_ARTIFACT_PRODUCTION_DEPLOY_AUTHORIZED" })
});

export function listGenerationAdapters() { return Object.values(ADAPTERS); }
export function getGenerationAdapter(id) { return ADAPTERS[String(id || "")] || null; }
export function requireGenerationAdapter(id, kind) {
  const adapter = getGenerationAdapter(id);
  if (!adapter) throw Object.assign(new Error("Unsupported generation adapter."), { status: 400, code: "unsupported_adapter" });
  if (adapter.availability !== "supported") throw Object.assign(new Error(adapter.unavailableReason || "Generation adapter is unavailable."), { status: 409, code: "adapter_unavailable" });
  if (!adapter.artifactKinds.includes(kind)) throw Object.assign(new Error("Adapter does not support the requested artifact kind."), { status: 400, code: "adapter_kind_mismatch" });
  return adapter;
}
export function getDeploymentAdapter(id) { return DEPLOYMENTS[String(id || "")] || null; }
export function requireDeploymentAdapter(id, kind, { productionAuthorized = false } = {}) {
  const adapter = getDeploymentAdapter(id);
  if (!adapter || adapter.availability !== "supported") throw Object.assign(new Error("Deployment adapter is unavailable."), { status: 409, code: "deployment_adapter_unavailable" });
  if (!adapter.artifactKinds.includes(kind)) throw Object.assign(new Error("Deployment target does not support this artifact kind."), { status: 400 });
  if (adapter.production && !productionAuthorized) throw Object.assign(new Error("Production artifact deployment is not authorized."), { status: 403 });
  return adapter;
}

export function safeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug) || slug.includes("..")) throw Object.assign(new Error("Slug must be lowercase kebab-case and contain at most 61 characters."), { status: 400, code: "invalid_slug" });
  return slug;
}

export function assertAllowedOutputPaths(adapter, slug, paths = []) {
  const prefix = `pitches/${safeSlug(slug)}/`;
  for (const raw of paths) {
    const path = String(raw || "").replaceAll("\\", "/");
    if (!path || path.startsWith("/") || path.split("/").includes("..") || path.includes("\0")) throw Object.assign(new Error(`Unsafe generated path: ${raw}`), { status: 400, code: "unsafe_output_path" });
    const allowed = path === "pitches/pitches.index.json" || path.startsWith(prefix);
    if (!allowed || adapter.id === "pitch.teaser" && ![`${prefix}teaser.html`, `${prefix}pitch.json`].includes(path)) throw Object.assign(new Error(`Adapter ${adapter.id} cannot write ${path}.`), { status: 400, code: "unexpected_output_path" });
  }
  return true;
}

export const GENERATION_JOB_STATES = Object.freeze(["draft", "queued", "claimed", "running", "validating", "awaiting_review", "approved", "deploy_queued", "deploying", "deployed", "failed", "validation_failed", "rejected", "cancelled", "deployment_failed"]);
