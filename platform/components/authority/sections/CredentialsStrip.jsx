"use client";

import styles from "../Authority.module.css";

// Method as credential: the engagement process rendered as a numbered
// editorial list. Process transparency is itself the trust device on a
// credibility page (see docs/design-research/professional-services-b2b.md).
export default function CredentialsStrip({ tenant }) {
  const steps = Array.isArray(tenant.process?.steps) ? tenant.process.steps : [];
  if (!steps.length) return null;

  return (
    <section className={styles.credentials} aria-label="How an engagement runs">
      <h2 className={styles.credHeading}>{tenant.process.headline}</h2>
      <ol className={styles.credList}>
        {steps.map((step, index) => (
          <li className={styles.credItem} key={step.title}>
            <span className={styles.credIndex} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
