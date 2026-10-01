// DGTL Pass — tier presets and pass design resolution (reference implementation).
//
// The default ladder is material-coded: Steel -> Bronze -> Silver -> Gold. Gold
// is the brand's own #F0CF50 and is reserved for VIP, so the signature color is
// something you earn rather than something every day pass wears. See
// 09-brand-and-tiers.md for the creative rationale.
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

import { DGTL_TOKENS, contrastRatio, hexToRgb, isHex, readableForeground } from "./brand.js";

export const TIERS = ["day", "monthly", "yearly", "vip_lifetime", "custom"];
export const WALLET_STYLES = ["eventTicket", "generic", "storeCard"];
export const EMAIL_VARIANTS = ["day", "monthly", "yearly", "vip_lifetime", "vip_onboarding"];

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
      accent: "#A9B4C2",
      wallet: { style: "eventTicket", background: "#16191E", foreground: "#F0F0F0", label: "#A9B4C2" }
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
      accent: "#A9B4C2",
      wallet: { style: "eventTicket", background: "#16191E", foreground: "#F0F0F0", label: "#A9B4C2" }
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
      accent: "#D29666",
      wallet: { style: "generic", background: "#7A4B2A", foreground: "#FFF4EA", label: "#F2C9A5" }
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
      accent: "#DCE1E8",
      wallet: { style: "generic", background: "#C7CDD4", foreground: "#111418", label: "#4A525C" }
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
      accent: DGTL_TOKENS["--gold"],
      // The black card: gold labels on pure black, the brand at full strength.
      wallet: { style: "storeCard", background: DGTL_TOKENS["--bg"], foreground: DGTL_TOKENS["--text"], label: DGTL_TOKENS["--gold"] }
    },
    email: { variant: "vip_lifetime" }
  }
});

export function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const part = (x, y) => Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
  return `#${part(a.r, b.r)}${part(a.g, b.g)}${part(a.b, b.b)}`;
}

// Nudge `fg` toward black or white until it reads on `bg` at `min`:1. Used
// for accent-colored *text*. A light tenant theme would otherwise turn a
// Steel eyebrow into grey-on-white.
export function ensureContrast(fg, bg, min = 4.5) {
  if (contrastRatio(fg, bg) >= min) return fg;
  const toward = contrastRatio("#000000", bg) > contrastRatio("#ffffff", bg) ? "#000000" : "#ffffff";
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(fg, toward, step / 20);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return toward;
}

function pick(value, fallback) {
  return isHex(value) ? value.trim() : fallback;
}

/**
 * Resolve the concrete colors for one pass type on one tenant's brand kit.
 * passType.design may override any preset value; passType.design.useBrandAccent
 * swaps the tier accent for the tenant's brand accent.
 */
export function resolvePassDesign(passType, brandKit) {
  const preset = Object.values(TIER_PRESETS).find((p) => p.tier === passType.tier) || TIER_PRESETS.day;
  const design = passType.design || {};
  const accent = design.useBrandAccent ? brandKit.colors.accent : pick(design.accent, preset.design.accent);
  const wallet = design.wallet || {};
  const walletStyle = WALLET_STYLES.includes(wallet.style) ? wallet.style : preset.design.wallet.style;
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
    accent,
    onAccent: readableForeground(accent),
    accentText: ensureContrast(accent, brandKit.colors.surface),
    wallet: {
      style: walletStyle,
      background: pick(wallet.background, preset.design.wallet.background),
      foreground: pick(wallet.foreground, preset.design.wallet.foreground),
      label: pick(wallet.label, preset.design.wallet.label),
      // Media-library asset id for the strip / thumbnail image (optional).
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
