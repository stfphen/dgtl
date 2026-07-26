// Per-tenant white-label theming.
//
// The funnel stylesheet (styles.css) is authored against a small set of CSS
// custom properties (--blue, --blue-dark, --accent). This module turns a
// tenant's `brand` config into an inline style object that overrides those
// properties for that tenant's rendered subtree, so each tenant gets its own
// color theme, wordmark, and tagline without touching global styles or any
// secrets. Branding is data-only and lives entirely in tenant config.

const DEFAULT_PRIMARY = "#0071e3";
const DEFAULT_ACCENT = "#050505";
const HEX = /^#?([0-9a-fA-F]{6})$/;

function toRgb(hex) {
  const match = HEX.exec(String(hex || "").trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex({ r, g, b }) {
  const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

// Mix a color toward black (amount > 0) or white (amount < 0).
function shade(hex, amount) {
  const rgb = toRgb(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 0 : 255;
  const t = Math.abs(amount);
  return toHex({
    r: rgb.r + (target - rgb.r) * t,
    g: rgb.g + (target - rgb.g) * t,
    b: rgb.b + (target - rgb.b) * t
  });
}

// Validate a brand-supplied color, falling back to a known-good default so a
// malformed tenant config can never produce a broken or invisible theme.
function safeColor(value, fallback) {
  return toRgb(value) ? value.trim() : fallback;
}

// Pick a readable foreground (black or white) for text/icons sitting on top of
// `hex`. Without this, a bright brand primary (e.g. DMTV's yellow, ELiXR's gold)
// would render white text on a near-white button — illegible. Uses perceived
// luminance so the threshold tracks how light a color actually looks.
function readableForeground(hex) {
  const rgb = toRgb(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? "#050505" : "#ffffff";
}

export function getTenantTheme(brand = {}) {
  const primary = safeColor(brand.primaryColor, DEFAULT_PRIMARY);
  const accent = safeColor(brand.accentColor, DEFAULT_ACCENT);
  return {
    primary,
    accent,
    // CSS custom properties consumed by styles.css. Setting them on the
    // tenant root cascades to every funnel element without leaking across
    // tenants rendered in separate requests.
    vars: {
      "--blue": primary,
      "--blue-dark": shade(primary, 0.22),
      "--accent": accent,
      // Foreground for elements painted with --blue (primary buttons, the
      // "Most popular" badge), so light brand colors stay legible.
      "--on-blue": readableForeground(primary)
    }
  };
}
