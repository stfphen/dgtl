export const pipelineStatuses = [
  "new",
  "researched",
  "qualified",
  "contacted",
  "replied",
  "booked",
  "won",
  "lost",
  "disqualified"
];

export const outreachStatuses = [
  "not_started",
  "drafted",
  "queued",
  "contacted",
  "replied",
  "booked",
  "suppressed",
  "closed",
  "disqualified"
];

export const enrichmentStatuses = ["not_started", "pending", "enriched", "failed"];

export const leadSources = [
  "manual",
  "csv",
  "google_places",
  "hunter",
  "apollo",
  "public_form",
  "inbound_call",
  "funding_scan",
  "enterprise_prospect",
  "other"
];

const highValueCategories = [
  "med spa",
  "medspa",
  "dentist",
  "dental",
  "clinic",
  "doctor",
  "chiropractor",
  "real estate",
  "home services",
  "landscaping",
  "gym",
  "restaurant",
  "contractor",
  "legal",
  "lawyer",
  "finance"
];

export function normalizeLeadInput(input = {}) {
  const sourceMetadata = input.sourceMetadata || input.metadata || {};
  const website = input.website || input.websiteUrl || input.url || "";
  const domain = input.domain || domainFromUrl(website);
  const pipelineStatus = normalizeStatus(
    input.pipelineStatus || input.status,
    pipelineStatuses,
    "new"
  );
  const outreachStatus = normalizeStatus(
    input.outreachStatus,
    outreachStatuses,
    pipelineStatus === "contacted" ? "contacted" : "not_started"
  );
  const enrichmentStatus = normalizeStatus(input.enrichmentStatus, enrichmentStatuses, "not_started");

  const lead = {
    id: input.id,
    teamId: input.teamId,
    tenantId: input.tenantId,
    campaignId: input.campaignId || "",
    batchId: input.batchId || "",
    businessName: input.businessName || input.business || input.company || "",
    contactName: input.contactName || input.name || input.contact || "",
    contactTitle: input.contactTitle || input.position || input.title || "",
    email: input.email || "",
    phone: input.phone || "",
    website,
    websiteUrl: website,
    domain,
    address: input.address || sourceMetadata.formattedAddress || "",
    city: input.city || "",
    region: input.region || input.province || input.state || "",
    country: input.country || "",
    category: input.category || input.industry || "",
    source: normalizeSource(input.source || input.sourceType),
    sourceType: normalizeSource(input.sourceType || input.source),
    sourceUrl: input.sourceUrl || input.source_url || "",
    sourceMetadata,
    metadata: sourceMetadata,
    googlePlaceId: input.googlePlaceId || sourceMetadata.id || sourceMetadata.name || "",
    googleRating: toNumber(input.googleRating ?? sourceMetadata.rating),
    googleReviewCount: toNumber(input.googleReviewCount ?? sourceMetadata.userRatingCount),
    enrichmentStatus,
    outreachStatus,
    pipelineStatus,
    status: pipelineStatus,
    leadScore: toNumber(input.leadScore),
    leadScoreReason: input.leadScoreReason || "",
    painPoints: input.painPoints || "",
    recommendedOffer: input.recommendedOffer || "",
    notes: input.notes || "",
    assignedTo: input.assignedTo || "",
    packageId: input.packageId || "",
    replyStatus: input.replyStatus || "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    lastContactedAt: input.lastContactedAt || "",
    nextFollowUpAt: input.nextFollowUpAt || "",
    // Telephony additions (all optional, safe defaults).
    assignedToUserId: input.assignedToUserId || "",
    lastCallAt: input.lastCallAt || "",
    callStatus: input.callStatus || "",
    preferredContactMethod: input.preferredContactMethod || "",
    doNotCall: toBool(input.doNotCall),
    doNotContact: toBool(input.doNotContact),
    consentSource: input.consentSource || "",
    lastOptOutAt: input.lastOptOutAt || "",
    phoneCountry: input.phoneCountry || ""
  };

  const scored = scoreLead(lead);
  if (!lead.leadScore) lead.leadScore = scored.score;
  if (!lead.leadScoreReason) lead.leadScoreReason = scored.reason;

  return withLegacyAliases(lead);
}

// Fields a public/anonymous caller is allowed to set on a lead. Everything else
// (teamId, pipelineStatus/status, leadScore, assignedTo, assignedToUserId,
// campaignId, batchId, do-not-contact flags, arbitrary metadata) is internal and
// must be derived server-side — otherwise an unauthenticated POST could inject a
// lead into another team, self-mark it "won"/high-score, or assign it to a rep.
const PUBLIC_LEAD_FIELDS = [
  "businessName",
  "business",
  "company",
  "contactName",
  "name",
  "contact",
  "contactTitle",
  "title",
  "position",
  "email",
  "phone",
  "website",
  "websiteUrl",
  "url",
  "address",
  "city",
  "region",
  "province",
  "state",
  "country",
  "category",
  "industry",
  "notes",
  "packageId",
  "tenantId",
  "tenantSlug"
];

