"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import ShowcaseLeadForm from "../ShowcaseLeadForm";
import styles from "../Showcase.module.css";

const MARQUEE_WORDS = Array.from({ length: 8 }, () => "A Minute of Music");

// The signature series. A kinetic marquee leads the section in, real episode
// reels link out to Instagram (designed cards, not embed.js — IG thumbnails
// can't be hot-linked without an oEmbed token), and the submission form posts
// into the lead pipeline tagged minute-of-music.
export default function MinuteOfMusic({ tenant }) {
  const mom = tenant?.showcase?.minuteOfMusic;
  if (!mom) return null;

  const reels = mom.reels || [];
  const form = mom.form || {};

  return (
    <section className={styles.momSection} id="minute">
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {/* Track is doubled so the -50% keyframe loops seamlessly. */}
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, index) => (
            <span key={index} className={styles.marqueeWord}>
              {word}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.container}>
          <div className={styles.momGrid}>
            <div>
              <Reveal className={styles.sectionHead} style={{ marginBottom: 0 }}>
                {mom.eyebrow && <span className={styles.eyebrow}>{mom.eyebrow}</span>}
                <h2 className={styles.h2}>{mom.headline || "A Minute of Music"}</h2>
                {mom.body && <p className={styles.sectionBody}>{mom.body}</p>}
              </Reveal>
              {reels.length > 0 && (
                <Stagger className={styles.reelGrid} stagger={0.07}>
                  {reels.map((reel, index) => (
                    <StaggerItem
                      key={reel.code}
                      as="a"
                      className={`${styles.reelCard} ${
                        index === 0 ? styles.reelCardAccent : ""
                      }`}
                      href={`https://www.instagram.com/reel/${reel.code}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.reelSeries}>A Minute of Music</span>
                      <span className={styles.reelArtist}>{reel.artist}</span>
                      <span className={styles.reelWatch}>
                        Watch on Instagram
                        <ArrowUpRight size={15} aria-hidden="true" />
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>

            <Reveal className={styles.momFormWrap} delay={0.1}>
              <h3 className={styles.momFormHead}>{form.headline || "Submit your minute."}</h3>
              {form.body && <p className={styles.momFormBody}>{form.body}</p>}
              <ShowcaseLeadForm
                tenant={tenant}
                submitLabel={form.submitCta || "Submit your minute"}
                successMessage="Submission received. The team reviews every track."
                fields={[
                  { name: "name", label: "Artist name", type: "text", required: true, placeholder: "Stage name" },
                  { name: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com" },
                  { name: "handle", label: "Instagram handle", type: "text", required: true, placeholder: "@yourhandle" },
                  { name: "url", label: "Track link", type: "url", required: true, placeholder: "Spotify, SoundCloud, or YouTube link" }
                ]}
                mapPayload={(values) => ({
                  name: values.name,
                  email: values.email,
                  url: values.url,
                  category: "minute-of-music",
                  packageId: "minute-of-music-feature",
                  notes: values.handle ? `Instagram: ${values.handle}` : ""
                })}
              />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
