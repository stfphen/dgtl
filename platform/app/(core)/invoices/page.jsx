import { redirect } from "next/navigation";

export const metadata = { title: "Invoices" };

export default function InvoicesPage() {
  redirect("/admin/invoices");
}
