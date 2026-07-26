"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Platform.module.css";

// The centerpiece: the pipeline drawn as a gold rail — a stranger becoming
// revenue, stage by stage. Ordered list semantics; each stage is a node on
// the line.
export default function PlatformSystem({ tenant }) {
  const rail = tenant?.platform?.rail;
  if (!rail) return null;

  return (
    <section className={styles.section} id="system">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {rail.eyebrow && <span className={styles.eyebrow}>{rail.eyebrow}</span>}
          <h2 className={styles.h2}>{rail.headline}</h2>
          {rail.body && <p className={styles.sectionBody}>{rail.body}</p>}
        </Reveal>

        <Stagger className={styles.rail} as="ol" stagger={0.08}>
          {(rail.steps || []).map((step) => (
            <StaggerItem key={step.title} as="li" className={styles.railItem}>
              <h3 className={styles.railTitle}>{step.title}</h3>
              {step.body && <p className={styles.railBody}>{step.body}</p>}
            </StaggerItem>
          ))}
        </Stagger>

        {rail.footnote && <p className={styles.railFoot}>{rail.footnote}</p>}
      </div>
    </section>
  );
}
