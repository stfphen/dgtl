"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Platform.module.css";

// The product: six modules, presented as tagged feature cards. This is the
// "what you get" section a software buyer scans first — id="platform" so the
// nav lands here.
export default function PlatformPillars({ tenant }) {
  const pillars = tenant?.platform?.pillars;
  if (!pillars) return null;

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`} id="platform">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {pillars.eyebrow && <span className={styles.eyebrow}>{pillars.eyebrow}</span>}
          <h2 className={styles.h2}>{pillars.headline}</h2>
          {pillars.body && <p className={styles.sectionBody}>{pillars.body}</p>}
        </Reveal>
        <Stagger className={styles.cardGrid} stagger={0.06}>
          {(pillars.items || []).map((item) => (
            <StaggerItem key={item.title} className={`${styles.card} ${styles.cardHover}`}>
              {item.tag && <span className={styles.cardTag}>{item.tag}</span>}
              <h3 className={styles.cardTitle}>{item.title}</h3>
              {item.body && <p className={styles.cardBody}>{item.body}</p>}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
