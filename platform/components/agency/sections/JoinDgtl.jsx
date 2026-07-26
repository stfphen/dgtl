"use client";

import { useState } from "react";
import Reveal from "../../motion/Reveal";
import AgencyLeadForm from "../AgencyLeadForm";
import styles from "../Agency.module.css";

// Team applications: track selector left, one shared form right. The chosen
// track drives the lead category (team-application-<track>) and contactTitle.
export default function JoinDgtl({ tenant }) {
  const join = tenant?.agency?.join;
  const tracks = join?.tracks || [];
  const [activeTrackId, setActiveTrackId] = useState(tracks[0]?.id || "");
  if (!join || !tracks.length) return null;

  const activeTrack = tracks.find((track) => track.id === activeTrackId) || tracks[0];

  return (
    <section className={`${styles.section} ${styles.sectionSunken}`} id="join">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {join.eyebrow && <span className={styles.eyebrow}>{join.eyebrow}</span>}
          <h2 className={styles.h2}>{join.headline || "Join DGTL."}</h2>
          {join.body && <p className={styles.sectionBody}>{join.body}</p>}
        </Reveal>

        <div className={styles.joinGrid}>
          <Reveal className={styles.trackList}>
            {tracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className={`${styles.trackBtn} ${
                  track.id === activeTrack.id ? styles.trackBtnActive : ""
                }`}
                onClick={() => setActiveTrackId(track.id)}
                aria-pressed={track.id === activeTrack.id}
              >
                <span className={styles.trackLabel}>{track.label}</span>
                <p className={styles.trackBlurb}>{track.blurb}</p>
              </button>
            ))}
          </Reveal>

          <Reveal delay={0.1}>
            <h3 className={styles.h2} style={{ fontSize: "clamp(20px, 2.2vw, 28px)" }}>
              {join.form?.headline || "Apply for a role."}
            </h3>
            <AgencyLeadForm
              key={activeTrack.id}
              layout="grid"
              tenant={tenant}
              submitLabel={join.form?.submitCta || "Apply to DGTL"}
              successMessage={`Application received for ${activeTrack.label}. The team reviews every one.`}
              fields={[
                { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
                { name: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com" },
                {
                  name: "url",
                  label: "Portfolio or profile",
                  type: "text",
                  span: true,
                  placeholder: "Reel, site, LinkedIn, or Instagram"
                },
                {
                  name: "notes",
                  label: "Why this lane?",
                  type: "textarea",
                  span: true,
                  placeholder: "What you have shipped, and what you want to ship here."
                }
              ]}
              mapPayload={(values) => ({
                name: values.name,
                email: values.email,
                url: values.url,
                notes: values.notes,
                category: `team-application-${activeTrack.id}`,
                contactTitle: activeTrack.label.toUpperCase()
              })}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
