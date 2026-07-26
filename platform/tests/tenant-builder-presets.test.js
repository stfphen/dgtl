import assert from "node:assert/strict";
import test from "node:test";
import { buildTenantConfigFromModelOutput } from "../lib/tenantBuilder/generateTenant.js";
import { applyManualPatch } from "../lib/tenantBuilder/editTenant.js";
import { resolveDesign } from "../lib/tenantBuilder/designDirections.js";
import { listVerticalPresets } from "../lib/tenantBuilder/verticalPresets.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";
import { defaultTenant } from "../lib/defaultTenant.js";

// Minimal-but-valid model output, the shape the generator's structured output
// produces. One mock brief result reused across verticals; the preset itself
// is operator input, never model output.
function mockModelOutput(name) {
  return {
    brand: {
      name,
      eyebrow: `${name} services`,
      logoText: name,
      tagline: "Demo tagline",
      primaryColor: "#0f4c81",
      accentColor: "#050505"
    },
    hero: {
      headline: "A working headline",
      subheadline: "A working subheadline under twenty words.",
      primaryCta: "Get started",
      secondaryCta: "See packages",
      stats: [{ value: "12", label: "years" }]
    },
    problem: { eyebrow: "", headline: "The problem", points: ["Point one", "Point two", "Point three"] },
    system: {
      eyebrow: "",
      headline: "The system",
      body: "How it works.",
      features: [
        { title: "One", body: "First." },
        { title: "Two", body: "Second." },
        { title: "Three", body: "Third." }
      ]
    },
    process: {
      eyebrow: "",
      headline: "The process",
      steps: [
        { title: "Start", body: "We start." },
        { title: "Build", body: "We build." },
        { title: "Ship", body: "We ship." }
      ]
    },
    output: { eyebrow: "", headline: "The output", body: "What you get.", tiles: ["A", "B", "C"] },
    packageSection: { eyebrow: "Packages", headline: "Pick a package", body: "Three options." },
    packages: [
      {
        id: "starter",
        name: "Starter",
        summary: "The starter option.",
        price: "$1,000",
        priceQualifier: "one time",
        priceDisplay: "$1,000",
        action: "capture",
        cta: "Choose starter",
        featured: false,
        description: "Starter package.",
        features: ["Thing one", "Thing two"]
      },
      {
        id: "growth",
        name: "Growth",
        summary: "The growth option.",
        price: "$2,500",
        priceQualifier: "per month",
        priceDisplay: "$2,500/mo",
        action: "capture",
        cta: "Choose growth",
        featured: true,
        description: "Growth package.",
        features: ["Thing one", "Thing two", "Thing three"]
      }
    ],
    enterprise: { eyebrow: "", headline: "Bigger scope?", body: "Talk to us.", cta: "Talk to us" },
    faq: {
      eyebrow: "",
      headline: "Questions",
      items: [
        { question: "How long?", answer: "Four weeks." },
        { question: "Who owns it?", answer: "You do." },
        { question: "What about support?", answer: "Thirty days included." }
      ]
    },
    finalCta: { eyebrow: "", headline: "Ready?", body: "Start today.", cta: "Get started" },
    mobileCta: { primary: "Get started", secondary: "See packages" }
  };
}

test("every vertical × affinity direction produces a valid, preset-aware config", () => {
  for (const preset of listVerticalPresets()) {
    for (const direction of preset.directionAffinity) {
      const { config, valid, warnings } = buildTenantConfigFromModelOutput({
        modelOutput: mockModelOutput(`Mock ${preset.id}`),
        brandName: `Mock ${preset.id}`,
        direction,
        verticalPreset: preset.id
      });
      assert.equal(valid, true, `${preset.id} × ${direction}: ${JSON.stringify(warnings)}`);
      assert.equal(config.design.direction, direction);
      assert.equal(config.design.verticalPreset, preset.id);

      const resolved = resolveDesign(config.design);
      assert.equal(resolved.verticalPresetId, preset.id);
      assert.deepEqual(resolved.sectionOrder, preset.sectionOrder, `${preset.id} order flows through`);
      for (const [sectionId, variantId] of Object.entries(preset.sectionVariantPrefs)) {
        assert.equal(resolved.sectionVariants[sectionId], variantId, `${preset.id} pref ${sectionId}`);
      }

      // The generated config must also survive the save-time sanitize path.
      const sanitized = sanitizeTenantConfig(config);
      assert.equal(sanitized.design.verticalPreset, preset.id);
      assert.equal(validateTenantConfig(config).ok, true);
    }
  }
});

test("no preset means a design block byte-identical to pre-preset generation", () => {
  const { config } = buildTenantConfigFromModelOutput({
    modelOutput: mockModelOutput("Plain"),
    brandName: "Plain",
    direction: "premium-agency"
  });
  assert.deepEqual(config.design, { direction: "premium-agency", overrides: {} });
});

test("generated drafts never inherit the default tenant's enabled funding promo", () => {
  const { config } = buildTenantConfigFromModelOutput({
    modelOutput: mockModelOutput("NoPromo"),
    brandName: "NoPromo",
    direction: "premium-agency"
  });
  assert.equal(config.fundingPromo.enabled, false);
});

test("rationed eyebrows are cleared deterministically with a warning", () => {
  const output = mockModelOutput("Eyebrowy");
  output.problem = { ...output.problem, eyebrow: "The problem" };
  output.faq = { ...output.faq, eyebrow: "Questions" };
  const { config, warnings } = buildTenantConfigFromModelOutput({
    modelOutput: output,
    brandName: "Eyebrowy",
    direction: "premium-agency"
  });
  assert.equal(config.problem.eyebrow, "");
  assert.equal(config.faq.eyebrow, "");
  // Hero (brand) and packages keep theirs.
  assert.ok(config.brand.eyebrow);
  assert.ok(config.packageSection.eyebrow);
  assert.ok(warnings.some((warning) => warning.startsWith("Eyebrow rationing: cleared problem, faq")));
});

test("unknown preset warns and is omitted, never coerced", () => {
  const { config, warnings } = buildTenantConfigFromModelOutput({
    modelOutput: mockModelOutput("Oops"),
    brandName: "Oops",
    direction: "premium-agency",
    verticalPreset: "vaporwave"
  });
  assert.ok(!("verticalPreset" in config.design));
  assert.ok(warnings.some((warning) => warning.includes('Unknown vertical preset "vaporwave"')));
});

test("manual patch can set and keep verticalPreset and sectionVariants", () => {
  const base = { ...defaultTenant, design: { direction: "warm-boutique", overrides: {} } };
  const { config } = applyManualPatch(base, {
    design: { verticalPreset: "local-trades-retail", sectionVariants: { packages: "single-offer" } }
  });
  assert.equal(config.design.verticalPreset, "local-trades-retail");
  assert.deepEqual(config.design.sectionVariants, { packages: "single-offer" });
  assert.equal(config.design.direction, "warm-boutique");

  // A later direction-only patch (the TenantEditor picker) must not drop them.
  const { config: repatched } = applyManualPatch(config, {
    design: { direction: "bold-brutalist" }
  });
  assert.equal(repatched.design.direction, "bold-brutalist");
  assert.equal(repatched.design.verticalPreset, "local-trades-retail");
  assert.deepEqual(repatched.design.sectionVariants, { packages: "single-offer" });
});
