"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Platform.module.css";

// Register → provision → load → live. Numbered by CSS counter (01–04).
export default function PlatformOnboarding({ tenant }) {
  const onboarding = tenant?.platform?.onboarding;
  if (!onboarding) return null;

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`}>
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {onboarding.eyebrow && <span className={styles.eyebrow}>{onboarding.eyebrow}</span>}
          <h2 className={styles.h2}>{onboarding.headline}</h2>
        </Reveal>
        <Stagger className={styles.stepGrid} stagger={0.08}>
          {(onboarding.steps || []).map((step) => (
            <StaggerItem key={step.title} className={styles.step}>
              <h3 className={styles.cardTitle}>{step.title}</h3>
              {step.body && <p className={styles.cardBody}>{step.body}</p>}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
