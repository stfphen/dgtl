const REQUIRED_OPPORTUNITY_FIELDS = ["title", "sourceUrl"];

/**
 * Normalize a raw funding or RFP opportunity into a stable internal shape.
 *
 * This is a future ingestion boundary only. It does not fetch, scrape, schedule,
 * persist, or connect to external sources.
 */
export function normalizeFundingOpportunity(raw = {}) {
  const sourceUrl = normalizeUrl(raw.sourceUrl || raw.url || raw.link);
  const title = cleanString(raw.title || raw.name || raw.programName || raw.opportunityTitle);
  const funder = cleanString(raw.funder || raw.agency || raw.organization || raw.sourceName);
  const deadline = normalizeDate(raw.deadline || raw.closeDate || raw.closingDate);
  const publishedAt = normalizeDate(raw.publishedAt || raw.postedAt || raw.publicationDate);
  const sourceId = cleanString(raw.sourceId || raw.id || raw.referenceId);

  return {
    id: sourceId || buildOpportunityKey({ title, funder, sourceUrl, deadline }),
    sourceId,
    sourceName: cleanString(raw.sourceName || raw.source || funder),
    sourceUrl,
    title,
    funder,
    summary: cleanString(raw.summary || raw.description),
    geography: normalizeStringList(raw.geography || raw.location || raw.province || raw.country),
    eligibleApplicants: normalizeStringList(raw.eligibleApplicants || raw.applicants || raw.eligibility),
    eligibleActivities: normalizeStringList(raw.eligibleActivities || raw.activities || raw.categories),
    fundingAmount: cleanString(raw.fundingAmount || raw.amount || raw.awardAmount),
    deadline,
    publishedAt,
    status: cleanString(raw.status || "needs_review") || "needs_review",
    requiresHumanReview: true,
    raw
  };
}

/**
 * Return valid, unique opportunities while preserving first-seen order.
 */
export function dedupeFundingOpportunities(opportunities = []) {
  const seen = new Set();
  const deduped = [];

  for (const item of opportunities) {
    const opportunity = normalizeFundingOpportunity(item);
    const validation = validateFundingOpportunity(opportunity);
    if (!validation.ok) continue;

    const key = opportunity.sourceUrl ||
      opportunity.sourceId ||
      buildOpportunityKey(opportunity);

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(opportunity);
  }

  return deduped;
}

/**
 * Validate the normalized opportunity shape without making eligibility claims.
 */
export function validateFundingOpportunity(opportunity = {}) {
  const errors = [];

  for (const field of REQUIRED_OPPORTUNITY_FIELDS) {
    if (!cleanString(opportunity[field])) {
      errors.push({ field, message: `${field} is required` });
    }
  }

  if (opportunity.sourceUrl && !isHttpUrl(opportunity.sourceUrl)) {
    errors.push({ field: "sourceUrl", message: "sourceUrl must be an http(s) URL" });
  }

  if (opportunity.deadline && !isIsoDate(opportunity.deadline)) {
    errors.push({ field: "deadline", message: "deadline must use YYYY-MM-DD format" });
  }

  if (opportunity.publishedAt && !isIsoDate(opportunity.publishedAt)) {
    errors.push({ field: "publishedAt", message: "publishedAt must use YYYY-MM-DD format" });
  }

  if (opportunity.requiresHumanReview !== true) {
    errors.push({ field: "requiresHumanReview", message: "human review is required before matching or outreach" });
  }

  return { ok: errors.length === 0, errors };
}

function cleanString(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeStringList(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return values.map(cleanString).filter(Boolean);
}

function normalizeUrl(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return text;
  }
}

function normalizeDate(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
}

function isHttpUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isIsoDate(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function buildOpportunityKey({ title = "", funder = "", sourceUrl = "", deadline = "" } = {}) {
  return [sourceUrl, funder, title, deadline]
    .map((part) => cleanString(part).toLowerCase())
    .filter(Boolean)
    .join("|");
}
