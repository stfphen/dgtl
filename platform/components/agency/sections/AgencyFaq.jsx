"use client";

import { Plus } from "lucide-react";
import Reveal from "../../motion/Reveal";
import styles from "../Agency.module.css";

// Native <details> accordion over the tenant's faq items (funnel-schema
// field, shared with every other template).
export default function AgencyFaq({ tenant }) {
  const faq = tenant?.faq || {};
  const items = faq.items || [];
  if (!items.length) return null;

  return (
    <section className={styles.section} id="faq">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{faq.headline || "Questions, answered."}</h2>
        </Reveal>
        <Reveal className={styles.faqList}>
          {items.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>
                {item.question}
                <Plus className={styles.faqIcon} size={18} aria-hidden="true" />
              </summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