/**
 * Reduce an untrusted public payload to only the client-settable lead fields.
 * `tenantId` is kept (the server resolves the owning team from it) but `teamId`
 * and every internal/privileged field is dropped. `source` is forced by the
 * caller (e.g. "public_form", "funding_scan") — never trusted from the client.
 */
export function sanitizePublicLeadInput(payload = {}, { source = "public_form" } = {}) {
  const input = payload && typeof payload === "object" ? payload : {};
  const clean = {};
  for (const field of PUBLIC_LEAD_FIELDS) {
    if (input[field] !== undefined) clean[field] = input[field];
  }
  clean.source = source;
  clean.sourceType = source;
  return clean;
}

export function withLegacyAliases(lead) {
  return {
    ...lead,
    business: lead.businessName || lead.business || "",
    name: lead.contactName || lead.name || "",
    websiteUrl: lead.website || lead.websiteUrl || "",
    sourceType: lead.source || lead.sourceType || "other",
    metadata: lead.sourceMetadata || lead.metadata || {},
    status: lead.pipelineStatus || lead.status || "new"
  };
}

export function scoreLead(input) {
  const lead = withLegacyAliases(input);
  const reasons = [];
  let score = 0;

  if (lead.websiteUrl || lead.website) {
    score += 20;
    reasons.push("+20 website exists");
  } else {
    score -= 10;
    reasons.push("-10 missing website");
  }

  if (lead.email) {
    score += 10;
    reasons.push("+10 email found");
  }

  if (lead.phone) {
    score += 10;
    reasons.push("+10 phone found");
  }

  if (Number(lead.googleReviewCount || 0) >= 50) {
    score += 10;
    reasons.push("+10 50+ Google reviews");
  }

  if (Number(lead.googleRating || 0) >= 4.2) {
    score += 10;
    reasons.push("+10 Google rating 4.2+");
  }

  const category = normalizeComparable(lead.category || lead.industry || "");
  if (highValueCategories.some((term) => category.includes(term))) {
    score += 10;
    reasons.push("+10 high-value category");
  }

  if (lead.domain && hasProviderSignal(lead, "hunter")) {
    score += 10;
    reasons.push("+10 Hunter found contact data");
  }

  if (hasProviderSignal(lead, "apollo")) {
    score += 10;
    reasons.push("+10 Apollo found decision-maker profiles");
  }

  if (["contacted", "replied", "booked", "closed"].includes(lead.outreachStatus)) {
    score -= 10;
    reasons.push("-10 already contacted");
  }

  if (lead.pipelineStatus === "disqualified" || lead.outreachStatus === "disqualified") {
    score -= 20;
    reasons.push("-20 disqualified");
  }

  return {
    score,
    reason: reasons.join("; ")
  };
}

export function findDuplicateCandidates(lead, leads = []) {
  const target = duplicateSignals(lead);
  return leads
    .filter((candidate) => candidate.id !== lead.id)
    .map((candidate) => {
      const signals = duplicateSignals(candidate);
      const reasons = [];
      if (target.primary && target.primary === signals.primary) reasons.push("domain + business");
      if (target.googlePlaceId && target.googlePlaceId === signals.googlePlaceId) reasons.push("Google Place ID");
      if (target.phone && target.phone === signals.phone) reasons.push("phone");
      if (target.website && target.website === signals.website) reasons.push("website");
      return reasons.length ? { lead: candidate, reasons } : null;
    })
    .filter(Boolean);
}

// Person-level signals uniquely identify a contact; company-level signals only
// identify the organization (many contacts share them).
const PERSON_LEVEL_REASONS = ["Google Place ID", "phone"];
const COMPANY_LEVEL_REASONS = ["domain + business", "website"];

export function shouldSkipReliableDuplicate(lead, leads = []) {
  const leadEmail = normalizeComparable(lead.email);
  return findDuplicateCandidates(lead, leads).find((match) => {
    if (match.reasons.some((reason) => PERSON_LEVEL_REASONS.includes(reason))) return true;

    const candidateEmail = normalizeComparable(match.lead.email);
    // Same known email => same person => reliable duplicate.
    if (leadEmail && candidateEmail && leadEmail === candidateEmail) return true;

    // Company-level signals (shared domain/business/website) only reliably dedupe
    // when the two records are not two distinct, known people — otherwise every
    // member of one company's buying committee collapses into a single lead.
    const distinctPeople = leadEmail && candidateEmail && leadEmail !== candidateEmail;
    if (!distinctPeople && match.reasons.some((reason) => COMPANY_LEVEL_REASONS.includes(reason))) {
      return true;
    }
    return false;
  });
}

export function decorateLeadsWithDuplicates(leads = []) {
  return leads.map((lead) => {
    const matches = findDuplicateCandidates(lead, leads);
    return {
      ...lead,
      possibleDuplicates: matches.map((match) => ({
        id: match.lead.id,
        businessName: match.lead.businessName || match.lead.business || "",
        reasons: match.reasons
      }))
    };
  });
}

