// "Fill missing info" — combine the cheap structured data providers
// (Google Places / Hunter / Apollo) with the LLM (web research) to fill a
// lead's empty fields. Providers run first; the LLM verifies them and fills the
// remaining gaps. Reuses the Deep Research dossier + merge policy so we never
// overwrite an existing value.
import { searchGooglePlaces } from "../integrations/googlePlaces.js";
import { lookupHunterDomain } from "../integrations/hunter.js";
import { searchApolloPeople } from "../integrations/apollo.js";
import { aiMode } from "../ai/claudeBackend.js";
import { FILLABLE_FIELDS, leadValue, missingFields } from "./leadFields.js";
import { mergeDossierIntoLead, researchLead } from "./researchLead.js";

export { missingFields };

const DECISION_MAKER_TITLES = ["owner", "founder", "ceo", "president", "principal", "marketing director"];

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function domainFromUrl(value) {
  const raw = str(value);
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function leadDomain(lead) {
  return str(lead.domain) || domainFromUrl(leadValue(lead, "website"));
}

/**
 * Query the structured providers for the fields a lead is missing. Each
 * provider degrades gracefully when its key is absent. Network.
 * @returns {Promise<{ candidates: Record<string,{value:string,source:string}>, sources: Array }>}
 */
export async function gatherProviderCandidates({ lead = {}, missing = [] } = {}) {
  const candidates = {};
  const sources = [];
  const want = new Set(missing);
  const set = (field, value, source) => {
    const v = str(value);
    if (!v || candidates[field]) return; // first writer wins
    candidates[field] = { value: v, source };
  };

  // 1) Google Places — phone / address / website / city / region / category.
  const wantsPlaces = ["phone", "address", "website", "city", "region", "category"].some((f) => want.has(f));
  if (wantsPlaces && str(lead.businessName || lead.business)) {
    const query = [str(lead.businessName || lead.business), str(lead.city)].filter(Boolean).join(" ");
    const res = await searchGooglePlaces({ query, maxResults: 1 });
    sources.push({ provider: "google_places", ok: !!res.ok, reason: res.reason || "" });
    const place = Array.isArray(res.prospects) ? res.prospects[0] : null;
    if (place) {
      set("phone", place.phone, "google_places");
      set("website", place.website, "google_places");
      set("address", place.address, "google_places");
      set("city", place.city, "google_places");
      set("region", place.region, "google_places");
      set("category", place.category, "google_places");
    }
  }

  // Domain may now be known (lead, or a website Google just found).
  const domain = leadDomain(lead) || domainFromUrl(candidates.website?.value);

  // 2) Hunter — email (and possibly a contact name/title) from the domain.
  if (want.has("email") && domain) {
    const res = await lookupHunterDomain(domain);
    sources.push({ provider: "hunter", ok: !!res.ok, reason: res.reason || "" });
    const contact = Array.isArray(res.contacts) ? res.contacts[0] : null;
    if (contact) {
      set("email", contact.email, "hunter");
      set("contactName", contact.contactName || contact.name, "hunter");
      set("contactTitle", contact.contactTitle || contact.position, "hunter");
    }
  }

  // 3) Apollo — decision-maker name/title (and email) from the domain.
  const wantsPeople = ["contactName", "contactTitle", "email"].some((f) => want.has(f) && !candidates[f]);
  if (wantsPeople && domain) {
    const res = await searchApolloPeople({ domain, titles: DECISION_MAKER_TITLES });
    sources.push({ provider: "apollo", ok: !!res.ok, reason: res.reason || "" });
    const contact = Array.isArray(res.contacts) ? res.contacts[0] : null;
    if (contact) {
      set("contactName", contact.contactName || contact.name, "apollo");
      set("contactTitle", contact.contactTitle || contact.title, "apollo");
      set("email", contact.email, "apollo");
    }
  }

  return { candidates, sources };
}

/**
 * Plan the field updates from provider candidates + an optional dossier. Pure
 * (no network) → unit-testable. Provider values fill empty lead fields directly;
 * the dossier then fills whatever remains and flags low-confidence/conflicts.
 */
export function planFillUpdates({ lead = {}, candidates = {}, dossier = null } = {}) {
  // Provider candidates → only for fields the lead is missing.
  const providerFieldUpdates = {};
  for (const field of FILLABLE_FIELDS) {
    if (!leadValue(lead, field) && candidates[field]?.value) {
      providerFieldUpdates[field] = candidates[field].value;
    }
  }

  // LLM gap-fill: merge the dossier against the lead *after* provider fills, so
  // the model only fills what providers didn't and conflicts get flagged.
  const leadWithProviders = { ...lead, ...providerFieldUpdates };
  const dossierMerge = dossier
    ? mergeDossierIntoLead({ lead: leadWithProviders, dossier })
    : { leadFieldUpdates: {}, reviewFlags: [], metadataPatch: { research: {} } };

  const leadFieldUpdates = { ...providerFieldUpdates, ...dossierMerge.leadFieldUpdates };
  return {
    providerFieldUpdates,
    leadFieldUpdates,
    reviewFlags: dossierMerge.reviewFlags || [],
    dossierMetadata: dossierMerge.metadataPatch?.research || {}
  };
}

function providerSummary(candidates) {
  return Object.entries(candidates)
    .map(([field, { value, source }]) => `${field}: ${value} (via ${source})`)
    .join("\n");
}

/**
 * Orchestrate a full "fill missing info" pass for a lead.
 * @returns {Promise<{ filled: object, reviewFlags: array, sources: array, metadataPatch: object }>}
 */
export async function fillMissingLead({ lead = {} } = {}) {
  if (!str(lead.businessName || lead.business)) {
    const error = new Error("A business name is required to fill missing info.");
    error.name = "FillMissingBadInput";
    throw error;
  }

  const missing = missingFields(lead);
  if (!missing.length) {
    return { filled: {}, reviewFlags: [], sources: [], metadataPatch: {}, noGaps: true };
  }

  // 1) Providers (graceful when keys are absent).
  const { candidates, sources } = await gatherProviderCandidates({ lead, missing });

  // 2) LLM verification + gap-fill (best-effort; skipped if AI not configured).
  let dossier = null;
  if (aiMode() !== "off") {
    try {
      dossier = await researchLead({
        businessName: lead.businessName || lead.business,
        city: lead.city,
        address: lead.address,
        phone: lead.phone,
        website: leadValue(lead, "website") || candidates.website?.value,
        category: lead.category,
        knownContacts: { email: lead.email, contactName: lead.contactName },
        priorFindings: providerSummary(candidates)
      });
    } catch (error) {
      // Keep provider results even if the LLM pass fails; record why.
      sources.push({ provider: "llm", ok: false, reason: error?.message || "research failed" });
    }
  }

  // 3) Plan + assemble the metadata patch.
  const { leadFieldUpdates, reviewFlags, dossierMetadata } = planFillUpdates({ lead, candidates, dossier });
  const metadataPatch = {
    research: dossierMetadata,
    fillMissing: {
      ranAt: new Date().toISOString(),
      requested: missing,
      filled: Object.keys(leadFieldUpdates),
      candidates,
      sources
    }
  };

  return { filled: leadFieldUpdates, reviewFlags, sources, metadataPatch };
}
