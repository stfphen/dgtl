// The web-app install identity: what a host becomes when someone adds it to a
// home screen. Two shapes, and the distinction is the whole point of this file.
//
//   - A host a tenant EXPLICITLY CLAIMS installs as that tenant.
//   - Any other host installs as DGTL itself — never as whichever tenant row
//     happened to come back first.
//
// The routes resolve the host with getTenantClaimingHost (no fallback) and pass
// the result — tenant or null — straight to buildAppManifest. The old
// getTenantForHost had a third clause that returned an arbitrary active tenant
// for an unclaimed host, which is how dgtl.chat, dgtlmag.com and www.dgtlmag.com
// all came to install as "DMTV".
//
// buildAppManifest is kept pure (host resolution stays in the route) so it is
// testable under `node --test` — headers() is not. Same split as lib/branding.js.

// The bundled DGTL house icon set. Real PNGs on disk under platform/public;
// tests assert every one of these paths exists.
export const DGTL_HOUSE_ICONS = Object.freeze([
  { src: "/assets/brand/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/assets/brand/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/assets/brand/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
  { src: "/assets/brand/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
]);

// iOS ignores SVG apple-touch icons, so this must stay a raster PNG.
export const DGTL_HOUSE_APPLE_TOUCH_ICON = "/assets/brand/icons/apple-touch-icon.png";

// short_name is the string iOS and Android print under the home-screen icon.
// It matches public/assets/brand/icons/site.webmanifest so every path that can
// name a DGTL install agrees on "DGTL".
//
// The two colours duplicate --bg from app/admin/dgtl-admin.css because a JSON
// manifest cannot reference a CSS custom property. tests/app-identity.test.js
// parses that stylesheet and asserts they still match, so the duplication
// cannot silently drift.
export const DGTL_HOUSE_APP = Object.freeze({
  name: "DGTL.chat",
  short_name: "DGTL",
  description: "The DGTL operating command center.",
  start_url: "/home",
  scope: "/",
  display: "standalone",
  background_color: "#000000",
  theme_color: "#000000",
  icons: DGTL_HOUSE_ICONS
});

// Build the PWA manifest for a resolved tenant, or the DGTL house identity when
// no tenant claims the host. Pure — pass null for "unclaimed".
export function buildAppManifest(tenant, { hasCustomIcon = false } = {}) {
  if (!tenant) return { ...DGTL_HOUSE_APP, icons: [...DGTL_HOUSE_ICONS] };

  const brand = tenant.brand || {};
  const name = brand.name || DGTL_HOUSE_APP.name;

  // A tenant with its own PNG advertises the standard install sizes, all served
  // by the single /branding/icon route. Otherwise it inherits the house icons so
  // the manifest is always valid and an install still gets a real icon.
  const icons = hasCustomIcon
    ? [
        { src: "/branding/icon", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/branding/icon", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/branding/icon", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    : [...DGTL_HOUSE_ICONS];

  return {
    name,
    short_name: (brand.logoText || name).slice(0, 24),
    description: brand.tagline || "",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brand.backgroundColor || "#000000",
    theme_color: brand.primaryColor || "#000000",
    icons
  };
}
