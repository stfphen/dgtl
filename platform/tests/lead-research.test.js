import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDossierFromModelOutput,
  mergeDossierIntoLead,
  validateDossierShape,
  collectCitations
} from "../lib/leadResearch/researchLead.js";

// A representative shape of what the model returns under the structured-output schema.
function sampleModelOutput() {
  return {
    businessProfile: {
      summary: "Boutique medspa offering injectables and facials.",
      category: "med spa",
      locationText: "Austin, TX",
      foundedOrYears: "Since 2016",
      confidence: "high"
    },
    verifiedContacts: {
      emails: [
        { value: "hello@glowmedspa.com", type: "email", confidence: "high", sourceUrl: "https://glowmedspa.com/contact" },
        { value: "random@guess.com", type: "email", confidence: "low", sourceUrl: "" } // no source → dropped
      ],
      phones: [{ value: "+1-512-555-0100", type: "phone", confidence: "verified", sourceUrl: "https://glowmedspa.com" }]
    },
    decisionMakers: [
      { name: "Dana Cole", title: "Owner", profileUrl: "https://linkedin.com/in/danacole", confidence: "high", sourceUrl: "https://glowmedspa.com/about" }
    ],
    webPresence: {
      confirmedWebsite: { url: "https://glowmedspa.com", confidence: "verified", sourceUrl: "https://google.com/maps" },
      socialProfiles: [
        { platform: "instagram", url: "https://instagram.com/glowmedspa", confidence: "high", sourceUrl: "https://glowmedspa.com" },
        { platform: "bogus", url: "https://x.com/glow", confidence: "medium", sourceUrl: "https://glowmedspa.com" } // platform normalized to "other"
      ]
    },
    servicesOffered: [
      { name: "Botox", sourceUrl: "https://glowmedspa.com/services" },
      { name: "no-source service", sourceUrl: "" } // dropped
    ],
    signals: [{ type: "hiring", detail: "Hiring a nurse injector", sourceUrl: "https://glowmedspa.com/careers" }],
    suggestedOffer: { summary: "Local SEO + reviews", rationale: "Thin web presence." },
    citations: [
      { url: "https://glowmedspa.com", title: "Glow Medspa" },
      { url: "https://glowmedspa.com", title: "dup" } // deduped
    ],
    compliance: { publicDataOnly: true, notes: "" }
  };
}

test("buildDossierFromModelOutput sanitizes, dedupes, and stamps compliance", () => {
  const dossier = buildDossierFromModelOutput({ modelOutput: sampleModelOutput() });

  assert.equal(dossier.compliance.publicDataOnly, true);
  // source-less email dropped, valid one kept
  assert.equal(dossier.verifiedContacts.emails.length, 1);
  assert.equal(dossier.verifiedContacts.emails[0].value, "hello@glowmedspa.com");
  // source-less service dropped
  assert.equal(dossier.servicesOffered.length, 1);
  // unknown platform normalized
  const platforms = dossier.webPresence.socialProfiles.map((s) => s.platform);
  assert.ok(platforms.includes("other"));
  // citations deduped by url
  assert.equal(dossier.citations.length, 1);
});

test("buildDossierFromModelOutput tolerates empty/sparse output", () => {
  const dossier = buildDossierFromModelOutput({ modelOutput: {} });
  assert.equal(dossier.compliance.publicDataOnly, true);
  assert.deepEqual(dossier.verifiedContacts.emails, []);
  assert.equal(dossier.webPresence.confirmedWebsite.confidence, "unverified");
  assert.equal(validateDossierShape(dossier).ok, true);
});

test("validateDossierShape rejects a source-less contact and bad confidence", () => {
  const good = buildDossierFromModelOutput({ modelOutput: sampleModelOutput() });
  assert.equal(validateDossierShape(good).ok, true);

  const bad = buildDossierFromModelOutput({ modelOutput: sampleModelOutput() });
  bad.verifiedContacts.emails.push({ value: "x@y.com", type: "email", confidence: "high", sourceUrl: "" });
  bad.decisionMakers[0].confidence = "bananas";
  const result = validateDossierShape(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("missing sourceUrl")));
  assert.ok(result.errors.some((e) => e.includes("invalid confidence")));
});

test("mergeDossierIntoLead fills empty fields with high-confidence sourced data", () => {
  const dossier = buildDossierFromModelOutput({ modelOutput: sampleModelOutput() });
  const lead = { businessName: "Glow Medspa", website: "", email: "", contactName: "", phone: "" };

  const { leadFieldUpdates, metadataPatch } = mergeDossierIntoLead({ lead, dossier });

  assert.equal(leadFieldUpdates.website, "https://glowmedspa.com");
  assert.equal(leadFieldUpdates.email, "hello@glowmedspa.com");
  assert.equal(leadFieldUpdates.phone, "+1-512-555-0100");
  assert.equal(leadFieldUpdates.contactName, "Dana Cole");
  assert.equal(leadFieldUpdates.contactTitle, "Owner");
  // dossier always lands under metadata.research
  assert.equal(metadataPatch.research.dossier, dossier);
  assert.equal(metadataPatch.research.status, "researched");
});

test("mergeDossierIntoLead never overwrites a populated (API-verified) field", () => {
  const dossier = buildDossierFromModelOutput({ modelOutput: sampleModelOutput() });
  const lead = {
    businessName: "Glow Medspa",
    website: "https://existing-site.com",
    email: "verified@apollo.example",
    phone: "+1-512-555-0100",
    contactName: ""
  };

  const { leadFieldUpdates, reviewFlags } = mergeDossierIntoLead({ lead, dossier });

  // populated fields are left untouched
  assert.equal(leadFieldUpdates.website, undefined);
  assert.equal(leadFieldUpdates.email, undefined);
  // contactName was empty so it still fills
  assert.equal(leadFieldUpdates.contactName, "Dana Cole");
  // the differing website/email become conflict review flags
  assert.ok(reviewFlags.some((f) => f.field === "website" && f.reason === "conflict"));
  assert.ok(reviewFlags.some((f) => f.field === "email" && f.reason === "conflict"));
});

test("mergeDossierIntoLead routes low-confidence finds to reviewFlags, not updates", () => {
  const output = sampleModelOutput();
  output.webPresence.confirmedWebsite.confidence = "low";
  output.verifiedContacts.emails = [
    { value: "maybe@glow.com", type: "email", confidence: "low", sourceUrl: "https://glowmedspa.com" }
  ];
  const dossier = buildDossierFromModelOutput({ modelOutput: output });
  const lead = { businessName: "Glow Medspa", website: "", email: "" };

  const { leadFieldUpdates, reviewFlags } = mergeDossierIntoLead({ lead, dossier });

  assert.equal(leadFieldUpdates.website, undefined);
  assert.equal(leadFieldUpdates.email, undefined);
  assert.ok(reviewFlags.some((f) => f.field === "website" && f.reason === "low_confidence"));
  assert.ok(reviewFlags.some((f) => f.field === "email" && f.reason === "low_confidence"));
});

test("collectCitations dedupes and pulls web result + annotation urls", () => {
  const content = [
    { type: "server_tool_use", name: "web_search" },
    {
      type: "web_search_tool_result",
      content: [
        { type: "web_search_result", url: "https://a.com", title: "A" },
        { type: "web_search_result", url: "https://a.com", title: "A dup" }
      ]
    },
    {
      type: "text",
      text: "Found it.",
      citations: [{ url: "https://b.com", title: "B" }]
    }
  ];
  const citations = collectCitations(content);
  const urls = citations.map((c) => c.url).sort();
  assert.deepEqual(urls, ["https://a.com", "https://b.com"]);
});
