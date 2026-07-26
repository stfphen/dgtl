import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleImportNotice,
  DEFAULT_MAX_GOOGLE_AUTO_ENRICH,
  isAutoEnrichEnabled,
  maybeAutoEnrichGoogleLead
} from "../lib/enrichment/googleAutoEnrich.js";

test("isAutoEnrichEnabled recognizes checked form values", () => {
  assert.equal(isAutoEnrichEnabled("on"), true);
  assert.equal(isAutoEnrichEnabled("1"), true);
  assert.equal(isAutoEnrichEnabled("true"), true);
  assert.equal(isAutoEnrichEnabled(null), false);
  assert.equal(isAutoEnrichEnabled(""), false);
});

test("maybeAutoEnrichGoogleLead skips when disabled, missing website, or cap reached", async () => {
  const lead = {
    id: "lead_google_skip",
    business: "Example Dental",
    websiteUrl: "https://example.com"
  };

  assert.deepEqual(
    await maybeAutoEnrichGoogleLead({
      autoEnrich: false,
      lead,
      updateLeadResearchImpl: async () => {}
    }),
    { attempted: false, enriched: false }
  );

  assert.deepEqual(
    await maybeAutoEnrichGoogleLead({
      autoEnrich: true,
      lead: { ...lead, websiteUrl: "" },
      updateLeadResearchImpl: async () => {}
    }),
    { attempted: false, enriched: false }
  );

  assert.deepEqual(
    await maybeAutoEnrichGoogleLead({
      autoEnrich: true,
      lead,
      attemptedCount: DEFAULT_MAX_GOOGLE_AUTO_ENRICH,
      updateLeadResearchImpl: async () => {}
    }),
    { attempted: false, enriched: false }
  );
});

test("maybeAutoEnrichGoogleLead enriches and updates when within cap", async () => {
  const calls = [];
  const lead = {
    id: "lead_google_enrich",
    business: "Example Dental",
    websiteUrl: "https://example.com"
  };

  const result = await maybeAutoEnrichGoogleLead({
    autoEnrich: true,
    lead,
    enrichWebsiteImpl: async ({ url, business }) => {
      calls.push(["enrich", url, business]);
      return { ok: true, contacts: [], socialProfiles: {}, sources: [], signals: [], compliance: {}, website: {} };
    },
    buildLeadEnrichmentUpdateImpl: (_lead, enrichmentResult) => {
      calls.push(["build", enrichmentResult.ok]);
      return { metadata: { enrichment: { status: "complete" } }, notes: "done", status: "researched", enrichmentStatus: "complete" };
    },
    updateLeadResearchImpl: async (leadId, update) => {
      calls.push(["update", leadId, update.enrichmentStatus]);
    }
  });

  assert.deepEqual(result, { attempted: true, enriched: true });
  assert.deepEqual(calls, [
    ["enrich", "https://example.com", "Example Dental"],
    ["build", true],
    ["update", "lead_google_enrich", "complete"]
  ]);
});

test("maybeAutoEnrichGoogleLead swallows enrichment failures and route notice stays stable", async () => {
  const result = await maybeAutoEnrichGoogleLead({
    autoEnrich: true,
    lead: {
      id: "lead_google_failure",
      business: "Example Dental",
      websiteUrl: "https://example.com"
    },
    enrichWebsiteImpl: async () => {
      throw new Error("timeout");
    },
    updateLeadResearchImpl: async () => {
      throw new Error("should not run");
    }
  });

  assert.deepEqual(result, { attempted: true, enriched: false });
  assert.equal(
    buildGoogleImportNotice({ importedCount: 8, enrichedCount: 3 }),
    "Imported 8 prospects. Enriched 3 websites."
  );
});
