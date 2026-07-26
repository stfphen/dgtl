"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Agency.module.css";

// The operating system behind every engagement, drawn as a single vertical
// rail: each stage is a node on the line, in pipeline order.
export default function GrowthPlatform({ tenant }) {
  const platform = tenant?.agency?.platform;
  if (!platform) return null;

  return (
    <section className={styles.section} id="platform">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{platform.headline || "The Growth Platform."}</h2>
          {platform.body && <p className={styles.sectionBody}>{platform.body}</p>}
        </Reveal>

        <Stagger className={styles.railList} as="ol" stagger={0.07}>
          {(platform.steps || []).map((step) => (
            <StaggerItem key={step.title} as="li" className={styles.railItem}>
              <h3 className={styles.railTitle}>{step.title}</h3>
              {step.body && <p className={styles.railBody}>{step.body}</p>}
            </StaggerItem>
          ))}
        </Stagger>

        {platform.footnote && <p className={styles.railFoot}>{platform.footnote}</p>}
      </div>
    </section>
  );
}
