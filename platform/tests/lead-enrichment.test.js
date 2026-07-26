import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadEnrichmentNotice, buildLeadEnrichmentUpdate } from "../lib/enrichment/lead.js";

test("buildLeadEnrichmentUpdate appends notes and promotes new leads to researched", () => {
  const lead = {
    id: "lead_123",
    business: "Example Dental",
    websiteUrl: "https://example.com",
    status: "new",
    notes: "Imported from CSV",
    metadata: {}
  };

  const enrichmentResult = {
    ok: true,
    reason: null,
    website: {
      requestedUrl: "https://example.com",
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      domain: "example.com",
      business: "Example Dental",
      title: "Example Dental",
      metaDescription: "Cosmetic dentistry"
    },
    contacts: [{ type: "email", value: "hello@example.com", sourceUrl: "https://example.com/contact" }],
    socialProfiles: {
      instagram: ["https://instagram.com/exampledental"]
    },
    sources: [{ category: "homepage", url: "https://example.com/", ok: true }],
    signals: [{ type: "schema_org", schemaType: "Dentist", sourceUrl: "https://example.com/" }],
    compliance: {
      publicDataOnly: true,
      requestCount: 1,
      scannedAt: "2026-06-15T14:00:00.000Z"
    }
  };

  const update = buildLeadEnrichmentUpdate(lead, enrichmentResult, "2026-06-15T14:00:00.000Z");

  assert.equal(update.status, "researched");
  assert.equal(update.enrichmentStatus, "complete");
  assert.equal(update.metadata.enrichment.version, "v1");
  assert.equal(update.metadata.enrichment.lastEnrichedAt, "2026-06-15T14:00:00.000Z");
  assert.equal(update.metadata.enrichment.website.title, "Example Dental");
  assert.deepEqual(update.metadata.enrichment.socialProfiles.instagram, [
    {
      url: "https://instagram.com/exampledental",
      handle: "@exampledental",
      sourceUrl: "https://instagram.com/exampledental"
    }
  ]);
  assert.equal(typeof update.metadata.enrichment.salesIntelligence.summary, "string");
  assert.equal(update.metadata.enrichment.salesIntelligence.summary.includes("Example Dental"), true);
  assert.equal(
    update.metadata.enrichment.salesIntelligence.evidence.some(
      (item) => item.field === "metadata.enrichment.socialProfiles.instagram"
    ),
    true
  );
  assert.match(update.notes, /Imported from CSV/);
  assert.match(update.notes, /website enrichment complete: 1 contacts, 1 social profiles, 1 pages scanned\./i);
  assert.equal(
    buildLeadEnrichmentNotice(lead, enrichmentResult, update.enrichmentStatus),
    "Website enrichment completed for Example Dental."
  );
});

test("failed enrichment patch preserves existing enrichment arrays and leaves provider metadata untouched", () => {
  const lead = {
    id: "lead_failure_preserve",
    business: "Example Dental",
    websiteUrl: "https://example.com",
    status: "new",
    notes: "Existing note",
    metadata: {
      googlePlaces: {
        displayName: { text: "Example Dental" }
      },
      hunter: {
        email: "owner@example.com"
      },
      enrichment: {
        website: {
          title: "Old Title"
        },
        contacts: [{ type: "email", value: "saved@example.com", sourceUrl: "https://example.com/contact" }],
        socialProfiles: {
          linkedin: ["https://linkedin.com/company/exampledental"]
        },
        sources: [{ category: "homepage", url: "https://example.com/", ok: true }],
        signals: [{ type: "schema_org", schemaType: "Dentist", sourceUrl: "https://example.com/" }],
        compliance: {
          publicDataOnly: true,
          requestCount: 1,
          scannedAt: "2026-06-10T10:00:00.000Z"
        }
      }
    }
  };

  const failedEnrichment = {
    ok: false,
    reason: "Request timed out after 5000ms.",
    website: {
      requestedUrl: "https://example.com",
      url: "https://example.com/",
      domain: "example.com",
      business: "Example Dental"
    },
    contacts: [],
    socialProfiles: {},
    sources: [{ category: "homepage", requestedUrl: "https://example.com/", ok: false, reason: "Request timed out after 5000ms." }],
    signals: [],
    compliance: {
      publicDataOnly: true,
      requestCount: 1,
      scannedAt: "2026-06-15T15:00:00.000Z"
    }
  };

  const update = buildLeadEnrichmentUpdate(lead, failedEnrichment, "2026-06-15T15:00:00.000Z");

  assert.equal(update.enrichmentStatus, "failed");
  assert.equal(update.status, "researched");
  assert.deepEqual(Object.keys(update.metadata), ["enrichment"]);
  assert.equal(update.metadata.enrichment.version, "v1");
  assert.equal(update.metadata.enrichment.status, "failed");
  assert.equal(update.metadata.enrichment.website.domain, "example.com");
  assert.equal(update.metadata.enrichment.contacts.length, 1);
  assert.deepEqual(update.metadata.enrichment.socialProfiles.linkedin, [
    {
      url: "https://linkedin.com/company/exampledental",
      handle: "company/exampledental",
      sourceUrl: "https://linkedin.com/company/exampledental"
    }
  ]);
  assert.equal(update.metadata.enrichment.sources.length, 2);
  assert.equal(update.metadata.enrichment.signals.length, 1);
  assert.equal(update.metadata.enrichment.compliance.requestCount, 1);
  assert.equal(update.metadata.enrichment.compliance.scannedAt, "2026-06-15T15:00:00.000Z");
  assert.equal(typeof update.metadata.enrichment.salesIntelligence.summary, "string");
  assert.match(update.notes, /Existing note/);
  assert.match(update.notes, /website enrichment failed: Request timed out after 5000ms\./i);
  assert.equal(
    buildLeadEnrichmentNotice(lead, failedEnrichment, update.enrichmentStatus),
    "Website enrichment failed for Example Dental: Request timed out after 5000ms."
  );
});
