// Real-data sourcing + contact enrichment, composed from existing + new provider
// adapters. Every adapter degrades gracefully (providerResponse contract), so this
// layer NEVER throws on missing keys/network — it falls back to mock data so the
// demo always works.
//
// Quota-aware staging:
//   SEARCH  (cheap/broad): SEC EDGAR + OpenCorporates + Google Places
//   RESEARCH (per-account, behind Gate 1): Apollo + Hunter + EDGAR firmographics
//
// Pure-ish: no DB writes here; routes own persistence.

import { searchSecEdgar, getEdgarFirmographics } from "../integrations/secEdgar.js";
import { searchOpenCorporates } from "../integrations/openCorporates.js";
import { searchGooglePlaces } from "../integrations/googlePlaces.js";
import { searchApolloPeople } from "../integrations/apollo.js";
import { lookupHunterDomain } from "../integrations/hunter.js";
import { scoreAccountFit, recommendedGateAfterScore, DEFAULT_ICP } from "./accountFit.js";
import { mockAccountSearch } from "./mockSourcing.js";

// Marketing-decision-maker titles for Apollo people search.
export const DEFAULT_COMMITTEE_TITLES = [
  "Chief Marketing Officer",
  "VP Marketing",
  "Head of Brand",
  "Head of Growth",
  "Marketing Director",
  "Brand Manager",
  "Head of Demand Generation"
];

function dedupeByName(accounts) {
  const seen = new Map();
  for (const a of accounts) {
    const key = String(a.name || "").trim().toLowerCase();
    if (!key) continue;
    const existing = seen.get(key);
    // Prefer the entry that carries a domain (more useful downstream).
    if (!existing || (!existing.domain && a.domain)) seen.set(key, a);
  }
  return [...seen.values()];
}

function placeToAccount(p) {
  return {
    name: p.businessName || p.business || "",
    domain: p.domain || "",
    segment: "",
    sourceType: "google_places",
    firmographics: {
      hqGeo: [p.city, p.region, p.country].filter(Boolean).join(", "),
      industry: p.category || "",
      ownership: ""
    },
    signals: [],
    buyingCommittee: []
  };
}

/**
 * sourceAccountPreviews({ query, segment, icp, limit }) -> async
 *   { results: [{...account, fit, fitScore, tier, recommendedNextGate}], sources, usedFallback }
 * Composes real providers; falls back to mock data when nothing is configured/returned.
 */
export async function sourceAccountPreviews({ query = "", segment = "", icp = DEFAULT_ICP, limit = 25 } = {}) {
  const sources = [];
  let collected = [];

  const [edgar, oc, places] = await Promise.all([
    searchSecEdgar({ query, limit }).catch((e) => ({ ok: false, provider: "sec_edgar", reason: e.message, data: [] })),
    searchOpenCorporates({ query, limit }).catch((e) => ({ ok: false, provider: "opencorporates", reason: e.message, data: [] })),
    query
      ? searchGooglePlaces({ query, maxResults: Math.min(limit, 20) }).catch((e) => ({ ok: false, provider: "google_places", reason: e.message, prospects: [] }))
      : Promise.resolve({ ok: false, provider: "google_places", configured: true, reason: "No query for Places.", prospects: [] })
  ]);

  // Google Places (domain-bearing) first so it wins dedupe.
  if (places.ok) collected.push(...(places.prospects || []).map(placeToAccount));
  sources.push({ provider: "google_places", ok: !!places.ok, count: (places.prospects || []).length, reason: places.reason || "" });

  if (edgar.ok) collected.push(...(edgar.data || []));
  sources.push({ provider: "sec_edgar", ok: !!edgar.ok, count: (edgar.data || []).length, reason: edgar.reason || "" });

  if (oc.ok) collected.push(...(oc.data || []));
  sources.push({ provider: "opencorporates", ok: !!oc.ok, count: (oc.data || []).length, reason: oc.reason || "" });

  collected = dedupeByName(collected);
  if (segment) collected = collected.filter((a) => !a.segment || a.segment === segment);

  let usedFallback = false;
  if (collected.length === 0) {
    usedFallback = true;
    collected = mockAccountSearch({ query, segment, limit });
  }

  const results = collected.slice(0, limit).map((account) => {
    const fit = scoreAccountFit(account, icp);
    return {
      ...account,
      tier: fit.tier,
      fitScore: fit.fitScore,
      fitRationale: fit.rationale,
      fit,
      recommendedNextGate: recommendedGateAfterScore(fit)
    };
  });

  return { results, sources, usedFallback };
}

