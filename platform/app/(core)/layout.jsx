import CoreShell from "../../components/core/CoreShell";
import { getCorePageContext } from "../../lib/core/server";
import { manrope } from "../../lib/fonts";
import "../dgtl-tokens.css";
import "../admin/dgtl-admin.css";
import "./core.css";

export default async function CoreLayout({ children }) {
  const { session } = await getCorePageContext();
  return (
    // display:contents wrapper carries --font-manrope to the Core shell, the
    // same way the admin layout does. Before this, Core resolved Manrope only
    // because the ROOT layout happens to put the variable on <html> with
    // preload:false — the OS's primary typeface arrived by coincidence and was
    // never preloaded on its own routes.
    <div className={manrope.variable} style={{ display: "contents" }}>
      <CoreShell user={{ ...session.user, email: session.email, role: session.role }}>
        {children}
      </CoreShell>
    </div>
  );
}
