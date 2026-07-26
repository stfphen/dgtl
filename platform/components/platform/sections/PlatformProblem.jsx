"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Platform.module.css";

// The pain framing for a B2B software buyer: growth run across disconnected
// tools. Four cards, one leak each.
export default function PlatformProblem({ tenant }) {
  const problem = tenant?.platform?.problem;
  if (!problem) return null;

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {problem.eyebrow && <span className={styles.eyebrow}>{problem.eyebrow}</span>}
          <h2 className={styles.h2}>{problem.headline}</h2>
          {problem.body && <p className={styles.sectionBody}>{problem.body}</p>}
        </Reveal>
        <Stagger className={styles.cardGrid} stagger={0.07}>
          {(problem.points || []).map((point) => (
            <StaggerItem key={point.title} className={`${styles.card} ${styles.cardHover}`}>
              <h3 className={styles.cardTitle}>{point.title}</h3>
              {point.body && <p className={styles.cardBody}>{point.body}</p>}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
