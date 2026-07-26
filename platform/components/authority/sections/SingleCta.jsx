"use client";

import { useState } from "react";
import styles from "../Authority.module.css";

// The page's one CTA: a lead-capture form posting to the public lead
// pipeline (/api/leads). No package grid, no pricing; the authority
// archetype sells the conversation, and the default package rides along as
// the lead's context.
export default function SingleCta({ tenant }) {
  const [status, setStatus] = useState("idle");
  const [note, setNote] = useState(tenant.checkout.disclaimer || "");

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "sending") return;
    const formEl = event.currentTarget;
    const values = Object.fromEntries(new FormData(formEl).entries());

    setStatus("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          packageId: tenant.defaultPackageId,
          business: values.business,
          name: values.name,
          email: values.email,
          notes: values.notes,
          source: window.location.href,
          sourceType: "authority_page"
        })
      });
      if (!response.ok) throw new Error("lead-failed");
      setStatus("ok");
      setNote("Received. We read every note personally and reply within one business day.");
      formEl.reset();
    } catch {
      setStatus("error");
      setNote("That did not go through. Please try again in a moment.");
    }
  }

  return (
    <section className={styles.cta} id="authority-cta" aria-label="Start a conversation">
      <div className={styles.ctaPanel}>
        <div className={styles.ctaCopy}>
          <p className={styles.ctaEyebrow}>{tenant.checkout.eyebrow}</p>
          <h2 className={styles.ctaTitle}>{tenant.checkout.headline}</h2>
          <p className={styles.ctaBody}>{tenant.checkout.body}</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Business name
            <input className={styles.input} name="business" autoComplete="organization" required />
          </label>
          <label className={styles.field}>
            Name
            <input className={styles.input} name="name" autoComplete="name" required />
          </label>
          <label className={styles.field}>
            Email
            <input className={styles.input} name="email" type="email" autoComplete="email" required />
          </label>
          <label className={styles.field}>
            What are you working toward?
            <textarea className={styles.input} name="notes" rows="4" />
          </label>
          <button
            className={styles.submit}
            type="submit"
            disabled={status === "sending"}
            aria-busy={status === "sending"}
          >
            {status === "sending" ? "Sending..." : tenant.checkout.submitCta}
          </button>
          {note ? (
            <p
              className={`${styles.formNote} ${status === "error" ? styles.formNoteError : ""}`}
              role="status"
              aria-live="polite"
            >
              {note}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
