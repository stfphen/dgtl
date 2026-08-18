import CoreShell from "../../components/core/CoreShell";
import { getCorePageContext } from "../../lib/core/server";
import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "../admin/dgtl-admin.css";
import "./core.css";

// Core is DGTL's own app, not a tenant funnel. Every DGTL-owned web surface
// starts its browser title with the repo-wide "DGTL --" identity prefix.
// Child pages stay inside the same identity via the title template below.
//
// appleWebApp.title emits <meta name="apple-mobile-web-app-title">. The static
// house PNG is intentional: iOS home-screen icons must use the raster DGTL asset
// rather than the SVG browser favicon or a tenant-resolved branding route.
export const metadata = {
  title: {
    default: "DGTL -- Core",
    template: "DGTL -- Core | %s",
  },
  description: "The DGTL operating command center.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DGTL -- Core",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/assets/brand/icons/apple-touch-icon.png",
  },
};

// In Next 15 themeColor belongs on viewport, not metadata. width/initialScale/
// viewportFit are restated verbatim from the root layout rather than left to be
// inherited: a nested viewport export replaces the parent's, and dropping
// viewportFit:"cover" would silently break every env(safe-area-inset-*) rule in
// the admin/core CSS around the Dynamic Island and home indicator.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

// display:contents so this wrapper contributes no box of its own — it exists
// only to carry --font-manrope, which inherits down to the core shell.
export default async function CoreLayout({ children }) {
  const { session } = await getCorePageContext();
  return (
    <div className={manrope.variable} style={{ display: "contents" }}>
      <CoreShell user={{ ...session.user, email: session.email, role: session.role }}>
        {children}
      </CoreShell>
    </div>
  );
}
