import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

// Isolate the JSON store BEFORE importing store.js (DATA_PATH is read at import time).
const STORE_PATH = path.join(os.tmpdir(), `enterprise-prospecting-test-store-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
delete process.env.DATABASE_URL;

const store = await import("../lib/store.js");
const {
  GATE_SOURCED,
  GATE1_APPROVED,
  GATE_RESEARCHED,
  GATE_SCOPED,
  GATE2_APPROVED,
  GATE_IN_OUTREACH,
  GATE_DEPRIORITIZED,
  canAdvanceGate,
  nextGate,
  isGateAtOrAfter,
  assertGateTransition,
  canFeedOutreach
} = await import("../lib/enterpriseProspecting/gates.js");
const { scoreAccountFit, recommendedGateAfterScore } = await import("../lib/enterpriseProspecting/accountFit.js");
const { buildCampaignConcept } = await import("../lib/enterpriseProspecting/campaignScope.js");
const { mockAccountSearch, mockResearchDossier } = await import("../lib/enterpriseProspecting/mockSourcing.js");
const { promotableContacts, buildLeadInputsFromAccount, assertCanFeedOutreach } = await import(
  "../lib/enterpriseProspecting/contacts.js"
);
const { previewAccounts } = await import("../lib/enterpriseProspecting/index.js");

const TEAM = "team_default";

test.after(async () => {
  await rm(STORE_PATH, { force: true });
});

// ---------------------------------------------------------------------------
// Gate state machine
// ---------------------------------------------------------------------------

test("gate machine allows only valid forward transitions", () => {
  assert.equal(canAdvanceGate(GATE_SOURCED, GATE1_APPROVED), true);
  assert.equal(canAdvanceGate(GATE1_APPROVED, GATE_RESEARCHED), true);
  assert.equal(canAdvanceGate(GATE_RESEARCHED, GATE_SCOPED), true);
  assert.equal(canAdvanceGate(GATE_SCOPED, GATE2_APPROVED), true);
  assert.equal(canAdvanceGate(GATE2_APPROVED, GATE_IN_OUTREACH), true);
  // Illegal skips
  assert.equal(canAdvanceGate(GATE_SOURCED, GATE_RESEARCHED), false);
  assert.equal(canAdvanceGate(GATE_SOURCED, GATE2_APPROVED), false);
  assert.equal(canAdvanceGate(GATE_RESEARCHED, GATE_IN_OUTREACH), false);
});

test("any gate can be deprioritized and revived", () => {
  assert.equal(canAdvanceGate(GATE_SCOPED, GATE_DEPRIORITIZED), true);
  assert.equal(canAdvanceGate(GATE_DEPRIORITIZED, GATE_SOURCED), true);
});

test("nextGate walks the happy path and stops at terminal", () => {
  assert.equal(nextGate(GATE_SOURCED), GATE1_APPROVED);
  assert.equal(nextGate(GATE2_APPROVED), GATE_IN_OUTREACH);
  assert.equal(nextGate(GATE_IN_OUTREACH), null);
});

test("isGateAtOrAfter orders the forward path", () => {
  assert.equal(isGateAtOrAfter(GATE_RESEARCHED, GATE1_APPROVED), true);
  assert.equal(isGateAtOrAfter(GATE1_APPROVED, GATE_RESEARCHED), false);
});

test("assertGateTransition throws a 409 on illegal moves", () => {
  assert.throws(() => assertGateTransition(GATE_SOURCED, GATE2_APPROVED), (err) => {
    assert.equal(err.status, 409);
    assert.equal(err.code, "INVALID_GATE_TRANSITION");
    return true;
  });
  assert.equal(assertGateTransition(GATE_SOURCED, GATE1_APPROVED), GATE1_APPROVED);
});

test("canFeedOutreach is true only at/after Gate 2", () => {
  assert.equal(canFeedOutreach(GATE_SCOPED), false);
  assert.equal(canFeedOutreach(GATE2_APPROVED), true);
  assert.equal(canFeedOutreach(GATE_IN_OUTREACH), true);
});

// ---------------------------------------------------------------------------
// Fit scoring + tiering
// ---------------------------------------------------------------------------

test("scoreAccountFit rewards in-ICP, signal-rich accounts with a high tier", () => {
  const account = {
    segment: "enterprise",
    firmographics: { headcountBand: "1,000–5,000", revenueBand: "$500M–$1B", hqGeo: "Toronto" },
    signals: [{ type: "funding" }, { type: "hiring" }, { type: "launch" }],
    buyingCommittee: [{ name: "A", roleLabel: "economic_buyer" }, { name: "B", roleLabel: "champion" }]
  };
  const fit = scoreAccountFit(account);
  assert.ok(fit.fitScore >= 80, `expected >=80, got ${fit.fitScore}`);
  assert.equal(fit.tier, 1);
  assert.equal(fit.disqualified, false);
  assert.equal(recommendedGateAfterScore(fit), "gate1_account_approval");
});

test("scoreAccountFit applies a hard ceiling for disqualifiers", () => {
  const account = {
    segment: "enterprise",
    firmographics: { headcountBand: "1,000–5,000", revenueBand: "$1B+", agencyOfRecordLocked: true },
    signals: [{ type: "funding" }, { type: "launch" }],
    buyingCommittee: [{ name: "A" }, { name: "B" }]
  };
  const fit = scoreAccountFit(account);
  assert.equal(fit.disqualified, true);
  assert.ok(fit.fitScore < 40, `disqualified account should score below tier-3 floor, got ${fit.fitScore}`);
  assert.equal(fit.tier, null);
  assert.equal(recommendedGateAfterScore(fit), "deprioritize");
});

test("out-of-ICP segment scores lower", () => {
  const fit = scoreAccountFit({ segment: "smb", firmographics: {}, signals: [], buyingCommittee: [] });
  assert.ok(fit.fitScore < 60);
});

// ---------------------------------------------------------------------------
// Campaign scoping
// ---------------------------------------------------------------------------

test("buildCampaignConcept produces a complete, segment-anchored concept", () => {
  const account = {
    name: "NorthPeak Logistics",
    segment: "enterprise",
    signals: [{ type: "funding", fact: "raised $120M" }],
    buyingCommittee: [{ name: "Marcus Lee", isPrimary: true }]
  };
  const concept = buildCampaignConcept({ account });
  assert.ok(concept.name.includes("NorthPeak"));
  assert.ok(concept.bigIdea.length > 0);
  assert.equal(concept.budgetBand, "$150k–$400k");
  assert.ok(Array.isArray(concept.deliverables) && concept.deliverables.length >= 4);
  assert.ok(concept.outreachOpener.length > 0);
  assert.equal(concept.basedOnSignal, "funding");
});

test("mid-market gets a lower budget band", () => {
  const concept = buildCampaignConcept({ account: { name: "Latitude", segment: "mid-market", signals: [] } });
  assert.equal(concept.budgetBand, "$60k–$150k");
});

// ---------------------------------------------------------------------------
// Mock sourcing + preview
// ---------------------------------------------------------------------------

test("mockAccountSearch filters by segment and query", () => {
  const all = mockAccountSearch();
  assert.ok(all.length >= 4);
  const ent = mockAccountSearch({ segment: "enterprise" });
  assert.ok(ent.every((a) => a.segment === "enterprise"));
  const byQuery = mockAccountSearch({ query: "saas" });
  assert.ok(byQuery.length >= 1);
});

test("previewAccounts attaches fit + recommended gate", () => {
  const previews = previewAccounts({ segment: "enterprise" });
  assert.ok(previews.length >= 1);
  for (const p of previews) {
    assert.equal(typeof p.fitScore, "number");
    assert.ok(["gate1_account_approval", "deprioritize"].includes(p.recommendedNextGate));
  }
});

test("mockResearchDossier flags data gaps and stays public-data-only", () => {
  const account = { name: "X", buyingCommittee: [{ name: "A", emailStatus: "pattern_unverified" }], signals: [{ type: "funding" }] };
  const dossier = mockResearchDossier(account);
  assert.equal(dossier.compliance.publicDataOnly, true);
  assert.ok(dossier.dataGaps.length >= 1);
});

// ---------------------------------------------------------------------------
// Contact promotion logic
// ---------------------------------------------------------------------------

test("promotableContacts excludes unknown-email rows", () => {
  const account = {
    buyingCommittee: [
      { name: "Has Email", email: "a@x.com", emailStatus: "verified" },
      { name: "Pattern", email: "b@x.com", emailStatus: "pattern_unverified" },
      { name: "No Email", email: "", emailStatus: "unknown" },
      { name: "", email: "c@x.com", emailStatus: "verified" } // no name -> excluded
    ]
  };
  const ok = promotableContacts(account);
  assert.equal(ok.length, 2);
});

test("buildLeadInputsFromAccount tags account linkage + verification flag", () => {
  const account = {
    id: "account_1",
    name: "Cedar & Bloom",
    domain: "cedarandbloom.com",
    segment: "mid-market",
    tier: 2,
    firmographics: { hqGeo: "Vancouver", industry: "CPG" },
    buyingCommittee: [{ name: "Sofia", email: "sofia@x.com", emailStatus: "verified", roleLabel: "champion", title: "Head of Marketing" }]
  };
  const inputs = buildLeadInputsFromAccount({ account, teamId: TEAM, campaign: { name: "Cedar: New Ground", budgetBand: "$60k–$150k" } });
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].businessName, "Cedar & Bloom");
  assert.equal(inputs[0].sourceType, "enterprise_prospect");
  assert.equal(inputs[0].metadata.accountId, "account_1");
  assert.equal(inputs[0].metadata.needsVerification, false);
  assert.equal(inputs[0].website, "https://cedarandbloom.com");
});

test("assertCanFeedOutreach blocks pre-Gate-2 accounts", () => {
  assert.throws(() => assertCanFeedOutreach({ gateStatus: GATE_SCOPED }), (err) => {
    assert.equal(err.status, 409);
    return true;
  });
  assert.doesNotThrow(() => assertCanFeedOutreach({ gateStatus: GATE2_APPROVED }));
});

// ---------------------------------------------------------------------------
// Store CRUD + end-to-end gate flow through the isolated JSON store
// ---------------------------------------------------------------------------

test("target account CRUD round-trips through the JSON store", async () => {
  const created = await store.createTargetAccount({
    teamId: TEAM,
    name: "Store Test Co",
    domain: "storetest.com",
    segment: "enterprise",
    tier: 1,
    fitScore: 85,
    firmographics: { industry: "SaaS" },
    gateStatus: GATE_SOURCED
  });
  assert.ok(created.id.startsWith("account_"));

  const fetched = await store.getTargetAccountById(created.id, { teamId: TEAM });
  assert.equal(fetched.name, "Store Test Co");
  assert.equal(fetched.firmographics.industry, "SaaS");

  const updated = await store.updateTargetAccount(created.id, { gateStatus: GATE1_APPROVED }, { teamId: TEAM });
  assert.equal(updated.gateStatus, GATE1_APPROVED);
});

test("createTargetAccount requires a team (team scoping enforced)", async () => {
  await assert.rejects(() => store.createTargetAccount({ name: "No Team Co" }));
});

test("cross-team reads are blocked", async () => {
  const created = await store.createTargetAccount({ teamId: TEAM, name: "Scoped Co", domain: "scoped.com" });
  const other = await store.getTargetAccountById(created.id, { teamId: "team_other" });
  assert.equal(other, null);
});

test("full gate flow: source -> Gate1 -> research -> scope -> Gate2 -> promote contact to lead", async () => {
  // Source an account with a verified contact so it is promotable.
  const acct = await store.createTargetAccount({
    teamId: TEAM,
    name: "Flow Co",
    domain: "flowco.com",
    segment: "enterprise",
    firmographics: { hqGeo: "Toronto", industry: "Logistics" },
    signals: [{ type: "funding" }, { type: "hiring" }],
    buyingCommittee: [{ name: "Jane Buyer", title: "VP Marketing", email: "jane@flowco.com", emailStatus: "verified", roleLabel: "economic_buyer", isPrimary: true }],
    gateStatus: GATE_SOURCED
  });

  // Gate 1
  assertGateTransition(acct.gateStatus, GATE1_APPROVED);
  await store.updateTargetAccount(acct.id, { gateStatus: GATE1_APPROVED }, { teamId: TEAM });

  // Research (offline)
  const dossier = mockResearchDossier(acct);
  await store.updateTargetAccount(acct.id, { gateStatus: GATE_RESEARCHED, dossier, dataGaps: dossier.dataGaps }, { teamId: TEAM });

  // Scope
  const concept = buildCampaignConcept({ account: acct });
  const campaign = await store.createAccountCampaign({
    teamId: TEAM,
    accountId: acct.id,
    name: concept.name,
    bigIdea: concept.bigIdea,
    deliverables: concept.deliverables,
    budgetBand: concept.budgetBand,
    status: "draft"
  });
  assert.ok(campaign.id.startsWith("campaign_"));
  await store.updateTargetAccount(acct.id, { gateStatus: GATE_SCOPED }, { teamId: TEAM });

  // Gate 2 + promote
  const scoped = await store.getTargetAccountById(acct.id, { teamId: TEAM });
  assertGateTransition(scoped.gateStatus, GATE2_APPROVED);
  const gate2 = await store.updateTargetAccount(acct.id, { gateStatus: GATE2_APPROVED }, { teamId: TEAM });
  assertCanFeedOutreach(gate2);

  const inputs = buildLeadInputsFromAccount({ account: gate2, teamId: TEAM, campaign });
  assert.equal(inputs.length, 1);
  const lead = await store.createLead(inputs[0]);
  assert.equal(lead.businessName, "Flow Co");
  assert.equal(lead.metadata.accountId, acct.id);
  assert.equal(lead.sourceType, "enterprise_prospect");

  // Account moves to in_outreach; campaign list shows it under the account.
  await store.updateTargetAccount(acct.id, { gateStatus: GATE_IN_OUTREACH }, { teamId: TEAM });
  const final = await store.getTargetAccountById(acct.id, { teamId: TEAM });
  assert.equal(final.gateStatus, GATE_IN_OUTREACH);

  const campaigns = await store.listAccountCampaigns({ teamId: TEAM, accountId: acct.id });
  assert.equal(campaigns.length, 1);

  // The promoted contact is a normal team lead now.
  const leads = await store.listLeads({ teamId: TEAM });
  assert.ok(leads.some((l) => l.metadata?.accountId === acct.id));
});
