import assert from "node:assert/strict";
import test from "node:test";
import { matchFundingProgramsForInput } from "../lib/funding/programDatabase.js";
import { normalizeSurveyAnswers } from "../lib/funding/surveyNormalize.js";
import { buildSurveyResult } from "../lib/funding/surveyResults.js";

function programsFor(answers) {
  const { normalizedInput } = normalizeSurveyAnswers(answers);
  return matchFundingProgramsForInput(normalizedInput, { limit: 10 }).map((m) => m.program.id);
}

test("sector-exclusive Agri-Food fund does not match a generic retailer", () => {
  const ids = programsFor({
    country: "Canada", province: "Ontario", businessModel: "ecommerce_retail",
    employees: 8, revenueRange: "100k_500k", growthGoals: ["digital_adoption", "ecommerce"]
  });
  assert.ok(!ids.includes("strategic-agri-food-processing-fund"));
  assert.ok(ids.includes("ontario-dmap"), "digital programs should still match a retailer");
});

test("Agri-Food fund still matches a manufacturer (industry overlap)", () => {
  const ids = programsFor({
    country: "Canada", province: "Ontario", businessModel: "manufacturing_product",
    employees: 18, revenueRange: "500k_1m", growthGoals: ["digital_adoption"]
  });
  assert.ok(ids.includes("strategic-agri-food-processing-fund"));
});

test("interactive-media programs do not match a non-IDM retailer", () => {
  const ids = programsFor({
    country: "Canada", province: "Ontario", businessModel: "ecommerce_retail",
    employees: 4, growthGoals: ["interactive_media"]
  });
  assert.ok(!ids.includes("ontario-creates-interactive-digital-media-ip-fund"));
  assert.ok(!ids.includes("cmf-innovation-experimentation"));
  assert.ok(!ids.includes("cmf-prototyping"));
});

test("interactive-media programs do match an interactive-media business", () => {
  const ids = programsFor({
    country: "Canada", province: "Ontario", businessModel: "software_interactive",
    employees: 5, growthGoals: ["interactive_media"], canadianOwned: "yes"
  });
  assert.ok(ids.includes("ontario-creates-interactive-digital-media-ip-fund"));
});

test("creative-export programs match a creative-media business but not a plain service firm", () => {
  const creative = programsFor({
    country: "Canada", province: "Ontario", businessModel: "creative_media",
    employees: 5, growthGoals: ["creative_export"], ownsCreativeIp: "yes"
  });
  assert.ok(creative.some((id) => id.startsWith("creative-export-canada")));

  const services = programsFor({
    country: "Canada", province: "Ontario", businessModel: "professional_services",
    employees: 5, growthGoals: ["digital_adoption"]
  });
  assert.ok(!services.some((id) => id.startsWith("creative-export-canada")));
});

test("overallFit is capped by weak general lane fit", () => {
  // A niche project where a specific program is high-confidence but lane fit is low.
  const { normalizedInput } = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "software_interactive",
    employees: 5, revenueRange: "100k_500k", availableProjectBudget: "50k_100k",
    growthGoals: ["interactive_media"], canadianOwned: "yes", idmStage: "prototype"
  });
  const result = buildSurveyResult(normalizedInput);
  assert.ok(result.fitScore < 50, `expected a modest lane fit, got ${result.fitScore}`);
  assert.notEqual(result.overallFit, "high", "overall fit should not read 'high' when lane fit is weak");
});

test("strong, well-aligned profile still reads high", () => {
  const { normalizedInput } = normalizeSurveyAnswers({
    country: "Canada", province: "Ontario", businessModel: "ecommerce_retail",
    employees: 8, revenueRange: "100k_500k", availableProjectBudget: "15k_50k",
    growthGoals: ["digital_adoption", "ecommerce"], directToConsumer: "yes", physicalStorefront: "yes"
  });
  const result = buildSurveyResult(normalizedInput);
  assert.equal(result.overallFit, "high");
});
