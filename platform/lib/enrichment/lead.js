import { buildSalesBrief } from "./salesBrief.js";
import { buildOptionalSalesBrief } from "./llmBrief.js";
import { classifySocialUrl, extractHandle, normalizeSocialUrl } from "./socialProfiles.js";

function now() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function compactValue(value) {
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compactValue(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (value === null || value === undefined) return undefined;
  return value;
}

function mergeUniqueItems(existingItems, incomingItems) {
  const merged = [];
  const seen = new Set();

  for (const item of [...(Array.isArray(existingItems) ? existingItems : []), ...(Array.isArray(incomingItems) ? incomingItems : [])]) {
    const normalized = compactValue(item);
    if (!normalized) continue;

    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push(normalized);
  }

  return merged.length ? merged : undefined;
}

function mergeSocialProfiles(existingProfiles, incomingProfiles) {
  const merged = {};

  for (const source of [existingProfiles, incomingProfiles]) {
    if (!isPlainObject(source)) continue;

    for (const [platform, profiles] of Object.entries(source)) {
      const values = Array.isArray(profiles)
        ? profiles
            .map((profile) => normalizeSocialProfileEntry(platform, profile))
            .filter(Boolean)
        : [];
      if (!values.length) continue;

      if (!merged[platform]) merged[platform] = [];
      for (const value of values) {
        if (!merged[platform].some((existing) => existing.url === value.url)) {
          merged[platform].push(value);
        }
      }
    }
  }

  return Object.keys(merged).length ? merged : undefined;
}

function normalizeSocialProfileEntry(platform, profile) {
  const base = typeof profile === "string" ? { url: profile } : profile;
  const url = normalizeSocialUrl(base?.url);
  if (!url) return null;

  const detectedPlatform = platform || classifySocialUrl(url);
  if (!detectedPlatform) return null;

  return {
    url,
    handle: typeof base?.handle === "string" && base.handle.trim()
      ? base.handle.trim()
      : extractHandle(detectedPlatform, url) || "",
    sourceUrl: typeof base?.sourceUrl === "string" ? base.sourceUrl : url
  };
}

function countSocialProfiles(socialProfiles) {
  if (!isPlainObject(socialProfiles)) return 0;
  return Object.values(socialProfiles).reduce(
    (count, urls) => count + (Array.isArray(urls) ? urls.length : 0),
    0
  );
}

function getEnrichmentStatus(enrichmentResult) {
  if (!enrichmentResult?.ok) return "failed";
  return Array.isArray(enrichmentResult.sources) && enrichmentResult.sources.some((source) => source?.ok === false)
    ? "partial"
    : "complete";
}

function buildEnrichmentSummary(status, enrichmentResult, scannedAt) {
  const stamp = scannedAt.slice(0, 10);
  if (status === "failed") {
    return `${stamp} website enrichment failed: ${enrichmentResult?.reason || "Unable to scan website."}`;
  }

  const contactCount = Array.isArray(enrichmentResult?.contacts) ? enrichmentResult.contacts.length : 0;
  const socialCount = countSocialProfiles(enrichmentResult?.socialProfiles);
  const sourceCount = Array.isArray(enrichmentResult?.sources) ? enrichmentResult.sources.length : 0;
  return `${stamp} website enrichment ${status}: ${contactCount} contacts, ${socialCount} social profiles, ${sourceCount} pages scanned.`;
}

function appendNote(existingNotes, summary) {
  const current = String(existingNotes || "").trim();
  return current ? `${current}\n${summary}` : summary;
}

function mergeObjects(existingValue, patchValue) {
  const base = isPlainObject(existingValue) ? existingValue : {};
  if (!isPlainObject(patchValue)) return { ...base };

  const merged = { ...base };
  for (const [key, value] of Object.entries(patchValue)) {
    if (isPlainObject(value)) {
      merged[key] = mergeObjects(base[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export function buildLeadEnrichmentUpdate(lead, enrichmentResult, scannedAt = now()) {
  const existingEnrichment = isPlainObject(lead?.metadata?.enrichment) ? lead.metadata.enrichment : {};
  const enrichmentStatus = getEnrichmentStatus(enrichmentResult);

  const metadataPatch = {
    version: "v1",
    status: enrichmentStatus,
    lastEnrichedAt: scannedAt
  };

  const website = compactValue(enrichmentResult?.website);
  if (website) metadataPatch.website = website;

  const contacts = mergeUniqueItems(existingEnrichment.contacts, enrichmentResult?.contacts);
  if (contacts) metadataPatch.contacts = contacts;

  const socialProfiles = mergeSocialProfiles(existingEnrichment.socialProfiles, enrichmentResult?.socialProfiles);
  if (socialProfiles) metadataPatch.socialProfiles = socialProfiles;

  const sources = mergeUniqueItems(existingEnrichment.sources, enrichmentResult?.sources);
  if (sources) metadataPatch.sources = sources;

  const signals = mergeUniqueItems(existingEnrichment.signals, enrichmentResult?.signals);
  if (signals) metadataPatch.signals = signals;

  const compliance = compactValue(enrichmentResult?.compliance);
  if (compliance) {
    metadataPatch.compliance = {
      ...(isPlainObject(existingEnrichment.compliance) ? existingEnrichment.compliance : {}),
      ...compliance
    };
  }

  const nextEnrichment = mergeObjects(existingEnrichment, metadataPatch);
  const nextLead = {
    ...lead,
    metadata: {
      ...(isPlainObject(lead?.metadata) ? lead.metadata : {}),
      enrichment: nextEnrichment
    }
  };
  metadataPatch.salesIntelligence = buildSalesBrief({ lead: nextLead });

  return {
    metadata: {
      enrichment: metadataPatch
    },
    notes: appendNote(lead?.notes, buildEnrichmentSummary(enrichmentStatus, enrichmentResult, scannedAt)),
    status: lead?.status === "new" ? "researched" : lead?.status || "researched",
    enrichmentStatus
  };
}

export async function buildLeadEnrichmentUpdateWithOptionalLlm(lead, enrichmentResult, scannedAt = now()) {
  const update = buildLeadEnrichmentUpdate(lead, enrichmentResult, scannedAt);
  const nextLead = {
    ...lead,
    notes: update.notes,
    status: update.status,
    metadata: mergeObjects(
      isPlainObject(lead?.metadata) ? lead.metadata : {},
      update.metadata
    )
  };

  update.metadata.enrichment.salesIntelligence = await buildOptionalSalesBrief({
    lead: nextLead,
    fallbackBrief: update.metadata.enrichment.salesIntelligence
  });

  return update;
}

export function buildLeadEnrichmentNotice(lead, enrichmentResult, enrichmentStatus) {
  const label = lead?.business || lead?.name || lead?.websiteUrl || lead?.id || "lead";
  if (enrichmentStatus === "failed") {
    return `Website enrichment failed for ${label}: ${enrichmentResult?.reason || "Unable to scan website."}`;
  }
  if (enrichmentStatus === "partial") {
    return `Website enrichment partially completed for ${label}.`;
  }
  return `Website enrichment completed for ${label}.`;
}
