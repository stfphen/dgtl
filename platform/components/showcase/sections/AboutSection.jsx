"use client";

import Reveal from "../../motion/Reveal";
import styles from "../Showcase.module.css";

// Editorial stack: manifesto copy, one real frame from the showcase footage
// (a different frame grab than the facades use), and the reach stats.
export default function AboutSection({ tenant }) {
  const about = tenant?.showcase?.about;
  if (!about) return null;

  const liveVideoId = tenant?.showcase?.live?.videoId;
  const stats = about.stats || [];

  return (
    <section className={styles.section} id="about">
      <div className={styles.container}>
        <div className={styles.aboutGrid}>
          <Reveal className={styles.sectionHead} style={{ marginBottom: 0 }}>
            <h2 className={styles.h2}>{about.headline || "Who is DMTV?"}</h2>
          </Reveal>
          <Reveal className={styles.aboutCopy} delay={0.05}>
            {(about.paragraphs || []).map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </Reveal>
          {liveVideoId && (
            <Reveal className={styles.aboutImageWrap} delay={0.1}>
              <img
                className={styles.aboutImage}
                src={`https://img.youtube.com/vi/${liveVideoId}/hq2.jpg`}
                alt="Crowd and stage at a DMTV Underground Showcase in Toronto."
                loading="lazy"
              />
              <div className={styles.aboutImageTint} aria-hidden="true" />
            </Reveal>
          )}
          {stats.length > 0 && (
            <Reveal className={styles.statStrip} delay={0.12}>
              {stats.map((stat) => (
                <div key={stat.label} className={styles.stat}>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
