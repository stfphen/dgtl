"use client";

import { motion, useReducedMotion } from "framer-motion";
import YouTubeHeroPlayer from "../../YouTubeHeroPlayer";
import styles from "../Showcase.module.css";

// Full-bleed broadcast hero: poster image underneath, the Underground Showcase
// concert looping silently on top (global .hero__video handles sizing and the
// reduced-motion guard), giant wordmark anchored bottom-left.
export default function ShowcaseHero({ tenant }) {
  const reduceMotion = useReducedMotion();
  const brand = tenant?.brand || {};
  const hero = tenant?.hero || {};

  const entrance = (delay) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }
        };

  return (
    <header className={styles.hero}>
      {tenant?.media?.heroImage && (
        <img
          className={styles.heroPoster}
          src={tenant.media.heroImage}
          alt={tenant?.media?.heroAlt || ""}
        />
      )}
      <YouTubeHeroPlayer video={tenant?.media?.heroVideo} />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroContent}>
        <motion.h1 className={styles.heroWordmark} {...entrance(0)}>
          {brand.logoText || brand.name || "DMTV"}
          <sup>&reg;</sup>
        </motion.h1>
        {hero.headline && (
          <motion.p className={styles.heroTagline} {...entrance(0.12)}>
            {hero.headline}
          </motion.p>
        )}
        <motion.div className={styles.heroActions} {...entrance(0.22)}>
          <a className={styles.btnPrimary} href="#minute">
            {hero.primaryCta || "Submit your minute"}
          </a>
          <a className={styles.btnGhost} href="#packages">
            {hero.secondaryCta || "See the packages"}
          </a>
        </motion.div>
      </div>
    </header>
  );
}
