import { buildLeadEnrichmentUpdate } from "./lead.js";
import { enrichWebsite } from "./website.js";

export const DEFAULT_MAX_GOOGLE_AUTO_ENRICH = 5;

export function isAutoEnrichEnabled(value) {
  return value === true || value === "true" || value === "1" || value === "on";
}

export function buildGoogleImportNotice({ importedCount, enrichedCount }) {
  return `Imported ${importedCount} prospects. Enriched ${enrichedCount} websites.`;
}

export async function maybeAutoEnrichGoogleLead({
  autoEnrich,
  lead,
  attemptedCount = 0,
  maxAutoEnrich = DEFAULT_MAX_GOOGLE_AUTO_ENRICH,
  enrichWebsiteImpl = enrichWebsite,
  updateLeadResearchImpl,
  buildLeadEnrichmentUpdateImpl = buildLeadEnrichmentUpdate
}) {
  if (!autoEnrich || !lead?.websiteUrl || attemptedCount >= maxAutoEnrich) {
    return { attempted: false, enriched: false };
  }

  try {
    const enrichmentResult = await enrichWebsiteImpl({
      url: lead.websiteUrl,
      business: lead.business
    });
    const update = buildLeadEnrichmentUpdateImpl(lead, enrichmentResult);
    await updateLeadResearchImpl(lead.id, update);

    return {
      attempted: true,
      enriched: update.enrichmentStatus !== "failed"
    };
  } catch {
    return {
      attempted: true,
      enriched: false
    };
  }
}
