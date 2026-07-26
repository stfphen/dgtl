import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIRECTION_ID,
  DEFAULT_SECTION_ORDER,
  isValidDirectionId,
  resolveSectionOrder
} from "../lib/tenantBuilder/designDirections.js";
import {
  VERTICAL_PRESET_KEYS,
  getVerticalPreset,
  isValidVerticalPresetId,
  listVerticalPresets
} from "../lib/tenantBuilder/verticalPresets.js";
import { SECTION_VARIANTS, VARIANT_SECTION_IDS } from "../lib/tenantBuilder/sectionVariants.js";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";

test("vertical presets have unique ids and the exact closed key shape", () => {
  const presets = listVerticalPresets();
  assert.equal(presets.length, 4);

  const ids = presets.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);

  const expected = [...VERTICAL_PRESET_KEYS].sort();
  for (const preset of presets) {
    assert.deepEqual(Object.keys(preset).sort(), expected, `${preset.id} key shape`);
    assert.ok(preset.label.trim(), `${preset.id} label`);
    assert.ok(preset.blurb.trim(), `${preset.id} blurb`);
  }
});

test("every preset's directionAffinity is a ranked list of real direction ids", () => {
  for (const preset of listVerticalPresets()) {
    assert.ok(Array.isArray(preset.directionAffinity) && preset.directionAffinity.length >= 3);
    assert.equal(
      new Set(preset.directionAffinity).size,
      preset.directionAffinity.length,
      `${preset.id} affinity unique`
    );
    for (const directionId of preset.directionAffinity) {
      assert.ok(isValidDirectionId(directionId), `${preset.id} → ${directionId}`);
    }
  }
});

test("authored preset section orders are already legal — the resolver never repairs them", () => {
  for (const preset of listVerticalPresets()) {
    const resolved = resolveSectionOrder(preset.sectionOrder);
    assert.deepEqual(resolved, preset.sectionOrder, `${preset.id} order needs no repair`);
    assert.deepEqual([...resolved].sort(), [...DEFAULT_SECTION_ORDER].sort(), preset.id);
    assert.equal(resolved[0], "hero", `${preset.id} hero first`);
    assert.ok(
      resolved.indexOf("checkout") > resolved.indexOf("packages"),
      `${preset.id} checkout must follow packages`
    );
  }
});

test("preset variant prefs reference only known sections and variant ids", () => {
  for (const preset of listVerticalPresets()) {
    for (const [sectionId, variantId] of Object.entries(preset.sectionVariantPrefs)) {
      assert.ok(VARIANT_SECTION_IDS.includes(sectionId), `${preset.id} pref section ${sectionId}`);
      assert.ok(
        SECTION_VARIANTS[sectionId].ids.includes(variantId),
        `${preset.id} pref ${sectionId}: ${variantId}`
      );
    }
  }
});

test("preset generator briefs are present and scoped to real sections", () => {
  for (const preset of listVerticalPresets()) {
    assert.ok(preset.proofPattern.trim(), `${preset.id} proofPattern`);
    assert.ok(preset.imageryBrief.trim(), `${preset.id} imageryBrief`);
    const frames = Object.entries(preset.copyFrames);
    assert.ok(frames.length > 0, `${preset.id} copyFrames`);
    for (const [sectionId, frame] of frames) {
      assert.ok(DEFAULT_SECTION_ORDER.includes(sectionId), `${preset.id} frame section ${sectionId}`);
      assert.ok(typeof frame === "string" && frame.trim(), `${preset.id} frame ${sectionId}`);
    }
  }
});

test("getVerticalPreset returns null on hostile input — there is no default preset", () => {
  for (const input of [undefined, null, 42, "", "nope", {}, []]) {
    assert.equal(getVerticalPreset(input), null, JSON.stringify(input));
  }
  assert.equal(isValidVerticalPresetId("agency-creative"), true);
  assert.equal(isValidVerticalPresetId("vaporwave"), false);
});

test("untouched tenants gain no new design keys — the stored-bytes anchor", () => {
  assert.deepEqual(normalizeTenantConfig({}).design, {
    direction: DEFAULT_DIRECTION_ID,
    overrides: {}
  });
  const sanitized = sanitizeTenantConfig({ ...defaultTenant });
  assert.ok(!("verticalPreset" in sanitized.design));
  assert.ok(!("sectionVariants" in sanitized.design));
});

test("sanitize keeps a valid verticalPreset and filtered sectionVariants", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    design: {
      direction: "editorial-minimal",
      verticalPreset: "professional-services-b2b",
      sectionVariants: { packages: "comparison", references: "bogus", nav: "cards" },
      overrides: {}
    }
  });
  assert.equal(tenant.design.verticalPreset, "professional-services-b2b");
  assert.deepEqual(tenant.design.sectionVariants, { packages: "comparison" });

  const result = validateTenantConfig({
    ...defaultTenant,
    design: { direction: "editorial-minimal", verticalPreset: "professional-services-b2b" }
  });
  assert.equal(result.ok, true);
  assert.equal(result.tenant.design.verticalPreset, "professional-services-b2b");
});

test("sanitize deletes unknown presets and empty variant maps instead of defaulting them in", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    design: {
      direction: "warm-boutique",
      verticalPreset: "vaporwave",
      sectionVariants: { faq: "accordion" },
      overrides: {}
    }
  });
  assert.equal(tenant.design.direction, "warm-boutique");
  assert.ok(!("verticalPreset" in tenant.design));
  assert.ok(!("sectionVariants" in tenant.design));
});

test("design block with preset survives a normalize round trip", () => {
  const tenant = normalizeTenantConfig({
    design: {
      direction: "warm-boutique",
      verticalPreset: "local-trades-retail",
      sectionVariants: { packages: "single-offer" },
      overrides: { "--fp-radius": "24px" }
    }
  });
  assert.equal(tenant.design.verticalPreset, "local-trades-retail");
  assert.deepEqual(tenant.design.sectionVariants, { packages: "single-offer" });
  assert.deepEqual(tenant.design.overrides, { "--fp-radius": "24px" });
});
