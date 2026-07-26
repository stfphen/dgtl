"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Platform.module.css";

// Receipts: live production funnels served by this same app (real /t/ links,
// asserted against tenant slugs in tests), plus the 400 Market build-quality
// case and the closing statement line.
export default function PlatformProof({ tenant }) {
  const proof = tenant?.platform?.proof;
  if (!proof) return null;
  const caseStudy = proof.caseStudy;

  return (
    <section className={styles.section} id="proof">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {proof.eyebrow && <span className={styles.eyebrow}>{proof.eyebrow}</span>}
          <h2 className={styles.h2}>{proof.headline}</h2>
          {proof.body && <p className={styles.sectionBody}>{proof.body}</p>}
        </Reveal>

        <Stagger className={styles.proofGrid} stagger={0.08}>
          {(proof.funnels || []).map((funnel) => (
            <StaggerItem key={funnel.name}>
              <a className={styles.funnelCard} href={funnel.href}>
                <span className={styles.funnelLive}>Live on the platform</span>
                <h3 className={styles.funnelName}>{funnel.name}</h3>
                {funnel.blurb && <p className={styles.cardBody}>{funnel.blurb}</p>}
                <span className={styles.funnelOpen}>
                  Open the funnel <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </a>
            </StaggerItem>
          ))}
        </Stagger>

        {caseStudy && (
          <Reveal className={styles.caseCard}>
            {caseStudy.eyebrow && <span className={styles.cardTag}>{caseStudy.eyebrow}</span>}
            <h3 className={styles.funnelName}>{caseStudy.title}</h3>
            {caseStudy.body && <p className={styles.cardBody}>{caseStudy.body}</p>}
            {(caseStudy.stats || []).length > 0 && (
              <div className={styles.caseStats}>
                {caseStudy.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className={styles.caseStatValue}>{stat.value}</div>
                    <div className={styles.caseStatLabel}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        )}

        {proof.statement && (
          <Reveal as="p" className={styles.statement}>
            {proof.statement.includes("your pipeline") ? (
              <>
                {proof.statement.slice(0, proof.statement.indexOf("your pipeline"))}
                <em>your pipeline.</em>
              </>
            ) : (
              proof.statement
            )}
          </Reveal>
        )}
      </div>
    </section>
  );
}
