import assert from "node:assert/strict";
import test from "node:test";
import { DGTL_TOKENS, contrastRatio, resolveBrandKit } from "./brand.js";
import { TIER_PRESETS, ensureContrast, resolvePassDesign } from "./tiers.js";

const dark = resolveBrandKit({});
const light = resolveBrandKit({ passes: { brandKit: { theme: "light" } } });

test("every preset's Wallet colors are legible", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const { background, foreground, label } = preset.design.wallet;
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${preset.presetId} text`);
    assert.ok(contrastRatio(label, background) >= 3, `${preset.presetId} labels`);
  }
});

test("tier accents read as text on the dark email surface without adjustment", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const design = resolvePassDesign({ tier: preset.tier, design: preset.design }, dark);
    assert.equal(design.accentText, preset.design.accent, `${preset.presetId} should not need darkening on black`);
    assert.ok(contrastRatio(design.accentText, dark.colors.surface) >= 4.5);
    assert.deepEqual(design.warnings, []);
  }
});

test("on a light tenant theme accent text is darkened until it passes AA", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const design = resolvePassDesign({ tier: preset.tier, design: preset.design }, light);
    assert.ok(contrastRatio(design.accentText, light.colors.surface) >= 4.5, preset.presetId);
  }
});

test("VIP is the brand's own gold on black, and the only tier that is", () => {
  const vip = TIER_PRESETS.vip_lifetime;
  assert.equal(vip.design.accent, DGTL_TOKENS["--gold"]);
  assert.equal(vip.design.wallet.background, DGTL_TOKENS["--bg"]);
  assert.equal(vip.isVip, true);
  for (const preset of Object.values(TIER_PRESETS).filter((p) => p !== vip)) {
    assert.notEqual(preset.design.accent.toLowerCase(), DGTL_TOKENS["--gold"].toLowerCase(), preset.presetId);
    assert.equal(preset.isVip, false);
  }
});

test("pass-type overrides win; useBrandAccent pulls the tenant color; bad values are ignored", () => {
  const branded = resolveBrandKit({ brand: { primaryColor: "#2266ff" } });
  const onBrand = resolvePassDesign({ tier: "monthly", design: { useBrandAccent: true } }, branded);
  assert.equal(onBrand.accent, "#2266ff");
  assert.equal(onBrand.materialLabel, "", "no Bronze label on a blue pass");
  assert.equal(resolvePassDesign({ tier: "monthly", design: {} }, branded).materialLabel, "Bronze");
  assert.equal(resolvePassDesign({ tier: "monthly", design: { useBrandAccent: true, materialLabel: "Member" } }, branded).materialLabel, "Member");
  const custom = resolvePassDesign({ tier: "yearly", design: { accent: "#ff0000", wallet: { style: "storeCard", background: "nope" } } }, dark);
  assert.equal(custom.accent, "#ff0000");
  assert.equal(custom.wallet.style, "storeCard");
  assert.equal(custom.wallet.background, TIER_PRESETS.yearly.design.wallet.background);
  const bogusStyle = resolvePassDesign({ tier: "day", design: { wallet: { style: "boardingPass" } } }, dark);
  assert.equal(bogusStyle.wallet.style, "eventTicket");
});

test("unreadable Wallet overrides are flagged for the admin", () => {
  const design = resolvePassDesign({ tier: "day", design: { wallet: { background: "#777777", foreground: "#888888", label: "#7a7a7a" } } }, dark);
  assert.equal(design.warnings.length, 2);
});

test("ensureContrast leaves good pairs alone and fixes bad ones", () => {
  assert.equal(ensureContrast("#ffffff", "#000000"), "#ffffff");
  assert.ok(contrastRatio(ensureContrast("#DCE1E8", "#ffffff"), "#ffffff") >= 4.5);
});
