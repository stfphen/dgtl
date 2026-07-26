import assert from "node:assert/strict";
import test from "node:test";
import { missingFields, planFillUpdates } from "../lib/leadResearch/fillMissing.js";
import { buildDossierFromModelOutput } from "../lib/leadResearch/researchLead.js";

test("missingFields finds empty fillable fields (website via websiteUrl alias)", () => {
  const lead = {
    email: "a@b.com",
    websiteUrl: "https://acme.com", // counts as website
    phone: "",
    contactName: ""
  };
  const missing = missingFields(lead);
  assert.ok(!missing.includes("email"));
  assert.ok(!missing.includes("website"));
  assert.ok(missing.includes("phone"));
  assert.ok(missing.includes("contactName"));
});

test("planFillUpdates fills only empty fields from providers, never overwrites", () => {
  const lead = { email: "owner@acme.com", phone: "", city: "Austin" };
  const candidates = {
    email: { value: "spam@acme.com", source: "hunter" }, // lead already has email → ignored
    phone: { value: "512-555-0100", source: "google_places" }, // empty → filled
    city: { value: "Dallas", source: "google_places" } // already set → ignored
  };
  const { providerFieldUpdates, leadFieldUpdates } = planFillUpdates({ lead, candidates });
  assert.deepEqual(providerFieldUpdates, { phone: "512-555-0100" });
  assert.equal(leadFieldUpdates.email, undefined);
  assert.equal(leadFieldUpdates.city, undefined);
  assert.equal(leadFieldUpdates.phone, "512-555-0100");
});

test("planFillUpdates merges a dossier for gaps providers did not fill", () => {
  const lead = { phone: "" }; // missing phone + email + website etc.
  const candidates = { phone: { value: "512-555-0100", source: "google_places" } };
  // Dossier proposes a high-confidence, sourced email — should fill (lead has none).
  const dossier = buildDossierFromModelOutput({
    modelOutput: {
      verifiedContacts: {
        emails: [
          { value: "hello@acme.com", confidence: "high", sourceUrl: "https://acme.com/contact" }
        ],
        phones: []
      }
    }
  });
  const { leadFieldUpdates, reviewFlags } = planFillUpdates({ lead, candidates, dossier });
  assert.equal(leadFieldUpdates.phone, "512-555-0100"); // provider
  assert.equal(leadFieldUpdates.email, "hello@acme.com"); // dossier gap-fill
  assert.ok(Array.isArray(reviewFlags));
});

test("planFillUpdates does not let the dossier overwrite a provider-filled field", () => {
  const lead = { phone: "" };
  const candidates = { phone: { value: "512-555-0100", source: "google_places" } };
  // Dossier proposes a DIFFERENT phone — provider value already applied, so the
  // dossier value must be flagged as a conflict, not applied.
  const dossier = buildDossierFromModelOutput({
    modelOutput: {
      verifiedContacts: {
        emails: [],
        phones: [{ value: "512-555-9999", confidence: "high", sourceUrl: "https://acme.com" }]
      }
    }
  });
  const { leadFieldUpdates, reviewFlags } = planFillUpdates({ lead, candidates, dossier });
  assert.equal(leadFieldUpdates.phone, "512-555-0100"); // provider wins
  assert.ok(reviewFlags.some((f) => f.field === "phone" && f.reason === "conflict"));
});
