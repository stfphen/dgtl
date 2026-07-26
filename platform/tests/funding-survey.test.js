import assert from "node:assert/strict";
import test from "node:test";
import { findFundingProgram } from "../lib/funding/programDatabase.js";
import { checkRequirements, estimateFundingRange, scoreSurvey, surveyConfidence } from "../lib/funding/surveyScoring.js";
import { normalizeSurveyAnswers } from "../lib/funding/surveyNormalize.js";
import { buildSurveyResult, buildTeaserResult } from "../lib/funding/surveyResults.js";

test("estimated range is capped by max funding and cost-share", () => {
  const canexport = findFundingProgram("canexport-smes");
  const range = estimateFundingRange(canexport, { availableProjectBudget: 75000 });
  // 50% of 75000 = 37500, below the 50000 cap.
  assert.equal(range.max, 37500);
  assert.ok(range.min <= range.max);
  assert.equal(range.referenceOnly, false);
});

test("missing project budget yields a program-ceiling label, not a personalized estimate", () => {
  const dmap = findFundingProgram("ontario-dmap");
  const range = estimateFundingRange(dmap, {});
  assert.equal(range.ceilingOnly, true);
  assert.equal(range.min, null);
  assert.equal(range.max, 15000);
});

test("closed/historical programs are reference-only for ranges", () => {
  const cdap = findFundingProgram("canada-digital-adoption-program-bybt");
  const range = estimateFundingRange(cdap, { availableProjectBudget: 50000 });
  assert.equal(range.referenceOnly, true);
});

test("hard requirement failures become disqualifiers", () => {
  const canexport = findFundingProgram("canexport-smes");
  const { disqualifiers } = checkRequirements(canexport, { country: "Canada", employeeCount: 2, annualRevenue: 100000 });
  assert.ok(disqualifiers.some((d) => /employees/i.test(d)));
  assert.ok(disqualifiers.some((d) => /revenue/i.test(d)));
});

test("survey confidence never reaches high with missing requirements, and disqualifiers block it", () => {
  const program = { status: "verify_intake" };
  assert.equal(surveyConfidence({ program, baseConfidence: "high", missingRequirements: [], disqualifiers: [] }), "high");
  assert.equal(surveyConfidence({ program, baseConfidence: "high", missingRequirements: ["x"], disqualifiers: [] }), "medium");
  assert.equal(surveyConfidence({ program, baseConfidence: "high", missingRequirements: ["x", "y"], disqualifiers: [] }), "exploratory");
  assert.equal(surveyConfidence({ program, baseConfidence: "high", missingRequirements: [], disqualifiers: ["bad"] }), "not_a_fit");
  assert.equal(surveyConfidence({ program: { status: "closed" }, baseConfidence: "high", missingRequirements: [], disqualifiers: [] }), "not_a_fit");
});

test("CanExport only reaches a strong fit for eligible exporters", () => {
  const eligible = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "manufacturing_product",
    employees: 18, revenueRange: "500k_1m", availableProjectBudget: "50k_100k",
    growthGoals: ["export_marketing"], interestedInExporting: "yes"
  }).normalizedInput;
  const eligibleMatch = scoreSurvey(eligible).programMatches.find((m) => m.programId === "canexport-smes");
  assert.ok(eligibleMatch);
  assert.notEqual(eligibleMatch.confidence, "not_a_fit");

  const tooSmall = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "manufacturing_product",
    employees: 1, revenueRange: "under_100k", growthGoals: ["export_marketing"], interestedInExporting: "yes"
  }).normalizedInput;
  const smallMatch = scoreSurvey(tooSmall).programMatches.find((m) => m.programId === "canexport-smes");
  // disqualified by employees + revenue -> not_a_fit (or filtered out entirely)
  if (smallMatch) assert.equal(smallMatch.confidence, "not_a_fit");
});

test("interactive media programs require an IDM/IP project", () => {
  const idm = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "software_interactive",
    employees: 5, growthGoals: ["interactive_media"], canadianOwned: "yes"
  }).normalizedInput;
  const idmMatch = scoreSurvey(idm).programMatches.find((m) => m.programId === "ontario-creates-interactive-digital-media-ip-fund");
  assert.ok(idmMatch);
  assert.notEqual(idmMatch.confidence, "not_a_fit");

  // A plain retailer should not get a strong IDM match.
  const retailer = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "ecommerce_retail",
    employees: 4, growthGoals: ["ecommerce"]
  }).normalizedInput;
  const retailerIdm = scoreSurvey(retailer).programMatches.find((m) => m.programId === "ontario-creates-interactive-digital-media-ip-fund");
  assert.ok(!retailerIdm || retailerIdm.confidence === "not_a_fit");
});

test("teaser result hides program names and dollar figures", () => {
  const input = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "professional_services",
    employees: 6, revenueRange: "100k_500k", availableProjectBudget: "15k_50k",
    growthGoals: ["digital_adoption"]
  }).normalizedInput;
  const teaser = buildTeaserResult(input);
  const serialized = JSON.stringify(teaser);
  assert.ok(!serialized.includes("DMAP"));
  assert.ok(!/\$\d/.test(serialized));
  assert.ok(teaser.teaser);
  assert.ok(typeof teaser.qualifiedProgramCount === "number");

  const full = buildSurveyResult(input);
  assert.equal(full.disclaimer, teaser.disclaimer);
  assert.equal(full.requiresHumanReview, true);
});
