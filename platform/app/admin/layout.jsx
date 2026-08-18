import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "./dgtl-admin.css";

// The admin shell is DGTL's own surface, not a tenant funnel, so it names itself
// rather than inheriting the root layout's tenant-facing "Content Day" title —
// the same reasoning the (core) layout applies to /home and /chat. The root title
// is deliberately left alone: every funnel-template tenant inherits it, so
// renaming it would rename their public browser tabs (tests/app-identity.test.js).
//
// This layout also covers /admin/login, which sets title.absolute to opt OUT of
// the template below — "DGTL Login · DGTL" would be silly.
export const metadata = {
  title: { default: "DGTL", template: "%s · DGTL" },
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
