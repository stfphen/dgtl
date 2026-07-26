"use client";

import { useState } from "react";
import styles from "./Agency.module.css";

/**
 * Shared lead form for the agency template. Every submission goes through the
 * existing public lead pipeline (/api/leads); tagging rides on the fields that
 * survive sanitizePublicLeadInput (category, packageId, contactTitle, notes),
 * assembled by the caller's mapPayload(values).
 *
 * fields: [{ name, label, type, required, placeholder, options, span }]
 *   type: text | email | tel | url | select | textarea
 *   span: true stretches the field across the full row.
 * layout: "stack" (one column) | "grid" (two columns) | "inline" (compact row).
 */
export default function AgencyLeadForm({
  fields,
  submitLabel,
  successMessage,
  tenant,
  mapPayload,
  layout = "stack",
  defaultValues = {}
}) {
  const [status, setStatus] = useState("idle");
  const [note, setNote] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "sending") return;
    const formEl = event.currentTarget;
    const values = Object.fromEntries(new FormData(formEl).entries());

    setStatus("sending");
    setNote("");
    try {
      const payload = {
        tenantId: tenant?.id,
        tenantSlug: tenant?.slug,
        source: window.location.href,
        ...mapPayload(values)
      };
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("lead-failed");
      setStatus("ok");
      setNote(successMessage);
      formEl.reset();
    } catch {
      setStatus("error");
      setNote("That didn't go through. Try again, or reach us on Instagram @dgtlgroup.io.");
    }
  }

  function renderField(field) {
    const { name, label, type = "text", required, placeholder, options, span } = field;
    const id = `ag-${name}-${label.replace(/\s+/g, "-").toLowerCase()}`;
    const common = { id, name, required, placeholder, className: styles.input };
    return (
      <div key={name} className={`${styles.field} ${span ? styles.fieldSpan : ""}`}>
        <label className={styles.label} htmlFor={id}>
          {label}
          {!required && " (optional)"}
        </label>
        {type === "select" ? (
          <select {...common} defaultValue={defaultValues[name] ?? options?.[0]?.value}>
            {(options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea {...common} rows={3} defaultValue={defaultValues[name] ?? ""} />
        ) : (
          <input {...common} type={type} defaultValue={defaultValues[name] ?? ""} />
        )}
      </div>
    );
  }

  const layoutClass =
    layout === "inline" ? styles.formInline : layout === "grid" ? styles.formGrid : styles.form;

  return (
    <form className={layoutClass} onSubmit={handleSubmit}>
      {fields.map(renderField)}
      <button type="submit" className={styles.formSubmit} disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : submitLabel}
      </button>
      {note && (
        <p
          className={`${styles.formNote} ${status === "error" ? styles.formNoteError : ""}`}
          role="status"
        >
          {note}
        </p>
      )}
    </form>
  );
}
