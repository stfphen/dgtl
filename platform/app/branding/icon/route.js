import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTenantForHost } from "../../../lib/store.js";
import { parseAppIcon } from "../../../lib/branding/appIcon.js";

// GET /branding/icon — serves the home-screen / PWA icon for the tenant that
// owns the current host. Falls back to the bundled /icon.svg when the tenant
// has not set a custom icon. Referenced by the dynamic manifest and the
// apple-touch-icon <link> in app/layout.jsx.
export async function GET(request) {
  let appIcon = "";
  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
    const tenant = await getTenantForHost(host);
    appIcon = tenant?.brand?.appIcon || "";
  } catch {
    appIcon = "";
  }

  const parsed = parseAppIcon(appIcon);

  if (parsed.kind === "data") {
    return new NextResponse(parsed.buffer, {
      status: 200,
      headers: {
        "Content-Type": parsed.contentType,
        // Short cache: lets an admin's icon change show up reasonably fast,
        // while still avoiding a fetch on every page load.
        "Cache-Control": "public, max-age=300, must-revalidate"
      }
    });
  }

  if (parsed.kind === "url") {
    return NextResponse.redirect(parsed.url, 307);
  }

  // No custom icon — fall back to the DGTL house apple-touch icon. Must be a
  // raster PNG: iOS ignores SVG apple-touch icons, so the old /icon.svg fallback
  // produced no home-screen icon on iPhone/iPad.
  return NextResponse.redirect(new URL("/assets/brand/icons/apple-touch-icon.png", request.url), 307);
}
