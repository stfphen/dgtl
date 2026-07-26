"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import styles from "../Agency.module.css";

// Asymmetric hero: copy left, brand mark right, verified metrics on a rule
// underneath. Typographic on purpose: no work imagery ships until the team
// supplies real stills.
export default function AgencyHero({ tenant }) {
  const brand = tenant?.brand || {};
  const hero = tenant?.hero || {};
  const stats = hero.stats || [];

  return (
    <header className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.heroInner}>
          <Reveal>
            <h1 className={styles.heroHeadline}>{hero.headline}</h1>
            {hero.subheadline && <p className={styles.heroSub}>{hero.subheadline}</p>}
            <div className={styles.heroCtas}>
              <a className={styles.btnPrimary} href="#start">
                {hero.primaryCta || "Start a project"}
              </a>
              <a className={styles.btnGhost} href="#work">
                {hero.secondaryCta || "See the work"}
              </a>
            </div>
          </Reveal>
          {brand.logo && (
            <Reveal className={styles.heroMark} delay={0.15}>
              <img
                className={styles.heroMarkImg}
                src={brand.logo}
                alt={`${brand.name || "DGTL Group"} wordmark`}
              />
            </Reveal>
          )}
        </div>

        {stats.length > 0 && (
          <Stagger className={styles.heroStats} stagger={0.08} as="dl">
            {stats.map((stat) => (
              <StaggerItem key={stat.label} as="div">
                <dt className={styles.heroStatValue}>{stat.value}</dt>
                <dd className={styles.heroStatLabel}>{stat.label}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </header>
  );
}
