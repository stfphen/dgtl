import CoreShell from "../../components/core/CoreShell";
import { getCorePageContext } from "../../lib/core/server";
import "../admin/dgtl-admin.css";
import "./core.css";

export default async function CoreLayout({ children }) {
  const { session } = await getCorePageContext();
  return (
    <CoreShell user={{ ...session.user, email: session.email, role: session.role }}>
      {children}
    </CoreShell>
  );
}
