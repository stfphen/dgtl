"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import styles from "../Showcase.module.css";

// Accordion strips: content categories in production, expanding on hover.
// Imagery is seeded placeholder photography until the team supplies real
// posters/stills (flagged in the project notes).
export default function ShortFilms({ tenant }) {
  const films = tenant?.showcase?.films;
  if (!films) return null;

  const strips = films.strips || [];

  return (
    <section className={styles.section} id="films">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {films.eyebrow && <span className={styles.eyebrow}>{films.eyebrow}</span>}
          <h2 className={styles.h2}>{films.headline || "Short films and such"}</h2>
          {films.body && <p className={styles.sectionBody}>{films.body}</p>}
        </Reveal>
        {strips.length > 0 && (
          <Reveal delay={0.08}>
            <div className={styles.filmRow}>
              {strips.map((strip) => (
                <a
                  key={strip.label}
                  className={styles.filmStrip}
                  href={films.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* TODO: replace seeded placeholders with real DMTV stills. */}
                  <img
                    src={`https://picsum.photos/seed/${strip.seed}/700/1000`}
                    alt=""
                    loading="lazy"
                  />
                  <span className={styles.filmLabel}>{strip.label}</span>
                </a>
              ))}
            </div>
            {films.channelUrl && (
              <a
                className={styles.filmsLink}
                href={films.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                More on YouTube
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            )}
          </Reveal>
        )}
      </div>
    </section>
  );
}
