"use client";

import Reveal from "../../motion/Reveal";
import styles from "../Agency.module.css";

// Studio story split: narrative left, the office ledger right.
export default function AboutAgency({ tenant }) {
  const about = tenant?.agency?.about;
  if (!about) return null;

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`} id="about">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{about.headline || "Built in Toronto."}</h2>
        </Reveal>
        <div className={styles.aboutGrid}>
          <Reveal className={styles.aboutParas}>
            {(about.paragraphs || []).map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </Reveal>
          <Reveal className={styles.aboutSide} delay={0.1}>
            {(about.offices || []).map((office, index) => (
              <div key={office} className={styles.aboutOffice}>
                <span>{office}</span>
                {index === 0 && <span className={styles.aboutOfficeNote}>DGTL Studio</span>}
              </div>
            ))}
            {about.since && (
              <div className={styles.aboutOffice}>
                <span>Operating since</span>
                <span className={styles.aboutOfficeNote}>{about.since}</span>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
