import { aiMode, generateJson, runWebResearch } from "../ai/claudeBackend.js";
import { collectCitations, extractText, parseModelJson } from "../ai/aiParse.js";
import {
  CONFIDENCE_LEVELS,
  DOSSIER_SCHEMA,
  HIGH_CONFIDENCE,
  SIGNAL_TYPES,
  SOCIAL_PLATFORMS
} from "./dossierSchema.js";

// Transport helpers now live in lib/ai/aiParse.js; re-exported for tests and
// callers that historically imported them from here.
export { collectCitations, extractText, parseModelJson };

const MODEL = process.env.LEAD_RESEARCH_MODEL || "claude-opus-4-8";
const MAX_WEB_SEARCHES = Number(process.env.LEAD_RESEARCH_MAX_WEB_SEARCHES || 8);
const CONFIDENCE_SET = new Set(CONFIDENCE_LEVELS);

// ---------------------------------------------------------------------------
// Errors (named, mapped to HTTP status in the route — mirrors generateTenant.js)
// ---------------------------------------------------------------------------
function namedError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

// ---------------------------------------------------------------------------
// Pure helpers (no network) — unit-tested directly
// ---------------------------------------------------------------------------
function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normConfidence(value) {
  return CONFIDENCE_SET.has(value) ? value : "unverified";
}

function sanitizeContact(item, valueType) {
  if (!isPlainObject(item)) return null;
  const value = str(item.value);
  const sourceUrl = str(item.sourceUrl);
  if (!value || !sourceUrl) return null; // hallucination guard: no source → drop
  return {
    value,
    type: valueType,
    confidence: normConfidence(item.confidence),
    sourceUrl,
    note: str(item.note)
  };
}

function sanitizeSourced(item, requiredFields) {
  if (!isPlainObject(item)) return null;
  const sourceUrl = str(item.sourceUrl);
  if (!sourceUrl) return null;
  for (const field of requiredFields) {
    if (!str(item[field])) return null;
  }
  return item;
}

/**
 * Turn raw model output (Stage B) into a sanitized dossier. Pure (no network),
 * so it is unit-testable. Drops any datum lacking a source URL, clamps
 * confidence to the enum, and always stamps publicDataOnly:true.
 */
export function buildDossierFromModelOutput({ modelOutput } = {}) {
  const out = isPlainObject(modelOutput) ? modelOutput : {};
  const profile = isPlainObject(out.businessProfile) ? out.businessProfile : {};
  const contacts = isPlainObject(out.verifiedContacts) ? out.verifiedContacts : {};
  const web = isPlainObject(out.webPresence) ? out.webPresence : {};
  const site = isPlainObject(web.confirmedWebsite) ? web.confirmedWebsite : {};

  const arr = (value) => (Array.isArray(value) ? value : []);

  const citations = [];
  const seenCitation = new Set();
  for (const c of arr(out.citations)) {
    const url = str(c?.url);
    if (!url || seenCitation.has(url)) continue;
    seenCitation.add(url);
    citations.push({ url, title: str(c?.title) || url });
  }

  return {
    businessProfile: {
      summary: str(profile.summary),
      category: str(profile.category),
      locationText: str(profile.locationText),
      foundedOrYears: str(profile.foundedOrYears),
      confidence: normConfidence(profile.confidence)
    },
    verifiedContacts: {
      emails: arr(contacts.emails)
        .map((item) => sanitizeContact(item, "email"))
        .filter(Boolean),
      phones: arr(contacts.phones)
        .map((item) => sanitizeContact(item, "phone"))
        .filter(Boolean)
    },
    decisionMakers: arr(out.decisionMakers)
      .map((item) => sanitizeSourced(item, ["name", "title"]))
      .filter(Boolean)
      .map((item) => ({
        name: str(item.name),
        title: str(item.title),
        profileUrl: str(item.profileUrl),
        confidence: normConfidence(item.confidence),
        sourceUrl: str(item.sourceUrl)
      })),
    webPresence: {
      confirmedWebsite: {
        url: str(site.url),
        confidence: str(site.url) && str(site.sourceUrl) ? normConfidence(site.confidence) : "unverified",
        sourceUrl: str(site.sourceUrl)
      },
      socialProfiles: arr(web.socialProfiles)
        .map((item) => sanitizeSourced(item, ["url"]))
        .filter(Boolean)
        .map((item) => ({
          platform: SOCIAL_PLATFORMS.includes(item.platform) ? item.platform : "other",
          url: str(item.url),
          confidence: normConfidence(item.confidence),
          sourceUrl: str(item.sourceUrl)
        }))
    },
    servicesOffered: arr(out.servicesOffered)
      .map((item) => sanitizeSourced(item, ["name"]))
      .filter(Boolean)
      .map((item) => ({ name: str(item.name), sourceUrl: str(item.sourceUrl) })),
    signals: arr(out.signals)
      .map((item) => sanitizeSourced(item, ["detail"]))
      .filter(Boolean)
      .map((item) => ({
        type: SIGNAL_TYPES.includes(item.type) ? item.type : "other",
        detail: str(item.detail),
        sourceUrl: str(item.sourceUrl)
      })),
    suggestedOffer: {
      summary: str(out.suggestedOffer?.summary),
      rationale: str(out.suggestedOffer?.rationale)
    },
    citations,
    compliance: {
      publicDataOnly: true,
      notes: str(out.compliance?.notes)
    }
  };
}