export function filterAndSortLeads(leads = [], filters = {}) {
  const query = normalizeComparable(filters.query || "");
  const city = normalizeComparable(filters.city || "");
  const category = normalizeComparable(filters.category || "");
  const source = normalizeComparable(filters.source || "");
  const enrichmentStatus = normalizeComparable(filters.enrichmentStatus || "");
  const outreachStatus = normalizeComparable(filters.outreachStatus || "");
  const pipelineStatus = normalizeComparable(filters.pipelineStatus || "");

  const filtered = leads.filter((lead) => {
    const haystack = normalizeComparable(
      [
        lead.businessName,
        lead.contactName,
        lead.email,
        lead.phone,
        lead.websiteUrl,
        lead.domain,
        lead.city,
        lead.category,
        lead.notes
      ].join(" ")
    );
    if (query && !haystack.includes(query)) return false;
    if (city && normalizeComparable(lead.city) !== city) return false;
    if (category && normalizeComparable(lead.category) !== category) return false;
    if (source && normalizeComparable(lead.sourceType) !== source) return false;
    if (enrichmentStatus && normalizeComparable(lead.enrichmentStatus) !== enrichmentStatus) return false;
    if (outreachStatus && normalizeComparable(lead.outreachStatus) !== outreachStatus) return false;
    if (pipelineStatus && normalizeComparable(lead.pipelineStatus) !== pipelineStatus) return false;
    return true;
  });

  return sortLeads(filtered, filters.sort || "created_desc");
}

export function sortLeads(leads = [], sort = "created_desc") {
  const sorted = [...leads];
  const value = (lead, key) => normalizeComparable(lead[key] || "");
  const dateValue = (lead) => new Date(lead.createdAt || 0).getTime();

  sorted.sort((a, b) => {
    if (sort === "score_desc") return Number(b.leadScore || 0) - Number(a.leadScore || 0);
    if (sort === "score_asc") return Number(a.leadScore || 0) - Number(b.leadScore || 0);
    if (sort === "city") return value(a, "city").localeCompare(value(b, "city"));
    if (sort === "source") return value(a, "sourceType").localeCompare(value(b, "sourceType"));
    if (sort === "status") return value(a, "pipelineStatus").localeCompare(value(b, "pipelineStatus"));
    if (sort === "created_asc") return dateValue(a) - dateValue(b);
    return dateValue(b) - dateValue(a);
  });

  return sorted;
}

export function leadsToCsv(leads = []) {
  const headers = [
    "id",
    "businessName",
    "contactName",
    "contactTitle",
    "email",
    "phone",
    "website",
    "domain",
    "address",
    "city",
    "region",
    "country",
    "category",
    "source",
    "enrichmentStatus",
    "outreachStatus",
    "pipelineStatus",
    "leadScore",
    "leadScoreReason",
    "recommendedOffer",
    "notes",
    "createdAt"
  ];

  return [
    headers.join(","),
    ...leads.map((lead) => headers.map((header) => csvEscape(lead[header] ?? "")).join(","))
  ].join("\n");
}

export function domainFromUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
  }
}

export function normalizedWebsite(value = "") {
  const domain = domainFromUrl(value);
  const path = String(value || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return domain ? path.toLowerCase() : "";
}

export function normalizedPhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeComparable(value = "") {
  return String(value || "").trim().toLowerCase();
}

function duplicateSignals(lead) {
  const business = normalizeComparable(lead.businessName || lead.business);
  const domain = normalizeComparable(lead.domain || domainFromUrl(lead.websiteUrl || lead.website));
  return {
    primary: domain && business ? `${domain}:${business}` : "",
    googlePlaceId: normalizeComparable(lead.googlePlaceId),
    phone: normalizedPhone(lead.phone),
    website: normalizedWebsite(lead.websiteUrl || lead.website)
  };
}

// Canonicalize an incoming pipeline status (applying the legacy alias map) and
// return null when it is not a recognized status. Used to reject arbitrary
// status strings on update so a lead cannot be pushed into an invalid/stuck state.
export function normalizePipelineStatus(value) {
  return normalizeStatus(value, pipelineStatuses, null);
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = normalizeComparable(value).replaceAll("-", "_");
  const legacyStatusMap = {
    do_not_contact: "disqualified",
    drafted: "qualified",
    approved: "qualified",
    sent_external: "contacted",
    closed: "won"
  };
  const mapped = legacyStatusMap[normalized] || normalized;
  return allowed.includes(mapped) ? mapped : fallback;
}

function normalizeSource(value) {
  const source = normalizeComparable(value || "other").replaceAll("-", "_");
  if (source === "form") return "public_form";
  return leadSources.includes(source) ? source : "other";
}

function hasProviderSignal(lead, provider) {
  const metadata = lead.sourceMetadata || lead.metadata || {};
  const enrichments = metadata.enrichments || {};
  const providerData = enrichments[provider] || metadata[provider];
  if (!providerData) return false;
  if (Array.isArray(providerData.contacts)) return providerData.contacts.length > 0;
  if (Array.isArray(providerData.people)) return providerData.people.length > 0;
  return Boolean(providerData.found || providerData.ok);
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return ["true", "1", "on", "yes"].includes(value.toLowerCase());
  return Boolean(value);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