function guessRole(title = "") {
  const t = String(title).toLowerCase();
  if (/chief marketing|cmo|vp marketing|head of marketing|marketing director|svp/.test(t)) return "economic_buyer";
  if (/growth|demand|brand manager|content|marketing manager/.test(t)) return "champion";
  if (/creative|digital|comms|communication|pr\b/.test(t)) return "influencer";
  if (/procurement|legal|purchas/.test(t)) return "blocker";
  return "user";
}

/**
 * enrichAccountContacts({ account }) -> async { buyingCommittee, firmographicsPatch, sources }
 * Real committee/contact sourcing via Apollo (people) + Hunter (emails), plus EDGAR
 * firmographics when a CIK is known. Needs a domain for Apollo/Hunter; if absent,
 * returns the account's existing committee unchanged and reports why.
 */
export async function enrichAccountContacts({ account = {} } = {}) {
  const sources = [];
  const firmographicsPatch = {};
  const domain = account.domain || "";

  // EDGAR firmographics (public companies discovered via EDGAR carry a CIK).
  const cik = account.firmographics?.cik;
  if (cik) {
    const edgar = await getEdgarFirmographics({ cik }).catch((e) => ({ ok: false, reason: e.message }));
    sources.push({ provider: "sec_edgar", ok: !!edgar.ok, reason: edgar.reason || "" });
    if (edgar.ok && edgar.data) {
      if (edgar.data.industry) firmographicsPatch.industry = edgar.data.industry;
      if (edgar.data.hqGeo) firmographicsPatch.hqGeo = edgar.data.hqGeo;
      if (edgar.data.ownership) firmographicsPatch.ownership = edgar.data.ownership;
    }
  }

  if (!domain) {
    sources.push({ provider: "apollo", ok: false, reason: "No account domain; add one to source contacts." });
    sources.push({ provider: "hunter", ok: false, reason: "No account domain." });
    return { buyingCommittee: account.buyingCommittee || [], firmographicsPatch, sources };
  }

  const [apollo, hunter] = await Promise.all([
    searchApolloPeople({ domain, titles: DEFAULT_COMMITTEE_TITLES }).catch((e) => ({ ok: false, contacts: [], reason: e.message })),
    lookupHunterDomain(domain).catch((e) => ({ ok: false, contacts: [], reason: e.message }))
  ]);
  sources.push({ provider: "apollo", ok: !!apollo.ok, count: (apollo.contacts || []).length, reason: apollo.reason || "" });
  sources.push({ provider: "hunter", ok: !!hunter.ok, count: (hunter.contacts || []).length, reason: hunter.reason || "" });

  // Index Hunter emails by normalized person name.
  const hunterByName = new Map();
  for (const h of hunter.contacts || []) {
    if (h.name) hunterByName.set(h.name.trim().toLowerCase(), h);
  }

  const committee = [];
  for (const c of apollo.contacts || []) {
    const name = c.name || c.contactName || "";
    const hunterMatch = name ? hunterByName.get(name.trim().toLowerCase()) : null;
    let email = c.email || "";
    let emailStatus = email ? "verified" : "unknown";
    if (!email && hunterMatch?.email) {
      email = hunterMatch.email;
      emailStatus = (hunterMatch.confidence || 0) >= 80 ? "verified" : "pattern_unverified";
    }
    committee.push({
      roleLabel: guessRole(c.position || c.contactTitle),
      name,
      title: c.position || c.contactTitle || "",
      isPrimary: false,
      email,
      emailStatus,
      source: "apollo",
      confidence: email ? "high" : "medium",
      profileUrl: c.linkedin || ""
    });
  }

  // Add Hunter-only contacts (have an email, not already represented).
  const haveNames = new Set(committee.map((c) => c.name.trim().toLowerCase()).filter(Boolean));
  for (const h of hunter.contacts || []) {
    if (h.name && haveNames.has(h.name.trim().toLowerCase())) continue;
    if (!h.email) continue;
    committee.push({
      roleLabel: guessRole(h.position || h.contactTitle),
      name: h.name || "",
      title: h.position || h.contactTitle || "",
      isPrimary: false,
      email: h.email,
      emailStatus: (h.confidence || 0) >= 80 ? "verified" : "pattern_unverified",
      source: "hunter",
      confidence: (h.confidence || 0) >= 80 ? "high" : "medium",
      profileUrl: ""
    });
  }

  if (committee.length) committee[0].isPrimary = true;

  // If providers returned nobody, keep whatever the account already had.
  const finalCommittee = committee.length ? committee : account.buyingCommittee || [];
  return { buyingCommittee: finalCommittee, firmographicsPatch, sources };
}