/**
 * Validate a dossier's shape. Returns { ok, errors }. Used in tests and as a
 * defensive check; buildDossierFromModelOutput already sanitizes, so a built
 * dossier should always validate.
 */
export function validateDossierShape(dossier) {
  const errors = [];
  if (!isPlainObject(dossier)) return { ok: false, errors: ["dossier is not an object"] };
  const required = [
    "businessProfile",
    "verifiedContacts",
    "decisionMakers",
    "webPresence",
    "servicesOffered",
    "signals",
    "suggestedOffer",
    "citations",
    "compliance"
  ];
  for (const key of required) {
    if (!(key in dossier)) errors.push(`missing ${key}`);
  }
  const checkConfidence = (value, path) => {
    if (!CONFIDENCE_SET.has(value)) errors.push(`${path}: invalid confidence "${value}"`);
  };
  const checkSourced = (items, path) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!str(item?.sourceUrl)) errors.push(`${path}[${i}]: missing sourceUrl`);
      if ("confidence" in (item || {})) checkConfidence(item.confidence, `${path}[${i}]`);
    });
  };
  checkSourced(dossier.verifiedContacts?.emails, "verifiedContacts.emails");
  checkSourced(dossier.verifiedContacts?.phones, "verifiedContacts.phones");
  checkSourced(dossier.decisionMakers, "decisionMakers");
  checkSourced(dossier.webPresence?.socialProfiles, "webPresence.socialProfiles");
  if (dossier.businessProfile) checkConfidence(dossier.businessProfile.confidence, "businessProfile");
  if (dossier.compliance && dossier.compliance.publicDataOnly !== true) {
    errors.push("compliance.publicDataOnly must be true");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Merge a dossier into a lead following the "fill gaps, queue the rest" policy.
 * Pure. Returns:
 *   - metadataPatch    : { research: {...} } to deep-merge under lead.metadata
 *   - leadFieldUpdates : top-level lead fields to apply (only EMPTY fields, only
 *                        verified/high confidence, only with a sourceUrl)
 *   - reviewFlags      : everything else (low confidence, or conflicts) for a human
 * Never overwrites a populated lead field → API-verified data is preserved.
 */
export function mergeDossierIntoLead({ lead = {}, dossier } = {}) {
  const built = isPlainObject(dossier) ? dossier : buildDossierFromModelOutput({});
  const leadFieldUpdates = {};
  const reviewFlags = [];

  const isEmpty = (field) => !str(lead[field]) && !str(lead[`${field}Url`]);
  const flag = (field, value, confidence, sourceUrl, reason) =>
    reviewFlags.push({ field, value: str(value), confidence: normConfidence(confidence), sourceUrl: str(sourceUrl), reason });

  const consider = (field, value, confidence, sourceUrl) => {
    const v = str(value);
    if (!v) return;
    const existing = field === "website" ? str(lead.website) || str(lead.websiteUrl) : str(lead[field]);
    if (existing) {
      // Field already filled (often API-verified) — never overwrite; flag conflicts.
      if (existing.toLowerCase() !== v.toLowerCase()) flag(field, v, confidence, sourceUrl, "conflict");
      return;
    }
    if (HIGH_CONFIDENCE.has(normConfidence(confidence)) && str(sourceUrl)) {
      leadFieldUpdates[field] = v;
    } else {
      flag(field, v, confidence, sourceUrl, "low_confidence");
    }
  };

  // Website
  const site = built.webPresence?.confirmedWebsite || {};
  consider("website", site.url, site.confidence, site.sourceUrl);

  // Best email / phone (highest confidence first)
  const rank = (c) => CONFIDENCE_LEVELS.indexOf(normConfidence(c));
  const bestOf = (items) =>
    [...(Array.isArray(items) ? items : [])].sort((a, b) => rank(a?.confidence) - rank(b?.confidence))[0];
  const bestEmail = bestOf(built.verifiedContacts?.emails);
  if (bestEmail) consider("email", bestEmail.value, bestEmail.confidence, bestEmail.sourceUrl);
  const bestPhone = bestOf(built.verifiedContacts?.phones);
  if (bestPhone) consider("phone", bestPhone.value, bestPhone.confidence, bestPhone.sourceUrl);

  // Flag any additional contacts not chosen for fill so they're reviewable.
  for (const e of Array.isArray(built.verifiedContacts?.emails) ? built.verifiedContacts.emails : []) {
    if (e !== bestEmail) flag("email", e.value, e.confidence, e.sourceUrl, "additional");
  }

  // Primary decision-maker → contactName / contactTitle
  const dm = bestOf(built.decisionMakers);
  if (dm) {
    consider("contactName", dm.name, dm.confidence, dm.sourceUrl);
    if (leadFieldUpdates.contactName && !str(lead.contactTitle) && str(dm.title)) {
      leadFieldUpdates.contactTitle = str(dm.title);
    } else if (!leadFieldUpdates.contactName && str(dm.title)) {
      // name flagged, not applied — leave title alone
    }
  }

  const status = "researched";
  const metadataPatch = {
    research: {
      dossier: built,
      generatedAt: str(built.generatedAt),
      model: str(built.model),
      status,
      reviewQueue: reviewFlags
    }
  };

  return { metadataPatch, leadFieldUpdates, reviewFlags, status };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const RESEARCH_SYSTEM_PROMPT = [
  "You are a B2B sales researcher. Given a local business, use web search and web fetch to research it thoroughly using ONLY public, professional information: the official website, business listings (Google/Yelp), public social profiles, and press.",
  "Goals: confirm the official website, find the owner or a decision-maker (name + title), verify the business phone, find social profiles, summarize the services offered, and note buying signals (hiring, expansion, weak/absent web presence, review themes).",
  "Rules: Verify every contact and claim against a specific public page you can cite. Do NOT collect or infer private personal data (home address, personal email/phone). If you cannot find the website, owner, or phone, say so explicitly — never guess or fabricate. Cite the source URL for every fact."
].join("\n");

const STRUCTURE_SYSTEM_PROMPT = [
  "You convert a sales research write-up into a strict JSON dossier matching the provided schema.",
  "Use ONLY facts supported by the research text and its cited sources. Every contact, decision-maker, social profile, service, and signal MUST include the sourceUrl it came from; if a fact has no citable source, omit it.",
  "If a field is unknown, use an empty string and confidence \"unverified\". Set compliance.publicDataOnly to true. Do not invent emails, phone numbers, names, or URLs."
].join("\n");

function buildResearchPrompt(input) {
  const lines = [
    "Research this business and report everything you can verify, with a source URL for each fact.",
    `Business name: ${str(input.businessName)}`,
    input.city ? `City/area: ${str(input.city)}` : "",
    input.address ? `Address: ${str(input.address)}` : "",
    input.phone ? `Known phone (verify it): ${str(input.phone)}` : "",
    input.website ? `Possible website (confirm it): ${str(input.website)}` : "",
    input.category ? `Category: ${str(input.category)}` : "",
    input.knownContacts?.contactName ? `Known contact: ${str(input.knownContacts.contactName)}` : "",
    input.knownContacts?.email ? `Known email: ${str(input.knownContacts.email)}` : "",
    input.priorFindings
      ? `\nPre-gathered data from other sources — confirm or correct each against a public page, and cite it:\n${str(input.priorFindings)}`
      : "",
    "",
    "Find: confirmed website, owner/decision-maker (name + title), verified phone, email(s), social profiles, services offered, and buying signals. State clearly anything you cannot find."
  ];
  return lines.filter(Boolean).join("\n");
}

function buildStructurePrompt({ input, researchText, citations }) {
  return [
    `Convert the following research about "${str(input.businessName)}" into the dossier schema.`,
    "",
    "RESEARCH:",
    researchText || "(no research text produced)",
    "",
    "SOURCE URLS COLLECTED DURING RESEARCH (use these for citations and sourceUrl fields):",
    JSON.stringify(citations || [], null, 2)
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Network entry point — two-stage (research, then structure), via the shared
// Claude backend (subscription Agent SDK or Messages-API key).
// ---------------------------------------------------------------------------
/**
 * Research a business and return a structured, cited LeadResearchDossier.
 * @param {object} input
 * @param {string} input.businessName  (required)
 * @param {string} [input.city]
 * @param {string} [input.address]
 * @param {string} [input.phone]
 * @param {string} [input.website]
 * @param {string} [input.category]
 * @param {object} [input.knownContacts] { contactName, email }
 * @param {string} [input.priorFindings]  Pre-gathered provider data to verify (optional).
 * @returns {Promise<object>} dossier (with generatedAt + model stamped on)
 */
export async function researchLead(input = {}) {
  if (aiMode() === "off") {
    throw namedError(
      "LeadResearchNotConfigured",
      "AI Deep Research is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (Claude subscription) or ANTHROPIC_API_KEY."
    );
  }
  if (!str(input.businessName)) {
    throw namedError("LeadResearchBadInput", "A business name is required to research a lead.");
  }

  // STAGE A — research with web search/fetch.
  let research;
  try {
    research = await runWebResearch({
      system: RESEARCH_SYSTEM_PROMPT,
      prompt: buildResearchPrompt(input),
      model: MODEL,
      maxWebSearches: MAX_WEB_SEARCHES
    });
  } catch (error) {
    if (error?.name === "AiRefused") {
      throw namedError("LeadResearchRefused", "The model declined to research this business.");
    }
    throw error;
  }
  const researchText = research.text;
  const citations = research.citations || [];

  // STAGE B — structure into the strict dossier. buildDossierFromModelOutput
  // sanitizes to a valid shape regardless of model quirks.
  let modelOutput;
  try {
    modelOutput = await generateJson({
      system: STRUCTURE_SYSTEM_PROMPT,
      prompt: buildStructurePrompt({ input, researchText, citations }),
      schema: DOSSIER_SCHEMA,
      model: MODEL
    });
  } catch (error) {
    if (error?.name === "AiRefused") {
      throw namedError("LeadResearchRefused", "The model declined to structure this research.");
    }
    throw error;
  }
  const dossier = buildDossierFromModelOutput({ modelOutput });

  // Make sure research-collected citations are present even if Stage B dropped some.
  const seen = new Set(dossier.citations.map((c) => c.url));
  for (const c of citations) {
    if (!seen.has(c.url)) {
      dossier.citations.push(c);
      seen.add(c.url);
    }
  }

  dossier.generatedAt = new Date().toISOString();
  dossier.model = MODEL;
  return dossier;
}
