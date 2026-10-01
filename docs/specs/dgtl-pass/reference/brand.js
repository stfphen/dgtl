// DGTL Pass — brand kit resolution (reference implementation).
//
// Emails and Apple Wallet passes cannot read CSS custom properties, so the pass
// renderer needs literal colors. They come from exactly one place:
//
//   DGTL_TOKENS below  <- mirrors the DGTL brand kit tokens. brand.test.js fails if
//                         these drift from any of the three token files:
//                         engine/dgtl-brand-kit/assets/dgtl-tokens.css (the kit),
//                         journal/_shared/dgtl-editorial.css, and
//                         platform/app/dgtl-tokens.css (the platform's canonical layer)
//   tenant.brand       <- name, logoText, logo, primaryColor (existing tenant config)
//   tenant.passes.brandKit <- optional per-tenant overrides (new, see 09-brand-and-tiers.md)
//
// DGTL is the *default*, never an assumption. A tenant with its own palette
// gets its own emails and Wallet passes without code changes.
//
// Brand-kit rules this module encodes (engine/dgtl-brand-kit/SKILL.md):
//   - the accent is the *action* color: primary buttons, one moment per view
//   - kickers/eyebrows are gold-tan, not gold
//   - Manrope first, then a real system fallback stack
//   - dark is the identity; the light ladder exists only for tenants whose own
//     brand is light, and uses the kit's light-mode exception values
//
// Port target: platform/lib/passes/brandKit.js. In the port, import
// readableForeground from platform/lib/branding.js (export it there) instead of
// the copy below.

// Canonical values from the brand kit. Do not edit here without editing the
// token files; the test compares them.
export const DGTL_TOKENS = Object.freeze({
  "--bg": "#000000",
  "--surface-1": "#0a0a0a",
  "--surface-2": "#111111",
  "--border": "#2a2a2a",
  "--text": "#F0F0F0",
  "--text-muted": "#D0D0D0",
  "--text-dim": "#8a8a8a",
  "--text-ghost": "#5a5a56",
  "--gold": "#F0CF50",
  "--gold-tan": "#b3a06a",
  "--placeholder": "#6a6a6a"
});

// Geometry from the kit. Emails inline these; nothing else may invent a radius.
export const DGTL_GEOMETRY = Object.freeze({ control: 7, card: 16, pill: 9999 });

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHex(value) {
  return HEX.test(String(value || "").trim());
}

function safe(value, fallback) {
  return isHex(value) ? String(value).trim() : fallback;
}

export function hexToRgb(hex) {
  const int = parseInt(String(hex).trim().slice(1), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// Apple Wallet wants "rgb(r, g, b)" strings.
export function walletColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Same rule as platform/lib/branding.js so buttons match the funnel. On the
// DGTL gold this yields near-black: the kit's "black text on gold".
export function readableForeground(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#050505" : "#ffffff";
}

// Solid blend of two colors. Email clients (Outlook) drop rgba(), so tints such
// as the kit's gold-tint chip are pre-mixed against the surface they sit on.
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

const DARK_LADDER = {
  background: DGTL_TOKENS["--bg"],
  surface: DGTL_TOKENS["--surface-1"],
  surfaceRaised: DGTL_TOKENS["--surface-2"],
  line: DGTL_TOKENS["--border"],
  text: DGTL_TOKENS["--text"],
  textMuted: DGTL_TOKENS["--text-muted"],
  textDim: DGTL_TOKENS["--text-dim"],
  kicker: DGTL_TOKENS["--gold-tan"]
};

// The kit's light-mode exception (application-guide.md): paper, near-black
// text, warm borders. Only for tenants whose brand is light. DGTL itself is dark.
const LIGHT_LADDER = {
  background: "#f7f6f2",
  surface: "#ffffff",
  surfaceRaised: "#f7f6f2",
  line: "#e5e2d9",
  text: "#111111",
  textMuted: "#3a3a3a",
  textDim: "#6b6b6b",
  kicker: "#7a6a3a"
};

export const DEFAULT_FONT_STACK = "Manrope, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const DEFAULT_FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";

/**
 * tenant: a normalized tenant config ({ brand, passes? }).
 * Returns everything the email + Wallet renderers need, all colors validated.
 */
export function resolveBrandKit(tenant = {}) {
  const brand = tenant.brand || {};
  const kit = tenant.passes?.brandKit || {};
  const theme = kit.theme === "light" ? "light" : "dark";
  const ladder = theme === "light" ? LIGHT_LADDER : DARK_LADDER;
  const colors = Object.fromEntries(
    Object.entries(ladder).map(([key, fallback]) => [key, safe(kit.colors?.[key], fallback)])
  );
  // The accent is the brand's action color: the primary button on every
  // pass email, the scanner's VIP band, the pass page CTA.
  const accent = safe(kit.colors?.accent, safe(brand.primaryColor, DGTL_TOKENS["--gold"]));

  return {
    theme,
    name: String(kit.name || brand.name || "DGTL"),
    logoText: String(kit.logoText || brand.logoText || brand.name || "DGTL"),
    // Absolute https URL to a PNG (emails cannot use SVG or data URIs reliably).
    logoUrl: /^https:\/\//.test(kit.logoUrl || "") ? kit.logoUrl : "",
    // True when the logo artwork already spells the name (the DGTL wordmark
    // does), so Wallet must not repeat it as logoText.
    logoIncludesName: Boolean(kit.logoIncludesName),
    // Text Wallet sets beside the logo. For DGTL's own passes "PASS", which makes
    // the "DGTL⚡ PASS" product lockup. Empty = none (or logoText when the logo
    // doesn't spell the name).
    walletLogoText: String(kit.walletLogoText || "").slice(0, 20),
    colors: { ...colors, kicker: ensureContrast(colors.kicker, colors.surface, 4.5), accent, onAccent: readableForeground(accent) },
    fontStack: kit.fontStack || DEFAULT_FONT_STACK,
    fontCssUrl: kit.fontCssUrl === "" ? "" : kit.fontCssUrl || DEFAULT_FONT_CSS_URL,
    sender: {
      fromName: String(kit.sender?.fromName || brand.name || "DGTL"),
      fromEmail: String(kit.sender?.fromEmail || ""),
      replyTo: String(kit.sender?.replyTo || "")
    },
    legal: {
      // CASL / CAN-SPAM identification: a real postal address is required in
      // every commercial message. Leaving it empty blocks VIP onboarding sends.
      postalAddress: String(kit.legal?.postalAddress || ""),
      supportEmail: String(kit.legal?.supportEmail || ""),
      supportUrl: /^https:\/\//.test(kit.legal?.supportUrl || "") ? kit.legal.supportUrl : "",
      termsUrl: /^https:\/\//.test(kit.legal?.termsUrl || "") ? kit.legal.termsUrl : ""
    }
  };
}
