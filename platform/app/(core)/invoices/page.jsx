import { ReceiptText } from "lucide-react";
import InvoiceGeneratorPanel from "../../../components/admin/InvoiceGeneratorPanel";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return (
    <div className="core-page">
      <header className="core-page__header">
        <div>
          <p className="eyebrow">DGTL Core · Finance</p>
          <h1><ReceiptText size={28} aria-hidden /> Invoices</h1>
          <p>Create client-ready invoices and generate PDF files without leaving DGTL Core.</p>
        </div>
      </header>
      <InvoiceGeneratorPanel />
    </div>
  );
}
