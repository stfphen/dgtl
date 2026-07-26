import assert from "node:assert/strict";
import test from "node:test";
import {
  FUNDING_LANES,
  buildFundingOpportunityDashboard,
  buildFundingProgramLeadMatches,
  manualFundingProgramCategories,
  manualFundingPrograms,
  matchFundingPrograms,
  matchFundingProgramsForInput,
  normalizeFundingOpportunity,
  scoreFundingFit,
  validateManualFundingPrograms
} from "../lib/funding/index.js";

test("scores a sample Ontario business with stable funding fit output", () => {
  const result = scoreFundingFit({
    province: "Ontario",
    country: "Canada",
    industry: "Retail ecommerce",
    goals: ["Increase online sales", "Market expansion"],
    channels: ["Shopify", "Paid ads", "Email"],
    currentCapabilities: ["Website", "Basic CRM"],
    annualRevenue: 250000,
    employeeCount: 8,
    sellsOnline: true,
    exports: false,
    hasTrainingNeed: true,
    sellsToGovernment: false,
    usesCleanTech: false
  });

  assert.equal(result.overallFit, 54);
  assert.equal(result.bestFundingLane, "ecommerce_growth");
  assert.equal(result.recommendedOffer, "Ecommerce conversion and paid acquisition growth plan");
  assert.deepEqual(Object.keys(result.laneScores), FUNDING_LANES);
  assert.deepEqual(result.laneScores, {
    digital_adoption: 42,
    ecommerce_growth: 54,
    export_marketing: 18,
    creative_tech: 4,
    clean_tech: 4,
    workforce_training: 28,
    public_procurement: 10,
    market_expansion: 26
  });
  assert.deepEqual(result.eligibilityGaps, []);
  assert.ok(result.reasoning.includes("Ontario location: +8 to common provincial business-growth lanes"));
  assert.ok(result.reasoning.includes("Sells online: ecommerce and digital adoption signals"));
});

test("exports funding ingestion placeholder helpers from funding index", () => {
  const opportunity = normalizeFundingOpportunity({
    title: "Training Fund",
    sourceUrl: "https://example.com/training-fund"
  });

  assert.equal(opportunity.title, "Training Fund");
  assert.equal(opportunity.requiresHumanReview, true);
});

test("matches ecommerce and digital adoption opportunity categories", () => {
  const result = matchFundingPrograms({
    industry: "Retail ecommerce",
    location: "Toronto, Ontario",
    employeeCount: "8",
    revenueRange: "100k_500k",
    currentlyExporting: "no",
    interestedInExporting: "no",
    digitalNeeds: "Website analytics and digital modernization",
    ecommerceNeeds: "Shopify conversion improvements and paid ads",
    crmAutomationNeeds: "Basic customer follow-up automation",
    availableProjectBudget: "15k_50k",
    mainGrowthGoal: "Increase online sales"
  });
  const matches = result.topMatches;

  assert.equal(matches[0].id, "ecommerce-modernization");
  assert.ok(matches.slice(0, 3).some((match) => match.id === "ontario-digital-adoption-planning"));
  assert.equal(result.requiresHumanReview, true);
  assert.equal(matches[0].match.requiresHumanReview, true);
  assert.match(matches[0].match.reasons.join(" "), /E-commerce needs/);
  assert.equal(matches[0].lane, "ecommerce_growth");
  assert.ok(Array.isArray(matches[0].eligibleExpenseTypes));
});

test("matches export marketing opportunity category", () => {
  const result = matchFundingPrograms({
    industry: "Manufacturing",
    location: "Hamilton, Ontario",
    employeeCount: "12",
    revenueRange: "500k_1m",
    currentlyExporting: "no",
    interestedInExporting: "yes",
    digitalNeeds: "Website modernization for international buyers",
    ecommerceNeeds: "Dealer portal",
    crmAutomationNeeds: "Sales pipeline automation",
    availableProjectBudget: "50k_100k",
    mainGrowthGoal: "Build export marketing assets for US market entry"
  });
  const matches = result.topMatches;

  assert.equal(matches[0].id, "export-market-development");
  assert.equal(matches[0].match.label, "Potential fit");
  assert.match(matches[0].match.reasons.join(" "), /Export activity or export interest/);
  assert.match(result.recommendedNextAction, /Human review required/);
});

