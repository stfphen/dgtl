import assert from "node:assert/strict";
import test from "node:test";
import { parseJurisdiction } from "../lib/funding/normalizeLocation.js";
import { normalizeSurveyAnswers } from "../lib/funding/surveyNormalize.js";
import { buildSurveyResult } from "../lib/funding/surveyResults.js";

test("foreign and unknown locations never default to Canada", () => {
  for (const loc of ["Berlin, Germany", "London, UK", "Paris, France", "Madrid, Spain", ""]) {
    const j = parseJurisdiction(loc);
    assert.notEqual(j.country, "Canada", `${loc} should not be Canada`);
    assert.equal(j.province, null, `${loc} should have no province`);
  }
});

test("explicit Canadian locations resolve correctly", () => {
  assert.deepEqual(parseJurisdiction("Toronto, ON"), { country: "Canada", province: "Ontario", confidence: "high" });
  assert.deepEqual(parseJurisdiction("Toronto, Ontario, Canada"), { country: "Canada", province: "Ontario", confidence: "high" });
  assert.deepEqual(parseJurisdiction("Vancouver, BC"), { country: "Canada", province: "British Columbia", confidence: "high" });
  assert.equal(parseJurisdiction("Canada").country, "Canada");
  assert.equal(parseJurisdiction("Canada").province, null);
});

test("US locations resolve to United States, not Canada", () => {
  const j = parseJurisdiction("New York, USA");
  assert.equal(j.country, "United States");
  assert.equal(j.province, null);
});

test("explicit country + text province keeps the province", () => {
  const j = parseJurisdiction("Toronto, Ontario", { country: "Canada" });
  assert.equal(j.country, "Canada");
  assert.equal(j.province, "Ontario");
});

test("an explicit foreign country is treated as not-Canada even with a Canadian-looking city", () => {
  const j = parseJurisdiction("London", { country: "Germany" });
  assert.equal(j.country, null);
  assert.equal(j.province, null);
});

test("a foreign survey produces no Canadian program matches (Bug 1 regression)", () => {
  const { normalizedInput } = normalizeSurveyAnswers({
    country: "Other",
    city: "Berlin",
    businessModel: "ecommerce_retail",
    employees: 8,
    revenueRange: "100k_500k",
    growthGoals: ["ecommerce"]
  });
  assert.equal(normalizedInput.country, "");
  const result = buildSurveyResult(normalizedInput);
  assert.equal(result.topProgramMatches.length, 0);
  assert.equal(result.overallFit, "not_enough_information");
});

test("an Ontario survey resolves jurisdiction and matches programs", () => {
  const { normalizedInput } = normalizeSurveyAnswers({
    country: "Canada",
    province: "Ontario",
    city: "Toronto",
    businessModel: "ecommerce_retail",
    employees: 8,
    revenueRange: "100k_500k",
    availableProjectBudget: "15k_50k",
    growthGoals: ["digital_adoption", "ecommerce"]
  });
  assert.equal(normalizedInput.country, "Canada");
  assert.equal(normalizedInput.province, "Ontario");
  const result = buildSurveyResult(normalizedInput);
  assert.ok(result.topProgramMatches.length >= 1);
});
