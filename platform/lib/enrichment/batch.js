import { isHttpUrl } from "./url.js";

export const DEFAULT_BATCH_ENRICHMENT_LIMIT = 3;
export const MAX_BATCH_ENRICHMENT_LIMIT = 5;
export const DEFAULT_STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

function parseDate(value) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeStatusFilter(status) {
  return String(status || "").trim();
}

export function normalizeBatchEnrichmentLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed)) return DEFAULT_BATCH_ENRICHMENT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_BATCH_ENRICHMENT_LIMIT);
}

export function isLeadEnrichmentStale(lead, { staleAfterMs = DEFAULT_STALE_AFTER_MS, nowMs = Date.now() } = {}) {
  const enrichment = isPlainObject(lead?.metadata?.enrichment) ? lead.metadata.enrichment : null;
  if (!enrichment) return true;
  if (enrichment.status !== "complete") return true;

  const lastEnrichedAt = parseDate(enrichment.lastEnrichedAt);
  if (!Number.isFinite(lastEnrichedAt)) return true;

  return nowMs - lastEnrichedAt >= staleAfterMs;
}

export function selectLeadsForBatchEnrichment(leads, { status, limit, staleAfterMs, nowMs } = {}) {
  const normalizedStatus = normalizeStatusFilter(status);
  const normalizedLimit = normalizeBatchEnrichmentLimit(limit);
  const sourceLeads = Array.isArray(leads) ? leads : [];

  const candidates = sourceLeads.filter((lead) => {
    if (normalizedStatus && lead?.status !== normalizedStatus) return false;
    return isHttpUrl(lead?.websiteUrl || "");
  });

  const eligible = candidates.filter((lead) =>
    isLeadEnrichmentStale(lead, { staleAfterMs, nowMs })
  );

  return {
    selected: eligible.slice(0, normalizedLimit),
    skipped: candidates.length - Math.min(eligible.length, normalizedLimit),
    candidateCount: candidates.length,
    eligibleCount: eligible.length,
    limit: normalizedLimit,
    status: normalizedStatus || null
  };
}

export function buildBatchEnrichmentNotice({ enriched = 0, skipped = 0, failed = 0 } = {}) {
  return `Enriched ${enriched} leads. Skipped ${skipped}. Failed ${failed}.`;
}
