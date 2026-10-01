// DGTL Pass — tier presets and pass design resolution (reference implementation).
//
// The default ladder is material-coded: Steel -> Bronze -> Silver -> Gold.
//
// How it sits inside the DGTL brand kit (engine/dgtl-brand-kit):
//   - Every pass lives on the kit's black surface ladder. Wallet cards are
//     #000 / #0a0a0a / #111, never coloured panels, because "dark surfaces
//     everywhere" is a non-negotiable.
//   - The tier is carried by its *material* color: Wallet labels, the email
//     pass-card band and chip, and the spark-bolt artwork on the strip or
//     thumbnail. Gold #F0CF50 is the material of VIP only.
//   - The *action* color is the brand accent (gold for DGTL) on every tier:
//     the primary button is always gold, whatever the pass. That is the kit's
//     "one gold moment per view". Tier color never paints a button.
//
// A preset is the *starting point* for a tenant's pass_types row. Admins pick
// one in "New pass type" and can override anything; the resolved values are
// saved on the row. Nothing reads these presets at scan time.
//
// Tier accents other than gold are new brand values. When this is built, add
// them to the canonical token files as --tier-steel / --tier-bronze /
// --tier-silver (09-brand-and-tiers.md, task P2.3) and have this module mirror them
// with a drift test, the same way brand.js mirrors the gold.
//
// Port target: platform/lib/passes/tiers.js.

import { DGTL_TOKENS, contrastRatio, ensureContrast, isHex, mix, readableForeground } from "./brand.js";

export { ensureContrast, mix };

export const TIERS = ["day", "monthly", "yearly", "vip_lifetime", "custom"];
export const WALLET_STYLES = ["eventTicket", "generic", "storeCard"];
export const EMAIL_VARIANTS = ["day", "monthly", "yearly", "vip_lifetime", "vip_onboarding"];

// Tier materials. Each passes 4.5:1 as text on every surface of the black ladder.
export const TIER_MATERIALS = Object.freeze({
  steel: "#A9B4C2",
  bronze: "#D29666",
  silver: "#DCE1E8",
  gold: DGTL_TOKENS["--gold"]
});

const TEXT = DGTL_TOKENS["--text"];

export const TIER_PRESETS = Object.freeze({
  day_single: {
    presetId: "day_single",
    tier: "day",
    name: "Single Entry",
    material: "Steel",
    validity: { kind: "day", count: 1 },
    usage: { maxUses: 1, reentryCooldownSeconds: 0 },
    isVip: false,
    design: {
      accent: TIER_MATERIALS.steel,
      // eventTicket strip: black, a steel spark watermark, a steel hairline.
      wallet: { style: "eventTicket", background: DGTL_TOKENS["--surface-2"], foreground: TEXT, label: TIER_MATERIALS.steel, art: "strip" }
    },
    email: { variant: "day" }
  },
  day: {
    presetId: "day",
    tier: "day",
    name: "Day Pass",
    material: "Steel",
    validity: { kind: "day", count: 1 },
    // Re-entry all day; a 5-minute cooldown stops one pass admitting a friend.
    usage: { maxUses: null, reentryCooldownSeconds: 300 },
    isVip: false,
    design: {
      accent: TIER_MATERIALS.steel,
      wallet: { style: "eventTicket", background: DGTL_TOKENS["--surface-2"], foreground: TEXT, label: TIER_MATERIALS.steel, art: "strip" }
    },
    email: { variant: "day" }
  },
  monthly: {
    presetId: "monthly",
    tier: "monthly",
    name: "Monthly Pass",
    material: "Bronze",
    validity: { kind: "month", count: 1 },
    usage: { maxUses: null, reentryCooldownSeconds: 300 },
    isVip: false,
    design: {
      accent: TIER_MATERIALS.bronze,
      // generic thumbnail: a bronze spark on black (later: the holder photo, roadmap R4).
      wallet: { style: "generic", background: DGTL_TOKENS["--surface-1"], foreground: TEXT, label: TIER_MATERIALS.bronze, art: "thumbnail" }
    },
    email: { variant: "monthly" }
  },
  yearly: {
    presetId: "yearly",
    tier: "yearly",
    name: "Annual Pass",
    material: "Silver",
    validity: { kind: "year", count: 1 },
    usage: { maxUses: null, reentryCooldownSeconds: 300 },
    isVip: false,
    design: {
      accent: TIER_MATERIALS.silver,
      wallet: { style: "generic", background: DGTL_TOKENS["--surface-1"], foreground: TEXT, label: TIER_MATERIALS.silver, art: "thumbnail" }
    },
    email: { variant: "yearly" }
  },
  vip_lifetime: {
    presetId: "vip_lifetime",
    tier: "vip_lifetime",
    name: "VIP Lifetime",
    material: "Gold",
    validity: { kind: "lifetime" },
    usage: { maxUses: null, reentryCooldownSeconds: 0 },
    isVip: true,
    design: {
      accent: TIER_MATERIALS.gold,
      // The black card: pure black, gold labels, a gold spark strip. The brand at full strength.
      wallet: { style: "storeCard", background: DGTL_TOKENS["--bg"], foreground: TEXT, label: TIER_MATERIALS.gold, art: "strip" }
    },
    email: { variant: "vip_lifetime" }
  }
});

function pick(value, fallback) {
  return isHex(value) ? value.trim() : fallback;
}

const ART_FOR_STYLE = { eventTicket: "strip", storeCard: "strip", generic: "thumbnail" };

/**
 * Resolve the concrete colors for one pass type on one tenant's brand kit.
 * passType.design may override any preset value; passType.design.useBrandAccent
 * swaps the tier material for the tenant's brand accent.
 */
export function resolvePassDesign(passType, brandKit) {
  const preset = Object.values(TIER_PRESETS).find((p) => p.tier === passType.tier) || TIER_PRESETS.day;
  const design = passType.design || {};
  const accent = design.useBrandAccent ? brandKit.colors.accent : pick(design.accent, preset.design.accent);
  const wallet = design.wallet || {};
  const walletStyle = WALLET_STYLES.includes(wallet.style) ? wallet.style : preset.design.wallet.style;
  const surface = brandKit.colors.surface;
  const warnings = [];

  const resolved = {
    tier: passType.tier,
    material: preset.material,
    // Shown on the email chip, card and Wallet header. A tenant on its own
    // brand accent has no "Bronze" to speak of, so the label drops out unless
    // the pass type names one.
    materialLabel:
      typeof design.materialLabel === "string" ? design.materialLabel.trim() : design.useBrandAccent ? "" : preset.material,
    isVip: Boolean(passType.isVip),
    // Tier material: card band, chip, labels, Wallet art.
    accent,
    accentText: ensureContrast(accent, surface),
    // Pre-mixed tint for the tier chip (the kit's tint-pill, solid for email).
    accentTint: mix(accent, surface, 0.88),
    // Action color: the brand accent, identical on every tier.
    action: brandKit.colors.accent,
    onAction: brandKit.colors.onAccent,
    onAccent: readableForeground(accent),
    wallet: {
      style: walletStyle,
      background: pick(wallet.background, preset.design.wallet.background),
      foreground: pick(wallet.foreground, preset.design.wallet.foreground),
      label: design.useBrandAccent && !wallet.label ? accent : pick(wallet.label, preset.design.wallet.label),
      // Generated spark artwork unless the tenant uploads its own (media-library id).
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
  return resolved;
}
