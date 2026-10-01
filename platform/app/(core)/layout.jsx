import CoreShell from "../../components/core/CoreShell";
import { getCorePageContext } from "../../lib/core/server";
import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "../admin/dgtl-admin.css";
import "./core.css";

// Core is DGTL's own app, not a tenant funnel. Every DGTL-owned web surface
// starts its browser title with the repo-wide "DGTL --" identity prefix.
export const metadata = {
  title: { default: "DGTL -- Core", template: "DGTL -- Core | %s" },
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

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
