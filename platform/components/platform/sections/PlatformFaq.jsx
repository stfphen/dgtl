"use client";

import Reveal from "../../motion/Reveal";
import styles from "../Platform.module.css";

// Native <details> accordion — no JS state, keyboard-accessible for free.
export default function PlatformFaq({ tenant }) {
  const faq = tenant?.platform?.faq;
  if (!faq) return null;

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`} id="faq">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <span className={styles.eyebrow}>FAQ</span>
          <h2 className={styles.h2}>{faq.headline || "Straight answers."}</h2>
        </Reveal>
        <Reveal className={styles.faqList}>
          {(faq.items || []).map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>{item.question}</summary>
              <p className={styles.faqBody}>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
