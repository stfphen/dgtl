import assert from "node:assert/strict";
import test from "node:test";
import {
  FUNDING_REVIEW_ITEMS,
  buildCloserHandoff,
  buildReviewPatch,
  buildReviewState,
  isReviewComplete
} from "../lib/funding/index.js";
import { buildFundingMergeFields, renderOutreachTemplate, defaultOutreachTemplates } from "../lib/outreachSequence.js";

const strongLead = {
  id: "lead_export",
  tenantId: "tenant_funded_growth",
  businessName: "Steel Ridge Manufacturing",
  city: "Hamilton",
  region: "Ontario",
  country: "Canada",
  category: "Manufacturing",
  sourceType: "funding_scan",
  sourceMetadata: {
    fundingScan: {
      industry: "Manufacturing",
      location: "Hamilton, Ontario",
      revenueRange: "500k_1m",
      employeeCount: "18",
      interestedInExporting: "yes",
      availableProjectBudget: "50k_100k",
      mainGrowthGoal: "Build export marketing assets for US market entry"
    }
  }
};

const nonFundingLead = {
  id: "lead_plain",
  businessName: "Plain Co",
  sourceType: "manual",
  metadata: {}
};

test("review checklist requires all required items to complete", () => {
  const empty = buildReviewState(strongLead);
  assert.equal(empty.isComplete, false);
  assert.equal(empty.status, "pending");

  const requiredIds = FUNDING_REVIEW_ITEMS.filter((item) => item.required).map((item) => item.id);
  assert.equal(isReviewComplete({ items: {} }), false);
  const partial = Object.fromEntries(requiredIds.slice(0, -1).map((id) => [id, true]));
  assert.equal(isReviewComplete({ items: partial }), false);
  const all = Object.fromEntries(requiredIds.map((id) => [id, true]));
  assert.equal(isReviewComplete({ items: all }), true);
});

test("buildReviewState reflects a stored review patch", () => {
  const requiredIds = FUNDING_REVIEW_ITEMS.filter((item) => item.required).map((item) => item.id);
  const patch = buildReviewPatch({ checkedItemIds: requiredIds, reviewer: "Dana", updatedAt: "2026-06-18T00:00:00.000Z" });
  const lead = { ...strongLead, sourceMetadata: { ...strongLead.sourceMetadata, ...patch } };
  const state = buildReviewState(lead);
  assert.equal(state.isComplete, true);
  assert.equal(state.status, "complete");
  assert.equal(state.reviewer, "Dana");
});

test("closer handoff assembles standalone summary and flags incomplete review", () => {
  const handoff = buildCloserHandoff(strongLead);
  assert.equal(handoff.business, "Steel Ridge Manufacturing");
  assert.ok(handoff.topLane);
  assert.ok(handoff.overallFit >= 0);
  assert.equal(handoff.requiresHumanReview, true);
  assert.equal(handoff.reviewIncomplete, true);
  assert.ok(handoff.nextStep.length > 0);
  // Bug 2 regression: the next step must be program-specific, not the generic fallback.
  assert.notEqual(
    handoff.nextStep,
    "Confirm the project scope, budget, and owner, then route to the right DGTL package."
  );
  assert.ok(handoff.topProgram, "a top program should be matched for the strong export lead");
});

test("funding merge fields only populate for funding-scan leads", () => {
  const funding = buildFundingMergeFields(strongLead);
  assert.ok(funding.fundingLane);
  assert.notEqual(funding.fundingLane, "");

  const plain = buildFundingMergeFields(nonFundingLead);
  assert.equal(plain.fundingLane, "");
  assert.equal(plain.fundingProgram, "");
});

test("funding outreach template renders with funding context", () => {
  const template = defaultOutreachTemplates.find((item) => item.id === "template_funding_fit_summary");
  assert.ok(template);
  const rendered = renderOutreachTemplate(template, { lead: strongLead, tenant: {}, senderName: "DGTL" });
  assert.match(rendered.subject, /Steel Ridge Manufacturing/);
  assert.match(rendered.body, /Best-fit lane:/);
  assert.ok(!rendered.body.includes("{{"));
});