test("keeps weak or missing-info profile as human-review-only", () => {
  const result = matchFundingPrograms({
    industry: "",
    location: "",
    employeeCount: "",
    revenueRange: "pre_revenue",
    digitalNeeds: "",
    ecommerceNeeds: "none",
    crmAutomationNeeds: "",
    availableProjectBudget: "under_5k",
    mainGrowthGoal: ""
  });

  assert.equal(result.allMatches.length, manualFundingProgramCategories.length);
  assert.equal(result.topMatches[0].match.label, "Not enough information");
  assert.equal(result.requiresHumanReview, true);
  assert.ok(result.gaps.includes("Confirm industry."));
  assert.ok(result.gaps.includes("Clarify the main growth goal."));
  assert.match(result.recommendedNextAction, /Collect missing scan details/);
});

test("builds funding opportunity dashboard with lead matches", () => {
  const leads = [
    {
      id: "lead_export",
      tenantId: "tenant_funded_growth",
      businessName: "Ontario Growth Co",
      category: "Manufacturing",
      city: "Hamilton, Ontario",
      country: "Canada",
      notes: "Export marketing and market expansion into the US",
      sourceType: "manual",
      metadata: {}
    }
  ];

  const dashboard = buildFundingOpportunityDashboard({
    tenantId: "tenant_funded_growth",
    leads
  });
  const canexport = dashboard.find((item) => item.program.id === "canexport-smes");

  assert.ok(canexport);
  assert.ok(canexport.leadMatches.length >= 1);
  assert.equal(canexport.leadMatches[0].lead.id, "lead_export");
  assert.ok(canexport.proposalChecklist.some((item) => item.includes("Confirm intake status")));
});

test("matches leads to a single funding opportunity", () => {
  const program = manualFundingPrograms.find((item) => item.id === "ontario-dmap");
  const matches = buildFundingProgramLeadMatches(program, [
    {
      id: "lead_digital",
      businessName: "Retail Upgrade Co",
      category: "Retail",
      city: "Toronto, Ontario",
      country: "Canada",
      notes: "Needs ecommerce and digital adoption planning",
      metadata: {}
    }
  ]);

  assert.equal(matches[0].lead.id, "lead_digital");
  assert.equal(matches[0].recommendedPackageId, "fundable-project-blueprint");
  assert.match(matches[0].outreachAngle.subject, /Digital adoption/);
});

test("validates the manual funding program database", () => {
  const result = validateManualFundingPrograms();

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(manualFundingPrograms.length >= 8);
});

test("matches funding programs from fit inputs without live scraping", () => {
  const input = {
    province: "Ontario",
    country: "Canada",
    industry: "Retail ecommerce",
    goals: ["Increase online sales", "Market expansion"],
    channels: ["Shopify", "Paid ads", "Email"],
    currentCapabilities: ["Website", "Basic CRM"],
    annualRevenue: 250000,
    employeeCount: 8,
    sellsOnline: true,
    exports: false,
    hasTrainingNeed: true,
    sellsToGovernment: false,
    usesCleanTech: false
  };

  const matches = matchFundingProgramsForInput(input, { limit: 3 });

  assert.equal(matches.length, 3);
  assert.equal(matches[0].program.id, "ontario-dmap");
  assert.equal(matches[0].confidence, "high");
  assert.ok(matches[0].matchScore >= 75);
  assert.ok(matches[0].matchedSignals.some((signal) => signal.includes("Best lane match")));
  assert.ok(matches[0].reviewGaps.some((gap) => gap.includes("Verify current intake")));
});
