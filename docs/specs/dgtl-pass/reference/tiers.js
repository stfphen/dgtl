// DGTL Pass — tier presets and pass design resolution (reference implementation).
//
// The pass is a branded card system, built the way premium membership cards are:
//
//   BRAND CONSTANTS (on every pass, every tier)        TIER VARIABLES (one per pass type)
//   - the DGTL wordmark, full size                     - card face: a deep tint of the tier hue
//   - the gold spark bolt as the hero mark             - art field: the tier hue, glowing in
//   - the "DGTL PASS" lockup (logo + walletLogoText)     from the right behind the spark
//   - black-ladder typography: #F0F0F0 values,         - accent: labels, card band, chip,
//     Manrope, 0.15em labels                             spark watermark, hairline
//   - gold primary button on every email
//
// Four clearly separated hues: Steel (blue), Bronze (copper), Silver (neutral
// platinum), Gold (VIP on pure black). Faces stay dark (the brand kit's "dark
// surfaces everywhere"); colour separation comes from the hue of the face and
// field, so a Wallet stack reads blue / copper / platinum / black-and-gold at a glance.
//
// The gold spark is a *brand mark*, which the kit allows in gold on every
// surface. Gold as a tier *material* (face glow, labels, band) stays VIP-only.
//
// A preset is the starting point for a tenant's pass_types row; admins can
// override anything and the resolved values are saved on the row. For a tenant
// the brand mark is the tenant's accent, never DGTL gold.
//
// Tier colors other than gold are new brand values. Task P2.3 adds them to the
// three token files as --tier-steel-*, --tier-bronze-*, --tier-silver-*, and this
// module then mirrors them with a drift test, as brand.js mirrors the gold.
//
// Port target: platform/lib/passes/tiers.js.

import { DGTL_TOKENS, contrastRatio, ensureContrast, isHex, mix, readableForeground } from "./brand.js";

export { ensureContrast, mix };

export const TIERS = ["day", "monthly", "yearly", "vip_lifetime", "custom"];
export const WALLET_STYLES = ["eventTicket", "generic", "storeCard"];
export const EMAIL_VARIANTS = ["day", "monthly", "yearly", "vip_lifetime", "vip_onboarding"];

// accent: bright tier color (labels, band, chip, watermark)
// face:   deep tint (Wallet backgroundColor, email/pass-page card)
// field:  mid tone the strip art glows into behind the spark
export const TIER_PALETTE = Object.freeze({
  steel: { accent: "#8DB4E8", face: "#13294A", field: "#2A5A99" },
  bronze: { accent: "#E0A170", face: "#3A1F0C", field: "#9A521D" },
  silver: { accent: "#DCE1E8", face: "#2A3039", field: "#76818F" },
  gold: { accent: DGTL_TOKENS["--gold"], face: DGTL_TOKENS["--bg"], field: "#1A1403" }
});

// Back-compat: accents only.
export const TIER_MATERIALS = Object.freeze(Object.fromEntries(Object.entries(TIER_PALETTE).map(([k, v]) => [k, v.accent])));

const TEXT = DGTL_TOKENS["--text"];

function preset({ presetId, tier, name, material, validity, usage, isVip = false, style, variant }) {
  const palette = TIER_PALETTE[material.toLowerCase()];
  return {
    presetId,
    tier,
    name,
    material,
    validity,
    usage,
    isVip,
    design: {
      accent: palette.accent,
      face: palette.face,
      field: palette.field,
      wallet: { style, background: palette.face, foreground: TEXT, label: palette.accent, art: "strip" }
    },
    email: { variant }
  };
}

