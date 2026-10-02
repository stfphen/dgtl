import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./pass.css";

// The holder's pass. Public, but never indexed and never cached: the URL is
// the credential (docs/specs/dgtl-pass/11-admin-dashboard.md).
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000"
};

export default function PassLayout({ children }) {
  return <div className={`${manrope.variable} dgtl-pass pp-root`}>{children}</div>;
}
