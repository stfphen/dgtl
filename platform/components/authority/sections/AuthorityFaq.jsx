"use client";

import styles from "../Authority.module.css";

// Single-column long-form FAQ. No grid: on a credibility page the questions
// read as part of the narrative, not as a card wall.
export default function AuthorityFaq({ tenant }) {
  const items = Array.isArray(tenant.faq?.items) ? tenant.faq.items : [];
  if (!items.length) return null;

  return (
    <section className={styles.faq} aria-label="Common questions">
      <h2 className={styles.faqHeading}>{tenant.faq.headline}</h2>
      <dl className={styles.faqList}>
        {items.map((item) => (
          <div className={styles.faqItem} key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
