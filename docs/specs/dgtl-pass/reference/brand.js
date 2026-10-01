// DGTL Pass — brand kit resolution (reference implementation).
//
// Emails and Apple Wallet passes cannot read CSS custom properties, so the pass
// renderer needs literal colors. They come from exactly one place:
//
//   DGTL_TOKENS below  <- mirrors journal/_shared/dgtl-editorial.css (the canonical
//                         DGTL tokens; brand.test.js fails if the two drift)
//   tenant.brand       <- name, logoText, logo, primaryColor (existing tenant config)
//   tenant.passes.brandKit <- optional per-tenant overrides (new, see 09-brand-and-tiers.md)
//
// DGTL is the *default*, never an assumption. A tenant with its own palette
// gets its own emails and Wallet passes without code changes.
//
// Port target: platform/lib/passes/brandKit.js. In the port, import
// readableForeground from platform/lib/branding.js (export it there) instead of
// the copy below.

// Canonical values from journal/_shared/dgtl-editorial.css. Do not edit here
// without editing the stylesheet; the test compares them.
export const DGTL_TOKENS = Object.freeze({
  "--bg": "#000000",
  "--surface-1": "#0a0a0a",
  "--surface-2": "#111111",
  "--border": "#2a2a2a",
  "--text": "#F0F0F0",
  "--text-muted": "#D0D0D0",
  "--text-dim": "#8a8a8a",
  "--gold": "#F0CF50",
  "--gold-tan": "#b3a06a"
});

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

// Same rule as platform/lib/branding.js so buttons match the funnel.
export function readableForeground(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#050505" : "#ffffff";
}

const DARK_LADDER = {
  background: DGTL_TOKENS["--bg"],
  surface: DGTL_TOKENS["--surface-1"],
  surfaceRaised: DGTL_TOKENS["--surface-2"],
  line: DGTL_TOKENS["--border"],
  text: DGTL_TOKENS["--text"],
  textMuted: DGTL_TOKENS["--text-muted"],
  textDim: DGTL_TOKENS["--text-dim"]
};

// For tenants whose brand is light. Not DGTL tokens, since DGTL has no light
// editorial ladder. Kept neutral so any accent sits on it.
const LIGHT_LADDER = {
  background: "#f4f3ef",
  surface: "#ffffff",
  surfaceRaised: "#faf9f6",
  line: "#e6e2d6",
  text: "#111111",
  textMuted: "#3a3a3a",
  textDim: "#6b6b6b"
};

export const DEFAULT_FONT_STACK = "Manrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const DEFAULT_FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap";

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
  const accent = safe(kit.colors?.accent, safe(brand.primaryColor, DGTL_TOKENS["--gold"]));

  return {
    theme,
    name: String(kit.name || brand.name || "DGTL"),
    logoText: String(kit.logoText || brand.logoText || brand.name || "DGTL"),
    // Absolute https URL to a PNG (emails cannot use SVG or data URIs reliably).
    logoUrl: /^https:\/\//.test(kit.logoUrl || "") ? kit.logoUrl : "",
    colors: { ...colors, accent, onAccent: readableForeground(accent) },
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
