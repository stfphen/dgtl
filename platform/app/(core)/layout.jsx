import { Manrope } from "next/font/google";
import CoreShell from "../../components/core/CoreShell";
import { getCorePageContext } from "../../lib/core/server";
import "../admin/dgtl-admin.css";
import "./core.css";

// DGTL brand typeface for the Core surface. Same contract as the admin layout:
// a --font-manrope variable that dgtl-admin.css repoints --font-sans to, scoped
// under .v2-admin-shell (which CoreShell carries). Core previously borrowed the
// root layout's instance; owning one here keeps the two surfaces symmetrical and
// keeps Manrope off the public tenant funnels. preload:false — the funnels never
// mount under this layout.
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  preload: false,
});

// Core is DGTL's own app, not a tenant funnel — so it names itself rather than
// inheriting the root layout's tenant-facing "Content Day" title.
//
// appleWebApp.title emits <meta name="apple-mobile-web-app-title">, which the
// platform did not have anywhere. Without it iOS falls back to the manifest's
// short_name for the home-screen label. icons.apple points at the STATIC house
// PNG rather than /branding/icon, so no host resolution runs on this surface at
// all — structurally immune to a tenant's icon reaching a DGTL install.
export const metadata = {
  title: { default: "DGTL.chat", template: "%s · DGTL.chat" },
  description: "The DGTL operating command center.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DGTL.chat",
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
