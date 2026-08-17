import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./dgtl-admin.css";

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
