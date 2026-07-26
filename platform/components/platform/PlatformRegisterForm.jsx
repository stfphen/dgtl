"use client";

import { useState } from "react";
import styles from "./Platform.module.css";

// Registration = access request. Submissions ride the existing public lead
// pipeline (/api/leads → sanitizePublicLeadInput): tagging lives on fields
// that survive the sanitizer — category "platform-registration" and packageId
// "platform-access" — so registrations land staged and filterable next to
// every other lead, not in a second inbox. Same mechanics as the agency
// template's lead form; duplicated (not shared) so each template owns its
// markup and stylesheet.
export default function PlatformRegisterForm({ tenant, content }) {
  const [status, setStatus] = useState("idle");
  const [note, setNote] = useState("");

  const submitCta = content?.submitCta || "Register";
  const successMessage =
    content?.successMessage || "Registered. We'll reach out with onboarding details.";

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
        name: values.name,
        email: values.email,
        business: values.business,
        website: values.website,
        notes: values.notes,
        category: "platform-registration",
        packageId: tenant?.defaultPackageId || "platform-access"
      };
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("register-failed");
      setStatus("ok");
      setNote(successMessage);
      formEl.reset();
    } catch {
      setStatus("error");
      setNote("That didn't go through. Try again, or reach us at dgtlgroup.io/contact.");
    }
  }

  return (
    <form className={styles.formGrid} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pf-name">
          Name
        </label>
        <input
          className={styles.input}
          id="pf-name"
          name="name"
          type="text"
          required
          placeholder="Your name"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pf-email">
          Work email
        </label>
        <input
          className={styles.input}
          id="pf-email"
          name="email"
          type="email"
          required
          placeholder="you@company.com"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pf-business">
          Company
        </label>
        <input
          className={styles.input}
          id="pf-business"
          name="business"
          type="text"
          required
          placeholder="Company or brand"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="pf-website">
          Website (optional)
        </label>
        <input
          className={styles.input}
          id="pf-website"
          name="website"
          type="url"
          placeholder="https://"
        />
      </div>
      <div className={`${styles.field} ${styles.fieldSpan}`}>
        <label className={styles.label} htmlFor="pf-notes">
          What do you sell? (optional)
        </label>
        <textarea
          className={styles.input}
          id="pf-notes"
          name="notes"
          rows={3}
          placeholder="The offer, the audience, and what growth looks like in 90 days."
        />
      </div>
      <button type="submit" className={styles.formSubmit} disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : `${submitCta} →`}
      </button>
      {note && (
        <p
          className={`${styles.formNote} ${status === "error" ? styles.formNoteError : ""}`}
          role="status"
        >
          {note}
        </p>
      )}
      {content?.footnote && <p className={styles.formFootnote}>{content.footnote}</p>}
    </form>
  );
}
