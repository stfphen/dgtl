"use client";

import Reveal from "../../motion/Reveal";
import VideoFacade from "../VideoFacade";
import styles from "../Showcase.module.css";

// Single-focus band: the Underground Showcase concert, full width, click to
// play. This is the watchable version of the footage looping in the hero.
export default function LiveShowcase({ tenant }) {
  const live = tenant?.showcase?.live;
  if (!live?.videoId) return null;

  return (
    <section className={styles.section} id="live">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{live.headline || "Live"}</h2>
          {live.body && <p className={styles.sectionBody}>{live.body}</p>}
        </Reveal>
        <Reveal delay={0.08}>
          <VideoFacade videoId={live.videoId} title={live.headline} />
          {live.note && <p className={styles.liveCaption}>{live.note}</p>}
        </Reveal>
      </div>
    </section>
  );
}
