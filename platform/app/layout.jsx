import {
  Bricolage_Grotesque,
  Fraunces,
  Geist,
  Geist_Mono,
  Instrument_Serif,
  Manrope,
  Space_Grotesk,
} from "next/font/google";
import "../styles.css";

// Primary UI / display typeface — Geist: clean, technical-premium, used for both
// body and headings (one calm family, not a separate display face).
const sans = Geist({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// Monospace — Geist Mono for data, code, and email-preview blocks. Heavier
// weights (600/700) let large figures (hero stats, prices) read as instrument
// readouts without the browser synthesizing a faux-bold.
const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

// Design-direction display faces (lib/tenantBuilder/designDirections.js).
// preload: false — the @font-face rules ship, but a family only downloads on
// pages whose direction actually resolves text to its --font-* variable, so
// default-look tenants and the admin pay nothing for these.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
  variable: "--font-fraunces",
  preload: false,
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700"],
  variable: "--font-grotesk",
  preload: false,
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
  variable: "--font-bricolage",
  preload: false,
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-instrument",
  preload: false,
});

// DGTL brand face (dgtl-brand-kit). Same lazy contract as the display faces
// above: only surfaces that resolve --font-manrope download it — today that's
// the "platform" template (DGTL Growth Platform page); the admin loads its own
// Manrope instance in app/admin/layout.jsx.
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  preload: false,
});

// Drives the mobile viewport. viewportFit: "cover" lets the existing
// env(safe-area-inset-*) rules (mobile action bar, bottom padding, admin nav)
// actually resolve around the Dynamic Island / home indicator on modern iPhones.
// Zoom is intentionally left enabled (no maximumScale) for accessibility.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "Content Day",
  description:
    "A configurable white-label content creation funnel and lead generation dashboard.",
  // Per-tenant PWA manifest (Android/Chrome) resolved by host at request time.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    // iOS home-screen icon: served per-tenant from the host, falling back to
    // the bundled SVG when a tenant hasn't set a custom icon.
    apple: "/branding/icon",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${fraunces.variable} ${grotesk.variable} ${bricolage.variable} ${instrument.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
