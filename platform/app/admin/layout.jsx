import { Manrope } from "next/font/google";
import "./dgtl-admin.css";

// DGTL brand typeface for the admin surface only. Exposed as a CSS variable
// (--font-manrope) that dgtl-admin.css repoints --font-sans to, scoped under
// .v2-admin-shell / .admin-login. Loading it here (a nested layout over /admin
// and /admin/login) keeps Manrope off the public tenant funnels. preload:false
// so the funnels — which never mount under this layout — pay nothing for it.
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  preload: false,
});

// display:contents so this wrapper contributes no box of its own — it exists
// only to carry the --font-manrope custom property, which inherits to the admin
// shell + login below. Layout/skeleton is untouched.
export default function AdminLayout({ children }) {
  return (
    <div className={manrope.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
