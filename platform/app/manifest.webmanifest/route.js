import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTenantClaimingHost } from "../../lib/store.js";
import { parseAppIcon } from "../../lib/branding/appIcon.js";
import { buildAppManifest } from "../../lib/branding/appManifest.js";

// GET /manifest.webmanifest — the PWA manifest for the requesting host.
// Drives the Android/Chrome "Add to Home Screen" name, theme color, and icon.
// (iOS uses apple-touch-icon + apple-mobile-web-app-title instead — see
// app/layout.jsx and app/(core)/layout.jsx.)
//
// getTenantClaimingHost, NOT getTenantForHost: only a tenant that explicitly
// lists this host in its domains gets to name the install. An unclaimed host —
// dgtl.chat, dgtlmag.com, localhost — resolves to null and installs as DGTL.
export async function GET() {
  let tenant = null;
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
    tenant = await getTenantClaimingHost(host);
  } catch {
    tenant = null;
  }

  const hasCustomIcon = parseAppIcon(tenant?.brand?.appIcon).kind !== "none";

  return NextResponse.json(buildAppManifest(tenant, { hasCustomIcon }), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, must-revalidate"
    }
  });
}
