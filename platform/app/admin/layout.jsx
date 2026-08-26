import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./dgtl-admin.css";

// The admin shell is a DGTL-owned surface. Repo-wide browser identity requires
// every DGTL web app title to begin with "DGTL --".
export const metadata = {
  title: { default: "DGTL -- Admin", template: "DGTL -- Admin | %s" },
  appleWebApp: {
    capable: true,
    title: "DGTL -- Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/assets/brand/icons/apple-touch-icon.png",
  },
};

export default function AdminLayout({ children }) {
  return (
    <div className={manrope.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
