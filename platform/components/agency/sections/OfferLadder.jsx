"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import Reveal from "../../motion/Reveal";
import styles from "../Agency.module.css";

// Horizontal scroll-snap carousel over the tenant's package ladder. Cards do
// not carry their own inquiry form: selecting one routes to the single
// Start-a-project form with that package pre-filled (state lifted to
// AgencyPage), keeping one CTA per intent page-wide.
export default function OfferLadder({ tenant, onSelect }) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef(null);
  const packages = tenant?.packages || [];
  const section = tenant?.packageSection || {};

  function nudge(direction) {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.min(420, track.clientWidth * 0.8) * direction;
    track.scrollBy({ left: amount, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function selectPackage(id) {
    onSelect?.(id);
    document
      .getElementById("start")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!packages.length) return null;

  return (
    <section className={styles.section} id="offers">
      <div className={styles.container}>
        <Reveal className={styles.carouselHead}>
          <div>
            <h2 className={styles.h2}>{section.headline || "The offer ladder."}</h2>
            {section.body && <p className={styles.sectionBody}>{section.body}</p>}
          </div>
          <div className={styles.carouselArrows}>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => nudge(-1)}
              aria-label="Scroll packages back"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => nudge(1)}
              aria-label="Scroll packages forward"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </Reveal>

        {/* Plain ref'd element (not a motion wrapper) so the arrows can drive
            scrollBy; cards cascade in individually instead. */}
        <div className={styles.track} ref={trackRef}>
          {packages.map((pack, index) => (
            <Reveal
              key={pack.id}
              as="article"
              delay={index * 0.06}
              amount={0.1}
              className={`${styles.packCard} ${pack.featured ? styles.packCardFeatured : ""}`}
            >
              <div>
                <div className={styles.packPrice}>{pack.priceDisplay || pack.price}</div>
                {pack.priceQualifier && (
                  <div className={styles.packQualifier}>{pack.priceQualifier}</div>
                )}
              </div>
              <h3 className={styles.packName}>{pack.name}</h3>
              {pack.summary && <p className={styles.packSummary}>{pack.summary}</p>}
              <ul className={styles.packFeatures}>
                {(pack.features || []).slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.packCta}
                onClick={() => selectPackage(pack.id)}
              >
                Start a project
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
