import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { getAdminSession } from "../../../lib/auth";
import { canViewDashboard } from "../../../lib/permissions";
import InvoiceGeneratorPanel from "../../../components/admin/InvoiceGeneratorPanel";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const session = await getAdminSession();
  if (!session || !canViewDashboard(session)) redirect("/admin/login");

  return (
    <main className="admin-shell" style={{ minHeight: "100vh", padding: "clamp(20px, 4vw, 48px)" }}>
      <div className="dgtl-content" style={{ maxWidth: 1320, margin: "0 auto" }}>
        <header className="admin-header v2-view-header">
          <div>
            <p className="eyebrow">DGTL Core · Finance</p>
            <h1><ReceiptText size={28} aria-hidden /> Invoices</h1>
            <p>Generate polished DGTL invoices through the Invoice Generator API.</p>
          </div>
          <Link className="button button--secondary" href="/admin"><ArrowLeft size={16} /> Back to dashboard</Link>
        </header>
        <InvoiceGeneratorPanel />
      </div>
    </main>
  );
}
