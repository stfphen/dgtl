import assert from "node:assert/strict";
import test from "node:test";
import { DGTL_TOKENS, contrastRatio, resolveBrandKit } from "./brand.js";
import { TIER_PALETTE, TIER_PRESETS, ensureContrast, resolvePassDesign } from "./tiers.js";

const dark = resolveBrandKit({});
const light = resolveBrandKit({ passes: { brandKit: { theme: "light" } } });

test("every preset's Wallet colors are legible", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const { background, foreground, label } = preset.design.wallet;
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${preset.presetId} text`);
    assert.ok(contrastRatio(label, background) >= 3, `${preset.presetId} labels`);
  }
});

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test("card faces stay dark: white pass text reads at 7:1 or better on every tier", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const { face, wallet } = preset.design;
    assert.ok(contrastRatio(DGTL_TOKENS["--text"], face) >= 7, `${preset.presetId} face is too light`);
    assert.equal(wallet.background, face, "Wallet background is the card face");
    assert.equal(wallet.foreground, DGTL_TOKENS["--text"]);
    assert.equal(wallet.label, preset.design.accent, "tier accent carries the labels");
  }
});

test("the four tiers are clearly separated by color (faces and accents)", () => {
  const tiers = ["steel", "bronze", "silver", "gold"].map((k) => TIER_PALETTE[k]);
  for (let i = 0; i < tiers.length; i += 1) {
    for (let j = i + 1; j < tiers.length; j += 1) {
      assert.ok(distance(tiers[i].face, tiers[j].face) >= 25, `faces ${i}/${j} too close`);
      assert.ok(distance(tiers[i].accent, tiers[j].accent) >= 50, `accents ${i}/${j} too close`);
    }
  }
  assert.equal(TIER_PALETTE.gold.face, DGTL_TOKENS["--bg"], "VIP is the black card");
});

test("brand constants: every tier's brand mark is the DGTL gold, whatever its color", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    assert.equal(resolvePassDesign({ tier: preset.tier, design: preset.design }, dark).brandMark, DGTL_TOKENS["--gold"], preset.presetId);
  }
  const tenant = resolveBrandKit({ brand: { primaryColor: "#2266ff" } });
  assert.equal(resolvePassDesign({ tier: "monthly", design: TIER_PRESETS.monthly.design }, tenant).brandMark, "#2266ff", "a tenant's mark is its own color");
});

test("the action color is the brand accent on every tier; tier color never paints a button", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const design = resolvePassDesign({ tier: preset.tier, design: preset.design }, dark);
    assert.equal(design.action, DGTL_TOKENS["--gold"], preset.presetId);
    assert.equal(design.onAction, "#050505");
    assert.match(design.accentTint, /^#[0-9a-f]{6}$/);
  }
});

test("tier accents read as text on the email surface and on their own card face", () => {
  for (const preset of Object.values(TIER_PRESETS)) {
    const design = resolvePassDesign({ tier: preset.tier, design: preset.design }, dark);
    assert.equal(design.accentText, preset.design.accent, `${preset.presetId} should not need darkening on black`);
    assert.equal(design.accentOnFace, preset.design.accent, `${preset.presetId} labels should read on the face unadjusted`);
    assert.ok(contrastRatio(design.accentOnFace, design.face) >= 4.5);
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
