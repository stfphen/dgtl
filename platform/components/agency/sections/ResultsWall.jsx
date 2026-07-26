"use client";

import Reveal from "../../motion/Reveal";
import styles from "../Agency.module.css";

// Selected work: two quantified case-study panels, then a single marquee of
// verified artist and brand names (the one moving strip on the page). Every
// number and name comes from the tenant config; nothing is invented here.
export default function ResultsWall({ tenant }) {
  const results = tenant?.agency?.results;
  if (!results) return null;

  const caseStudies = results.caseStudies || [];
  const names = [...(results.artists || []), ...(results.brands || [])];

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`} id="work">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{results.headline || "Selected work and results."}</h2>
          {results.body && <p className={styles.sectionBody}>{results.body}</p>}
        </Reveal>

        {caseStudies.length > 0 && (
          <div className={styles.caseGrid}>
            {caseStudies.map((study, index) => (
              <Reveal key={study.name} as="article" delay={index * 0.1} className={styles.caseCard}>
                <h3 className={styles.caseName}>{study.name}</h3>
                {study.blurb && <p className={styles.caseBlurb}>{study.blurb}</p>}
                <div className={styles.caseStats}>
                  {(study.stats || []).map((stat) => (
                    <div key={stat.label}>
                      <div className={styles.caseStatValue}>{stat.value}</div>
                      <div className={styles.caseStatLabel}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {names.length > 0 && (
          <div className={styles.marquee}>
            <div className={styles.marqueeTrack}>
              {names.map((name) => (
                <span key={name} className={styles.marqueeItem}>
                  {name}
                </span>
              ))}
              {/* Duplicate run makes the -50% translate loop seamless. */}
              {names.map((name) => (
                <span key={`${name}-dup`} className={styles.marqueeItem} aria-hidden="true">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {results.alsoNamed && <p className={styles.alsoNamed}>{results.alsoNamed}</p>}
      </div>
    </section>
  );
}
