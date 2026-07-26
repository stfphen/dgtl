"use client";

import Reveal from "../../motion/Reveal";
import styles from "../Platform.module.css";

// Hero + client-logo marquee. The headline promise is the product: one system
// from first click to paid invoice. Stats are the verified agency trio — the
// platform's proof is that DGTL runs on it. Marquee logos are the bundled
// white brand-kit set served from /assets/brand/logos (never hotlinked);
// the track is duplicated for a seamless -50% loop and parks as a wrapped
// static wall under prefers-reduced-motion.
export default function PlatformHero({ tenant }) {
  const hero = tenant?.hero || {};
  const marquee = tenant?.platform?.marquee || {};
  const logos = marquee.logos || [];
  const stats = hero.stats || [];

  // Split the headline so the closing phrase carries the gold accent:
  // "One system from first click to paid invoice." → gold on "paid invoice."
  const headline = hero.headline || "One system from first click to paid invoice.";
  const goldBreak = headline.lastIndexOf(" paid invoice.");
  const lead = goldBreak > 0 ? headline.slice(0, goldBreak) : headline;
  const gold = goldBreak > 0 ? headline.slice(goldBreak) : "";

  return (
    <header className={styles.hero}>
      <div className={styles.container}>
        <Reveal className={styles.heroInner} y={18}>
          {tenant?.brand?.eyebrow && <span className={styles.eyebrow}>{tenant.brand.eyebrow}</span>}
          <h1 className={styles.heroHeadline}>
            {lead}
            {gold && <span className={styles.heroGold}>{gold}</span>}
          </h1>
          {hero.subheadline && <p className={styles.heroSub}>{hero.subheadline}</p>}
          <div className={styles.heroCtas}>
            <a className={styles.btnPrimary} href="#register">
              {hero.primaryCta || "Register for Access"} →
            </a>
            <a className={styles.btnGhost} href="#system">
              {hero.secondaryCta || "See the System"}
            </a>
          </div>
          {stats.length > 0 && (
            <div className={styles.heroStats}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className={styles.heroStatValue}>{stat.value}</div>
                  <div className={styles.heroStatLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>

      {logos.length > 0 && (
        <div className={styles.marquee} aria-label={marquee.label || "Client logos"}>
          {marquee.label && <p className={styles.marqueeLabel}>{marquee.label}</p>}
          <div className={styles.marqueeTrack}>
            {[...logos, ...logos].map((logo, index) => (
              <img
                key={`${logo.name}-${index}`}
                className={styles.marqueeLogo}
                src={logo.src}
                alt={index < logos.length ? logo.name : ""}
                aria-hidden={index >= logos.length}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
