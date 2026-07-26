/**
 * Design directions — named, machine-readable token specs that restyle the
 * tenant funnel without forking the page template.
 *
 * Each direction is pure data: a set of `--fp-*` CSS custom properties
 * (consumed by funnel-scoped rules in styles.css via `var(--fp-x, <current>)`
 * fallbacks), a hero layout variant, a section-order variant, and a copy-tone
 * brief for the generator prompt.
 *
 * Contract rules:
 * - The default direction ("premium-agency") resolves to an EMPTY vars object,
 *   so tenants without a design block — and every existing tenant — render
 *   through the CSS fallbacks, byte-identical to the pre-directions look.
 * - Direction vars never define --blue/--blue-dark/--accent/--on-blue; the
 *   per-tenant brand contract (lib/branding.js) stays untouched. Accent
 *   moments reference var(--blue) so branding varies inside every direction.
 * - Tenant config stores only { design: { direction, overrides } } plus the
 *   optional { verticalPreset, sectionVariants } keys; tokens are resolved at
 *   render time so refining a direction here restyles every tenant on it, and
 *   switching direction never touches copy.
 * - Composition precedence, applied per field inside resolveDesign:
 *   explicit tenant value > vertical preset > direction > platform default.
 *   A tenant without a verticalPreset or sectionVariants resolves exactly as
 *   before those layers existed (frozen by tests/section-variants.test.js).
 */

import { getVerticalPreset } from "./verticalPresets.js";
import { resolveSectionVariants } from "./sectionVariants.js";

export const DEFAULT_DIRECTION_ID = "premium-agency";

/** Funnel section ids, in the template's canonical render order. */
export const DEFAULT_SECTION_ORDER = [
  "hero",
  "problem",
  "system",
  "process",
  "output",
  "portfolio",
  "references",
  "fundedOpportunity",
  "packages",
  "fundingPromo",
  "checkout",
  "faq",
  "finalCta"
];

export const HERO_VARIANTS = ["full-bleed", "split", "typographic"];

/**
 * The full token key set every non-default direction must define. Keeping the
 * set closed (and tested) prevents half-specified directions from leaking
 * another direction's look through missing keys.
 */
export const DIRECTION_TOKEN_KEYS = [
  "--fp-font-display",
  "--fp-h1-size",
  "--fp-h1-weight",
  "--fp-h1-tracking",
  "--fp-h1-leading",
  "--fp-h2-size",
  "--fp-h2-weight",
  "--fp-eyebrow-font",
  "--fp-eyebrow-tracking",
  "--fp-eyebrow-color",
  "--fp-bg",
  "--fp-surface",
  "--fp-soft",
  "--fp-fg",
  "--fp-muted",
  "--fp-border-color",
  "--fp-border-w",
  "--fp-radius",
  "--fp-radius-button",
  "--fp-section-pad",
  "--fp-section-pad-sm",
  "--fp-grid-gap",
  "--fp-shadow-card",
  "--fp-shadow-form",
  "--fp-input-bg",
  "--fp-input-border",
  "--fp-button-dark-bg",
  "--fp-button-dark-fg",
  "--fp-dur",
  "--fp-ease"
];

/**
 * next/font CSS variables the directions may reference for display type.
 * app/layout.jsx must instantiate each of these (preload: false); the test
 * suite cross-checks direction font stacks against this list.
 */
export const DIRECTION_FONT_VARIABLES = [
  "--font-fraunces",
  "--font-grotesk",
  "--font-bricolage",
  "--font-instrument"
];

