import assert from "node:assert/strict";
import test from "node:test";
import { COPY_LIMITS, applyCopyLimits, enforceCopyLimits } from "../lib/tenantBuilder/copyLimits.js";
import { TENANT_OUTPUT_SCHEMA, buildTenantConfigFromModelOutput } from "../lib/tenantBuilder/generateTenant.js";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";

test("applyCopyLimits injects maxLength and array bounds into the schema", () => {
  const limited = applyCopyLimits(TENANT_OUTPUT_SCHEMA);

  assert.equal(limited.properties.hero.properties.headline.maxLength, 70);
  assert.equal(limited.properties.faq.properties.items.items.properties.answer.maxLength, 300);
  assert.equal(limited.properties.problem.properties.points.items.maxLength, 90);
  assert.equal(limited.properties.problem.properties.points.minItems, 3);
  assert.equal(limited.properties.problem.properties.points.maxItems, 5);
  assert.equal(limited.properties.packages.minItems, 2);
  assert.equal(limited.properties.packages.maxItems, 4);
  assert.equal(
    limited.properties.packages.items.properties.features.items.maxLength,
    COPY_LIMITS["packages[].features[]"].max
  );

  // The source schema must stay untouched (deep clone, not mutation).
  assert.equal(TENANT_OUTPUT_SCHEMA.properties.hero.properties.headline.maxLength, undefined);
});

test("the default tenant copy is clean against the limits table", () => {
  assert.deepEqual(enforceCopyLimits(normalizeTenantConfig({})), []);
  assert.deepEqual(enforceCopyLimits(defaultTenant), []);
});

test("enforceCopyLimits reports path, count, and limit without truncating", () => {
  const longHeadline = "x".repeat(95);
  const config = normalizeTenantConfig({ hero: { headline: longHeadline } });
  const warnings = enforceCopyLimits(config);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^hero\.headline: 95 chars \(limit 70\)/);
  assert.equal(config.hero.headline, longHeadline);
});

test("enforceCopyLimits indexes array-item violations and flags oversized lists", () => {
  const config = normalizeTenantConfig({
    faq: {
      ...defaultTenant.faq,
      items: [
        { question: "Fine?", answer: "Short." },
        { question: "Too long?", answer: "y".repeat(320) }
      ]
    },
    problem: {
      ...defaultTenant.problem,
      points: ["one", "two", "three", "four", "five", "six"]
    }
  });
  const warnings = enforceCopyLimits(config);

  assert.ok(warnings.some((w) => w.startsWith("faq.items[1].answer: 320 chars (limit 300)")));
  assert.ok(warnings.some((w) => w.startsWith("problem.points: 6 items (limit 5)")));
  assert.ok(warnings.some((w) => w.startsWith("faq.items: only 2 item(s) (minimum 3)")));
});

test("buildTenantConfigFromModelOutput stamps the picked direction and surfaces copy warnings", () => {
  const modelOutput = {
    brand: { name: "Studio X" },
    hero: { headline: "h".repeat(80) },
    packages: [{ id: "core", featured: true }]
  };

  const picked = buildTenantConfigFromModelOutput({
    modelOutput,
    brandName: "Studio X",
    direction: "bold-brutalist"
  });
  assert.equal(picked.config.design.direction, "bold-brutalist");
  assert.deepEqual(picked.config.design.overrides, {});
  assert.ok(picked.warnings.some((w) => w.startsWith("hero.headline: 80 chars (limit 70)")));

  const defaulted = buildTenantConfigFromModelOutput({ modelOutput, brandName: "Studio X" });
  assert.equal(defaulted.config.design.direction, "premium-agency");
  assert.ok(!defaulted.warnings.some((w) => w.includes("Unknown design direction")));

  const unknown = buildTenantConfigFromModelOutput({
    modelOutput,
    brandName: "Studio X",
    direction: "vaporwave"
  });
  assert.equal(unknown.config.design.direction, "premium-agency");
  assert.ok(unknown.warnings.some((w) => w.includes('Unknown design direction "vaporwave"')));
});
