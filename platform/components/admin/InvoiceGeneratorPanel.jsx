"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";

const blankItem = () => ({ name: "", description: "", quantity: 1, unit_cost: 0 });

export default function InvoiceGeneratorPanel() {
  const [form, setForm] = useState({
    number: `INV-${new Date().getFullYear()}-001`,
    from: "DGTL Group\nToronto, Ontario, Canada",
    to: "",
    date: new Date().toISOString().slice(0, 10),
    due_date: "",
    currency: "CAD",
    tax: 13,
    notes: "Thank you for your business.",
    terms: "Payment due by the due date shown above.",
  });
  const [items, setItems] = useState([blankItem()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0), 0), [items]);
  const total = subtotal * (1 + Number(form.tax || 0) / 100);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setItem = (index, key, value) => setItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));

  async function generate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Invoice generation failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `DGTL-${form.number || "invoice"}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Invoice generation failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="admin-panel invoice-generator">
      <div className="pipeline-header">
        <div><p className="eyebrow">DGTL Finance</p><h2>Invoice Generator</h2><p>Create a client-ready PDF without leaving Core.</p></div>
        <span className="status-pill"><FileText size={14} /> PDF</span>
      </div>

      <div className="outreach-admin-grid">
        <section className="outreach-card">
          <h3>Invoice details</h3>
          <div className="admin-form">
            <label>Invoice number<input value={form.number} onChange={(e) => setField("number", e.target.value)} /></label>
            <label>From<textarea rows="4" value={form.from} onChange={(e) => setField("from", e.target.value)} /></label>
            <label>Bill to<textarea rows="4" placeholder="Client name, company, address" value={form.to} onChange={(e) => setField("to", e.target.value)} /></label>
            <label>Issue date<input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} /></label>
            <label>Due date<input type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} /></label>
            <label>Currency<select value={form.currency} onChange={(e) => setField("currency", e.target.value)}><option>CAD</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
            <label>Tax %<input type="number" min="0" step="0.01" value={form.tax} onChange={(e) => setField("tax", e.target.value)} /></label>
          </div>
        </section>

        <section className="outreach-card">
          <h3>Summary</h3>
          <div className="admin-metrics">
            <article className="v2-metric-pill"><span className="v2-metric-count">{form.currency} {subtotal.toFixed(2)}</span><p className="v2-metric-label">Subtotal</p></article>
            <article className="v2-metric-pill"><span className="v2-metric-count">{form.currency} {total.toFixed(2)}</span><p className="v2-metric-label">Total</p></article>
          </div>
          <div className="admin-form">
            <label>Notes<textarea rows="3" value={form.notes} onChange={(e) => setField("notes", e.target.value)} /></label>
            <label>Terms<textarea rows="3" value={form.terms} onChange={(e) => setField("terms", e.target.value)} /></label>
          </div>
        </section>
      </div>

      <section className="outreach-card outreach-card--wide">
        <div className="pipeline-header"><div><h3>Line items</h3><p>Services, production, retainers, media, or reimbursable costs.</p></div><button className="button button--secondary" type="button" onClick={() => setItems((v) => [...v, blankItem()])}><Plus size={16} /> Add item</button></div>
        <div className="outreach-list">
          {items.map((item, index) => (
            <div className="outreach-list-item" key={index}>
              <div className="admin-form">
                <label>Item<input placeholder="Creative production" value={item.name} onChange={(e) => setItem(index, "name", e.target.value)} /></label>
                <label>Description<input placeholder="Scope or deliverable" value={item.description} onChange={(e) => setItem(index, "description", e.target.value)} /></label>
                <label>Qty<input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => setItem(index, "quantity", e.target.value)} /></label>
                <label>Unit cost<input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => setItem(index, "unit_cost", e.target.value)} /></label>
                {items.length > 1 ? <button className="button button--secondary" type="button" onClick={() => setItems((v) => v.filter((_, i) => i !== index))}><Trash2 size={15} /> Remove</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? <div className="admin-notice" role="alert"><span className="admin-notice__text">{error}</span></div> : null}
      <div className="pipeline-header"><p>PDF generation is handled server-side; the API credential never reaches the browser.</p><button className="button button--primary" type="button" disabled={busy || !form.to || !items.some((item) => item.name)} onClick={generate}><Download size={17} /> {busy ? "Generating…" : "Generate PDF"}</button></div>
    </section>
  );
}
