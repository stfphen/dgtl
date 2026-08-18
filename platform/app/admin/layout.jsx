import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./dgtl-admin.css";

// The admin shell is a DGTL-owned surface. Repo-wide browser identity requires
// every DGTL web app title to begin with "DGTL --"; nested admin pages append
// their local title after the application name.
export const metadata = {
  title: {
    default: "DGTL -- Admin",
    template: "DGTL -- Admin | %s",
  },
  appleWebApp: {
    capable: true,
    title: "DGTL -- Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/assets/brand/icons/apple-touch-icon.png",
  },
};

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
