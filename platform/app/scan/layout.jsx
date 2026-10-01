import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "../admin/dgtl-admin.css";

// The door scanner is a DGTL-owned surface: "DGTL --" title per
// docs/WEB-APP-BRANDING.md. The PWA manifest (scope /scan) arrives with the
// scanner itself in build-plan Phase 3.
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
  return (
    <div className={manrope.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
