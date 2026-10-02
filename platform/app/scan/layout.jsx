import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./scan.css";

// The door scanner is a DGTL-owned surface: "DGTL --" title per
// docs/WEB-APP-BRANDING.md. Platform chrome, not themed per tenant: staff
// moving between venues see the same tool (docs/specs/dgtl-pass/06-scanner.md).
export const metadata = {
  title: { default: "DGTL -- Scanner", template: "DGTL -- Scanner | %s" },
  appleWebApp: {
    capable: true,
    title: "DGTL -- Scanner",
    statusBarStyle: "black-translucent"
  },
  icons: {
    apple: "/assets/brand/icons/apple-touch-icon.png"
  },
  robots: { index: false, follow: false }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000"
};

export default function ScanLayout({ children }) {
  return <div className={`${manrope.variable} dgtl-pass sc-root`}>{children}</div>;
}
