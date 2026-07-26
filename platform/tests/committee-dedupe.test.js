import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipReliableDuplicate, normalizeLeadInput } from "../lib/leadUtils.js";

// Regression: a buying committee shares businessName + website (both derived from
// the account), differing only by contact/email. They must NOT collapse into one
// lead via the company-level "domain + business" / "website" dedupe signals.
test("distinct committee members at one company are not reliable duplicates", () => {
  const existing = [
    normalizeLeadInput({
      id: "lead_1",
      businessName: "Acme Corp",
      website: "https://acme.example",
      contactName: "Alice CFO",
      email: "alice@acme.example",
      sourceType: "enterprise_prospect"
    })
  ];

  const secondMember = normalizeLeadInput({
    id: "lead_2",
    businessName: "Acme Corp",
    website: "https://acme.example",
    contactName: "Bob CTO",
    email: "bob@acme.example",
    sourceType: "enterprise_prospect"
  });

  assert.equal(
    shouldSkipReliableDuplicate(secondMember, existing),
    undefined,
    "a second decision-maker with a different email must be created, not deduped"
  );
});

test("the same email is still treated as a reliable duplicate", () => {
  const existing = [
    normalizeLeadInput({ id: "lead_1", businessName: "Acme Corp", website: "https://acme.example", email: "alice@acme.example" })
  ];
  const sameEmail = normalizeLeadInput({ id: "lead_2", businessName: "Acme Corp", website: "https://acme.example", email: "alice@acme.example" });
  assert.ok(shouldSkipReliableDuplicate(sameEmail, existing), "same email => duplicate");
});

test("shared company signals still dedupe when neither record has an email", () => {
  const existing = [normalizeLeadInput({ id: "lead_1", businessName: "Acme Corp", website: "https://acme.example" })];
  const noEmail = normalizeLeadInput({ id: "lead_2", businessName: "Acme Corp", website: "https://acme.example" });
  assert.ok(shouldSkipReliableDuplicate(noEmail, existing), "no-email company dupes still collapse (unchanged behavior)");
});

test("phone match remains a reliable duplicate regardless of email", () => {
  const existing = [normalizeLeadInput({ id: "lead_1", businessName: "A Co", phone: "+14155550100", email: "a@a.test" })];
  const samePhone = normalizeLeadInput({ id: "lead_2", businessName: "B Co", phone: "+14155550100", email: "b@b.test" });
  assert.ok(shouldSkipReliableDuplicate(samePhone, existing), "same phone => duplicate");
});
