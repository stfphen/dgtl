import assert from "node:assert/strict";
import test from "node:test";
import { FUNDING_SURVEY_QUESTIONS, getVisibleQuestions } from "../lib/funding/surveyQuestions.js";

function ids(answers, opts) {
  return getVisibleQuestions(answers, opts).map((q) => q.id);
}

test("province question only shows for Canada", () => {
  assert.ok(ids({ country: "Canada" }).includes("province"));
  assert.ok(!ids({ country: "United States" }).includes("province"));
  assert.ok(!ids({ country: "Other" }).includes("province"));
});

test("export branch only shows for Canadian export goals", () => {
  const exporter = { country: "Canada", province: "Ontario", growthGoals: ["export_marketing"] };
  assert.ok(ids(exporter).includes("interestedInExporting"));
  const local = { country: "Canada", province: "Ontario", growthGoals: ["ecommerce"] };
  assert.ok(!ids(local).includes("interestedInExporting"));
});

test("export market follow-up only shows after confirming export interest", () => {
  const base = { country: "Canada", province: "Ontario", growthGoals: ["export_marketing"] };
  assert.ok(!ids(base).includes("exportMarkets"));
  assert.ok(ids({ ...base, interestedInExporting: "yes" }).includes("exportMarkets"));
});

test("interactive media branch only shows for IDM business/goals", () => {
  const idm = { businessModel: "software_interactive" };
  assert.ok(ids(idm).includes("canadianOwned"));
  assert.ok(ids(idm).includes("idmStage"));
  const retailer = { businessModel: "ecommerce_retail", growthGoals: ["ecommerce"] };
  assert.ok(!ids(retailer).includes("idmStage"));
});

test("creative IP branch shows for creative model/goals", () => {
  assert.ok(ids({ businessModel: "creative_media" }).includes("ownsCreativeIp"));
  assert.ok(ids({ growthGoals: ["creative_export"] }).includes("ownsCreativeIp"));
  assert.ok(!ids({ businessModel: "professional_services", growthGoals: ["digital_adoption"] }).includes("ownsCreativeIp"));
});

test("retail DMAP branch shows the completed-DMAP question for Ontario digital goals", () => {
  const ontDigital = { country: "Canada", province: "Ontario", growthGoals: ["digital_adoption"] };
  assert.ok(ids(ontDigital).includes("completedDmap"));
  const bcDigital = { country: "Canada", province: "British Columbia", growthGoals: ["digital_adoption"] };
  assert.ok(!ids(bcDigital).includes("completedDmap"));
});

test("contact questions are excluded from the scored flow and required for unlock", () => {
  const scored = ids({ country: "Canada", province: "Ontario" }, { includeContact: false });
  for (const c of ["businessName", "name", "email", "phone"]) assert.ok(!scored.includes(c));

  const contact = FUNDING_SURVEY_QUESTIONS.filter((q) => q.group === "contact");
  assert.deepEqual(contact.map((q) => q.id), ["businessName", "name", "email", "phone"]);
  assert.ok(contact.find((q) => q.id === "email").required);
});

test("most users see a manageable number of questions", () => {
  const typical = {
    country: "Canada", province: "Ontario", businessModel: "ecommerce_retail",
    growthGoals: ["digital_adoption", "ecommerce"]
  };
  const count = getVisibleQuestions(typical, { includeContact: false }).length;
  assert.ok(count <= 12, `expected <= 12 scored questions, got ${count}`);
});