export const TIER_PRESETS = Object.freeze({
  day_single: preset({
    presetId: "day_single", tier: "day", name: "Single Entry", material: "Steel",
    validity: { kind: "day", count: 1 }, usage: { maxUses: 1, reentryCooldownSeconds: 0 },
    style: "eventTicket", variant: "day"
  }),
  // Re-entry all day; a 5-minute cooldown stops one pass admitting a friend.
  day: preset({
    presetId: "day", tier: "day", name: "Day Pass", material: "Steel",
    validity: { kind: "day", count: 1 }, usage: { maxUses: null, reentryCooldownSeconds: 300 },
    style: "eventTicket", variant: "day"
  }),
  // Memberships use storeCard so the strip carries the branded art (the holder
  // photo of roadmap R4 moves them to generic + thumbnail when it ships).
  monthly: preset({
    presetId: "monthly", tier: "monthly", name: "Monthly Pass", material: "Bronze",
    validity: { kind: "month", count: 1 }, usage: { maxUses: null, reentryCooldownSeconds: 300 },
    style: "storeCard", variant: "monthly"
  }),
  yearly: preset({
    presetId: "yearly", tier: "yearly", name: "Annual Pass", material: "Silver",
    validity: { kind: "year", count: 1 }, usage: { maxUses: null, reentryCooldownSeconds: 300 },
    style: "storeCard", variant: "yearly"
  }),
  // The black card: pure black face, gold everything. The brand at full strength.
  vip_lifetime: preset({
    presetId: "vip_lifetime", tier: "vip_lifetime", name: "VIP Lifetime", material: "Gold",
    validity: { kind: "lifetime" }, usage: { maxUses: null, reentryCooldownSeconds: 0 }, isVip: true,
    style: "storeCard", variant: "vip_lifetime"
  })
});

function pick(value, fallback) {
  return isHex(value) ? value.trim() : fallback;
}

const ART_FOR_STYLE = { eventTicket: "strip", storeCard: "strip", generic: "thumbnail" };

/**
 * Resolve the concrete colors for one pass type on one tenant's brand kit.
 * passType.design may override any preset value; passType.design.useBrandAccent
 * derives the whole tier palette (accent, face, field) from the tenant's brand accent.
 */
export function resolvePassDesign(passType, brandKit) {
  const base = Object.values(TIER_PRESETS).find((p) => p.tier === passType.tier) || TIER_PRESETS.day;
  const design = passType.design || {};
  const brandAccent = brandKit.colors.accent;
  const accent = design.useBrandAccent ? brandAccent : pick(design.accent, base.design.accent);
  const face = pick(design.face, design.useBrandAccent ? mix(brandAccent, "#000000", 0.86) : base.design.face);
  const field = pick(design.field, design.useBrandAccent ? mix(brandAccent, "#000000", 0.55) : base.design.field);
  const wallet = design.wallet || {};
  const walletStyle = WALLET_STYLES.includes(wallet.style) ? wallet.style : base.design.wallet.style;
  const warnings = [];

  const resolved = {
    tier: passType.tier,
    material: base.material,
    // Shown on the chip, card and Wallet header. A tenant on its own brand
    // accent has no "Bronze" to speak of, so the label drops out unless named.
    materialLabel:
      typeof design.materialLabel === "string" ? design.materialLabel.trim() : design.useBrandAccent ? "" : base.material,
    isVip: Boolean(passType.isVip),
    // Tier variables
    accent,
    face,
    field,
    // accent as text on the page surface (chips, eyebrows outside the card)
    accentText: ensureContrast(accent, brandKit.colors.surface),
    // accent as text on the card face (labels inside the card)
    accentOnFace: ensureContrast(accent, face),
    accentTint: mix(accent, brandKit.colors.surface, 0.86),
    faceLine: mix(accent, face, 0.72),
    // Brand constants
    brandMark: brandAccent,
    action: brandAccent,
    onAction: brandKit.colors.onAccent,
    onAccent: readableForeground(accent),
    wallet: {
      style: walletStyle,
      background: pick(wallet.background, face),
      foreground: pick(wallet.foreground, base.design.wallet.foreground),
      label: pick(wallet.label, accent),
      // Generated branded artwork unless the tenant uploads its own (media-library id).
      art: ART_FOR_STYLE[walletStyle],
      imageAssetId: wallet.imageAssetId || ""
    },
    warnings
  };

  if (contrastRatio(resolved.wallet.foreground, resolved.wallet.background) < 4.5) {
    warnings.push("Wallet text color is hard to read on the Wallet background (below 4.5:1).");
  }
  if (contrastRatio(resolved.wallet.label, resolved.wallet.background) < 3) {
    warnings.push("Wallet label color is hard to read on the Wallet background (below 3:1).");
  }
  if (contrastRatio(TEXT, face) < 7) {
    warnings.push("The card face is too light for white pass text; keep faces dark.");
  }
  return resolved;
}
