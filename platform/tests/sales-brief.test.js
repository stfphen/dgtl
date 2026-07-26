import assert from "node:assert/strict";
import test from "node:test";
import { buildSalesBrief } from "../lib/enrichment/salesBrief.js";

test("buildSalesBrief returns useful output for a med spa style lead", () => {
  const brief = buildSalesBrief({
    lead: {
      id: "lead_med_spa",
      business: "Northview Med Spa",
      phone: "+1 416 555 0199",
      websiteUrl: "https://northviewmedspa.com",
      metadata: {
        rating: 4.8,
        userRatingCount: 127,
        enrichment: {
          status: "complete",
          website: {
            title: "Northview Med Spa",
            textSample:
              "Northview Med Spa offers Botox, filler, facials, skin tightening, body contouring, and membership-based skincare consultations in Toronto.",
            priorityPages: [
              { category: "services", url: "https://northviewmedspa.com/services" },
              { category: "about", url: "https://northviewmedspa.com/about" }
            ],
            headings: {
              h1: ["Natural-looking aesthetics"],
              h2: ["Botox", "Lip filler", "HydraFacial", "Body contouring"],
              h3: ["Consultations", "Membership options"]
            }
          },
          contacts: [{ type: "phone", value: "+1 416 555 0199", sourceUrl: "https://northviewmedspa.com" }],
          socialProfiles: {
            instagram: ["https://instagram.com/northviewmedspa"]
          }
        }
      }
    }
  });

  assert.match(brief.summary, /Northview Med Spa/);
  assert.equal(brief.likelyNeeds.length > 0, true);
  assert.equal(brief.outreachAngles.length > 0, true);
  assert.match(brief.callerOpeningLine, /Northview Med Spa/);
  assert.match(brief.suggestedOffer, /content|review|Website|Caller/i);
});

test("sales brief scores are numeric and bounded", () => {
  const brief = buildSalesBrief({
    lead: {
      business: "Example Dental",
      metadata: {
        enrichment: {
          status: "failed",
          contacts: [],
          socialProfiles: {}
        }
      }
    }
  });

  assert.equal(typeof brief.fitScore, "number");
  assert.equal(typeof brief.confidenceScore, "number");
  assert.equal(brief.fitScore >= 0 && brief.fitScore <= 100, true);
  assert.equal(brief.confidenceScore >= 0 && brief.confidenceScore <= 100, true);
});

test("sales brief evidence references source fields", () => {
  const brief = buildSalesBrief({
    lead: {
      business: "Example Dental",
      phone: "+1 416 555 0100",
      websiteUrl: "https://example.com",
      metadata: {
        rating: 4.7,
        userRatingCount: 88,
        enrichment: {
          status: "complete",
          website: {
            textSample: "Example Dental provides implants, veneers, whitening, and same-week consultations.",
            priorityPages: [{ category: "services", url: "https://example.com/services" }],
            headings: {
              h1: ["Example Dental"],
              h2: ["Implants", "Veneers", "Whitening", "Emergency care"]
            }
          },
          contacts: [{ type: "phone", value: "+1 416 555 0100", sourceUrl: "https://example.com" }],
          socialProfiles: {
            instagram: ["https://instagram.com/exampledental"]
          }
        }
      }
    }
  });

  assert.equal(brief.evidence.length > 0, true);
  assert.equal(brief.evidence.every((item) => typeof item.field === "string" && item.field.length > 0), true);
  assert.equal(brief.evidence.some((item) => item.field === "metadata.rating"), true);
  assert.equal(brief.evidence.some((item) => item.field === "metadata.enrichment.contacts"), true);
});
