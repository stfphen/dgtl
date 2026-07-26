import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTenantForHost } from "../../lib/store.js";
import { parseAppIcon } from "../../lib/branding/appIcon.js";

// GET /manifest.webmanifest — a per-tenant PWA manifest resolved from the host.
// Drives the Android/Chrome "Add to Home Screen" name, theme color, and icon.
// (iOS uses the apple-touch-icon <link> instead — see app/layout.jsx.)
export async function GET() {
  let tenant = null;
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
    tenant = await getTenantForHost(host);
  } catch {
    tenant = null;
  }

  const brand = tenant?.brand || {};
  const name = brand.name || "Content Day";
  const themeColor = brand.primaryColor || "#000000";
  const hasCustomIcon = parseAppIcon(brand.appIcon).kind !== "none";

  // When the tenant supplies a PNG we advertise the standard install sizes,
  // all served by the single /branding/icon route. Otherwise fall back to the
  // bundled DGTL house icon set (real PNGs, incl. a maskable variant) so the
  // manifest is always valid and Android/Chrome installs get a proper icon.
  const icons = hasCustomIcon
    ? [
        { src: "/branding/icon", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/branding/icon", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/branding/icon", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    : [
        { src: "/assets/brand/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/assets/brand/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/assets/brand/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ];

  const manifest = {
    name,
    short_name: (brand.logoText || name).slice(0, 24),
    description: brand.tagline || "",
    start_url: "/",
    display: "standalone",
    background_color: brand.backgroundColor || "#000000",
    theme_color: themeColor,
    icons
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, must-revalidate"
    }
  });
}