const DESIGN_DIRECTIONS = [
  {
    id: "premium-agency",
    label: "Premium Agency",
    blurb: "The flagship look — cinematic full-bleed hero, bold editorial type, layered depth.",
    copyTone:
      "Confident, polished, benefit-led marketing voice. Concrete specifics over superlatives; energetic but never breathless.",
    fonts: { display: "Geist", body: "Geist" },
    heroVariant: "full-bleed",
    sectionOrder: DEFAULT_SECTION_ORDER,
    // Empty on purpose: this direction IS the CSS fallback layer.
    vars: {},
    preview: {
      swatches: ["#ffffff", "#f6f6f8", "#050505", "#0071e3"],
      fontSample: "Aa",
      fontStack: "var(--font-sans, 'Helvetica Neue', Arial, sans-serif)"
    }
  },
  {
    id: "editorial-minimal",
    label: "Editorial Minimal",
    blurb: "Warm monochrome, serif display type, hairline borders, document-calm whitespace.",
    copyTone:
      "Refined and understated. Plain, specific language; short declarative sentences; zero hype words. Reads like a well-edited magazine feature.",
    fonts: { display: "Fraunces", body: "Geist" },
    heroVariant: "typographic",
    sectionOrder: [
      "hero",
      "portfolio",
      "system",
      "problem",
      "process",
      "references",
      "output",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    vars: {
      "--fp-font-display": "var(--font-fraunces), Georgia, 'Times New Roman', serif",
      "--fp-h1-size": "clamp(44px, 6.4vw, 76px)",
      "--fp-h1-weight": "600",
      "--fp-h1-tracking": "-0.02em",
      "--fp-h1-leading": "1.04",
      "--fp-h2-size": "clamp(34px, 4.6vw, 54px)",
      "--fp-h2-weight": "600",
      "--fp-eyebrow-font": "inherit",
      "--fp-eyebrow-tracking": "0.14em",
      "--fp-eyebrow-color": "#787774",
      "--fp-bg": "#fbfbfa",
      "--fp-surface": "#ffffff",
      "--fp-soft": "#f7f6f3",
      "--fp-fg": "#111111",
      "--fp-muted": "#787774",
      "--fp-border-color": "#eaeaea",
      "--fp-border-w": "1px",
      "--fp-radius": "10px",
      "--fp-radius-button": "8px",
      "--fp-section-pad": "128px",
      "--fp-section-pad-sm": "80px",
      "--fp-grid-gap": "20px",
      "--fp-shadow-card": "none",
      "--fp-shadow-form": "none",
      "--fp-input-bg": "#ffffff",
      "--fp-input-border": "#eaeaea",
      "--fp-button-dark-bg": "#111111",
      "--fp-button-dark-fg": "#ffffff",
      "--fp-dur": "600ms",
      "--fp-ease": "cubic-bezier(0.16, 1, 0.3, 1)"
    },
    preview: {
      swatches: ["#fbfbfa", "#f7f6f3", "#111111", "#eaeaea"],
      fontSample: "Aa",
      fontStack: "var(--font-fraunces), Georgia, serif"
    }
  },
  {
    id: "bold-brutalist",
    label: "Bold Brutalist",
    blurb: "Swiss-print substrate, monolithic uppercase type, hard 2px rules, zero radius.",
    copyTone:
      "Terse and declarative. Short punchy fragments allowed. No adjectives you can't defend, no filler, no softeners. Every line earns its ink.",
    fonts: { display: "Space Grotesk", body: "Geist" },
    heroVariant: "typographic",
    sectionOrder: [
      "hero",
      "problem",
      "output",
      "system",
      "process",
      "portfolio",
      "packages",
      "references",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    vars: {
      "--fp-font-display": "var(--font-grotesk), 'Arial Black', 'Helvetica Neue', sans-serif",
      "--fp-h1-size": "clamp(52px, 10vw, 118px)",
      "--fp-h1-weight": "700",
      "--fp-h1-tracking": "-0.04em",
      "--fp-h1-leading": "0.9",
      "--fp-h2-size": "clamp(40px, 6vw, 72px)",
      "--fp-h2-weight": "700",
      "--fp-eyebrow-font": "var(--font-mono, 'SF Mono', 'Courier New', monospace)",
      "--fp-eyebrow-tracking": "0.1em",
      "--fp-eyebrow-color": "#050505",
      "--fp-bg": "#f4f4f0",
      "--fp-surface": "#f4f4f0",
      "--fp-soft": "#eae8e3",
      "--fp-fg": "#050505",
      "--fp-muted": "#3d3d38",
      "--fp-border-color": "#050505",
      "--fp-border-w": "2px",
      "--fp-radius": "0",
      "--fp-radius-button": "0",
      "--fp-section-pad": "104px",
      "--fp-section-pad-sm": "64px",
      "--fp-grid-gap": "14px",
      "--fp-shadow-card": "none",
      "--fp-shadow-form": "none",
      "--fp-input-bg": "#ffffff",
      "--fp-input-border": "#050505",
      "--fp-button-dark-bg": "#050505",
      "--fp-button-dark-fg": "#f4f4f0",
      "--fp-dur": "120ms",
      "--fp-ease": "linear"
    },
    preview: {
      swatches: ["#f4f4f0", "#eae8e3", "#050505", "#e61919"],
      fontSample: "Aa",
      fontStack: "var(--font-grotesk), 'Arial Black', sans-serif"
    }
  },
  {
    id: "warm-boutique",
    label: "Warm Boutique",
    blurb: "Editorial-luxury creams, rounded split hero, soft diffuse shadows, gentle motion.",
    copyTone:
      "Warm, personal, and craft-forward. Speaks to one reader; sensory but precise. Premium hospitality voice, never corporate.",
    fonts: { display: "Bricolage Grotesque", body: "Geist" },
    heroVariant: "split",
    sectionOrder: [
      "hero",
      "system",
      "portfolio",
      "process",
      "references",
      "problem",
      "output",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    vars: {
      "--fp-font-display": "var(--font-bricolage), 'Avenir Next', 'Helvetica Neue', sans-serif",
      "--fp-h1-size": "clamp(46px, 6.8vw, 82px)",
      "--fp-h1-weight": "700",
      "--fp-h1-tracking": "-0.025em",
      "--fp-h1-leading": "1.02",
      "--fp-h2-size": "clamp(36px, 4.8vw, 58px)",
      "--fp-h2-weight": "700",
      "--fp-eyebrow-font": "inherit",
      "--fp-eyebrow-tracking": "0.12em",
      "--fp-eyebrow-color": "color-mix(in srgb, var(--blue) 70%, #7a6c60)",
      "--fp-bg": "#fdf8f2",
      "--fp-surface": "#ffffff",
      "--fp-soft": "#f7efe6",
      "--fp-fg": "#2a211c",
      "--fp-muted": "#7a6c60",
      "--fp-border-color": "rgba(42, 33, 28, 0.12)",
      "--fp-border-w": "1px",
      "--fp-radius": "20px",
      "--fp-radius-button": "999px",
      "--fp-section-pad": "112px",
      "--fp-section-pad-sm": "72px",
      "--fp-grid-gap": "18px",
      "--fp-shadow-card": "0 24px 60px rgba(42, 33, 28, 0.08)",
      "--fp-shadow-form": "0 24px 70px rgba(42, 33, 28, 0.1)",
      "--fp-input-bg": "#ffffff",
      "--fp-input-border": "rgba(42, 33, 28, 0.18)",
      "--fp-button-dark-bg": "#2a211c",
      "--fp-button-dark-fg": "#fdf8f2",
      "--fp-dur": "320ms",
      "--fp-ease": "cubic-bezier(0.32, 0.72, 0, 1)"
    },
    preview: {
      swatches: ["#fdf8f2", "#f7efe6", "#2a211c", "#c98d5e"],
      fontSample: "Aa",
      fontStack: "var(--font-bricolage), 'Avenir Next', sans-serif"
    }
  },
  {
    id: "dark-cinematic",
    label: "Dark Cinematic",
    blurb: "OLED-dark stage, glass surfaces, serif display type, slow luminous reveals.",
    copyTone:
      "Cinematic and assured. Sparse, evocative lines with long pauses; lets the visuals carry weight. Premium tech-launch voice.",
    fonts: { display: "Instrument Serif", body: "Geist" },
    heroVariant: "full-bleed",
    sectionOrder: [
      "hero",
      "output",
      "portfolio",
      "problem",
      "system",
      "process",
      "references",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    vars: {
      "--fp-font-display": "var(--font-instrument), Georgia, 'Times New Roman', serif",
      "--fp-h1-size": "clamp(48px, 7vw, 92px)",
      "--fp-h1-weight": "400",
      "--fp-h1-tracking": "-0.015em",
      "--fp-h1-leading": "1.02",
      "--fp-h2-size": "clamp(38px, 5vw, 64px)",
      "--fp-h2-weight": "400",
      "--fp-eyebrow-font": "inherit",
      "--fp-eyebrow-tracking": "0.16em",
      "--fp-eyebrow-color": "color-mix(in srgb, var(--blue) 55%, #f5f5f7)",
      "--fp-bg": "#0a0a0c",
      "--fp-surface": "rgba(255, 255, 255, 0.06)",
      "--fp-soft": "#101014",
      "--fp-fg": "#f5f5f7",
      "--fp-muted": "rgba(235, 235, 240, 0.64)",
      "--fp-border-color": "rgba(255, 255, 255, 0.12)",
      "--fp-border-w": "1px",
      "--fp-radius": "16px",
      "--fp-radius-button": "999px",
      "--fp-section-pad": "120px",
      "--fp-section-pad-sm": "76px",
      "--fp-grid-gap": "18px",
      "--fp-shadow-card": "0 30px 80px rgba(0, 0, 0, 0.45)",
      "--fp-shadow-form": "0 30px 90px rgba(0, 0, 0, 0.5)",
      "--fp-input-bg": "rgba(255, 255, 255, 0.08)",
      "--fp-input-border": "rgba(255, 255, 255, 0.18)",
      "--fp-button-dark-bg": "#f5f5f7",
      "--fp-button-dark-fg": "#050505",
      "--fp-dur": "600ms",
      "--fp-ease": "cubic-bezier(0.32, 0.72, 0, 1)"
    },
    preview: {
      swatches: ["#0a0a0c", "#101014", "#f5f5f7", "#0071e3"],
      fontSample: "Aa",
      fontStack: "var(--font-instrument), Georgia, serif"
    }
  }
];

const DIRECTIONS_BY_ID = new Map(DESIGN_DIRECTIONS.map((direction) => [direction.id, direction]));

export function listDesignDirections() {
  return DESIGN_DIRECTIONS;
}

export function getDesignDirection(id) {
  return DIRECTIONS_BY_ID.get(String(id || "")) || null;
}

export function isValidDirectionId(id) {
  return DIRECTIONS_BY_ID.has(String(id || ""));
}

/**
 * Normalize any stored/authored section order into a safe render order:
 * a permutation of DEFAULT_SECTION_ORDER with hero first, unknown ids dropped,
 * duplicates removed, missing ids appended in default relative order, and
 * checkout kept after packages (package selection scrolls to the checkout
 * section, so it must exist downstream of the package grid).
 */
export function resolveSectionOrder(order) {
  const known = new Set(DEFAULT_SECTION_ORDER);
  const seen = new Set();
  const resolved = [];

  for (const id of Array.isArray(order) ? order : []) {
    const key = String(id || "");
    if (!known.has(key) || seen.has(key)) continue;
    seen.add(key);
    resolved.push(key);
  }

  for (const id of DEFAULT_SECTION_ORDER) {
    if (!seen.has(id)) resolved.push(id);
  }

  const heroIndex = resolved.indexOf("hero");
  if (heroIndex > 0) {
    resolved.splice(heroIndex, 1);
    resolved.unshift("hero");
  }

  const packagesIndex = resolved.indexOf("packages");
  const checkoutIndex = resolved.indexOf("checkout");
  if (checkoutIndex !== -1 && checkoutIndex < packagesIndex) {
    resolved.splice(checkoutIndex, 1);
    resolved.splice(resolved.indexOf("packages") + 1, 0, "checkout");
  }

  return resolved;
}

function sanitizeOverrides(overrides) {
  const clean = {};
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return clean;
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof key !== "string" || !key.startsWith("--fp-")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    clean[key] = value.trim();
  }
  return clean;
}

/**
 * Resolve a tenant's design block into render-ready values. Accepts anything
 * (missing block, unknown id) and always returns a usable direction — the
 * default look is the failure mode, never a broken page.
 */
export function resolveDesign(design) {
  const direction = getDesignDirection(design?.direction) || getDesignDirection(DEFAULT_DIRECTION_ID);
  const overrides = sanitizeOverrides(design?.overrides);
  const preset = getVerticalPreset(design?.verticalPreset);
  const sectionVariants = resolveSectionVariants(
    design?.sectionVariants,
    preset?.sectionVariantPrefs,
    HERO_VARIANTS.includes(direction.heroVariant) ? direction.heroVariant : "full-bleed"
  );

  return {
    id: direction.id,
    label: direction.label,
    copyTone: direction.copyTone,
    // Kept in sync with sectionVariants.hero so pre-variants consumers
    // (HeroSection, admin previews) need no migration.
    heroVariant: sectionVariants.hero,
    sectionOrder: resolveSectionOrder(preset?.sectionOrder || direction.sectionOrder),
    vars: { ...direction.vars, ...overrides },
    verticalPresetId: preset ? preset.id : null,
    sectionVariants
  };
}
