"use client";

import { Plus } from "lucide-react";
import Reveal from "../../motion/Reveal";
import styles from "../Showcase.module.css";

// Native details/summary accordion — no JS state, keyboard-accessible for free.
export default function ShowcaseFaq({ tenant }) {
  const faq = tenant?.faq;
  const items = faq?.items || [];
  if (!items.length) return null;

  return (
    <section className={styles.section} id="faq">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{faq.headline || "Questions, answered."}</h2>
        </Reveal>
        <Reveal className={styles.faqList} delay={0.06}>
          {items.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>
                {item.question}
                <span className={styles.faqIcon} aria-hidden="true">
                  <Plus size={20} />
                </span>
              </summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
