"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import ShowcaseLeadForm from "../ShowcaseLeadForm";
import styles from "../Showcase.module.css";

// Three application tracks (sales, production, casting) feeding one shared
// form. Picking a track pre-selects the role; the lead is tagged
// team-application-<role> with the role on contactTitle.
export default function JoinTeam({ tenant }) {
  const reduceMotion = useReducedMotion();
  const team = tenant?.showcase?.team;
  const tracks = team?.tracks || [];
  const [selectedTrack, setSelectedTrack] = useState(tracks[0]?.id || "");
  if (!tracks.length) return null;

  const trackById = Object.fromEntries(tracks.map((track) => [track.id, track]));

  function apply(trackId) {
    setSelectedTrack(trackId);
    document
      .getElementById("team-apply")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  return (
    <section className={styles.section} id="team">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {team.eyebrow && <span className={styles.eyebrow}>{team.eyebrow}</span>}
          <h2 className={styles.h2}>{team.headline || "Apply to be a part of DMTV."}</h2>
          {team.body && <p className={styles.sectionBody}>{team.body}</p>}
        </Reveal>

        <Stagger className={styles.trackGrid} stagger={0.08}>
          {tracks.map((track, index) => (
            <StaggerItem
              key={track.id}
              as="article"
              className={`${styles.trackCell} ${index === 0 ? styles.trackCellLead : ""}`}
            >
              <h3 className={styles.trackLabel}>{track.label}</h3>
              <p className={styles.trackBlurb}>{track.blurb}</p>
              <button
                type="button"
                className={styles.trackApply}
                onClick={() => apply(track.id)}
              >
                Apply for this role
              </button>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal id="team-apply">
          <div className={styles.sectionHead} style={{ marginBottom: 28 }}>
            <h3 className={styles.h2} style={{ fontSize: "clamp(24px, 3vw, 34px)" }}>
              {team.form?.headline || "Apply for a role."}
            </h3>
          </div>
          <ShowcaseLeadForm
            key={selectedTrack}
            layout="grid"
            tenant={tenant}
            submitLabel={team.form?.submitCta || "Apply for this role"}
            successMessage="Application received. If it's a fit, the team will be in touch."
            defaultValues={{ role: selectedTrack }}
            fields={[
              {
                name: "role",
                label: "Role",
                type: "select",
                required: true,
                options: tracks.map((track) => ({ value: track.id, label: track.label }))
              },
              { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
              { name: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com" },
              { name: "phone", label: "Phone", type: "tel", placeholder: "+1" },
              {
                name: "url",
                label: "Portfolio or reel link",
                type: "url",
                span: true,
                placeholder: "Website, reel, or social profile"
              },
              {
                name: "notes",
                label: "Why you",
                type: "textarea",
                span: true,
                placeholder: "A few lines on what you'd bring."
              }
            ]}
            mapPayload={(values) => {
              const track = trackById[values.role] || {};
              return {
                name: values.name,
                email: values.email,
                phone: values.phone,
                url: values.url,
                category: `team-application-${values.role || "general"}`,
                contactTitle: (track.label || values.role || "").toUpperCase(),
                notes: values.notes
              };
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}
