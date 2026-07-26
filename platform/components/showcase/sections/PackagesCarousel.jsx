"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import ShowcaseLeadForm from "../ShowcaseLeadForm";
import styles from "../Showcase.module.css";

// Horizontal scroll-snap carousel over the tenant's package ladder, with a
// compact inquiry strip underneath. Selecting a card pre-fills the strip's
// package select and scrolls to it.
export default function PackagesCarousel({ tenant }) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef(null);
  const packages = tenant?.packages || [];
  const [selectedId, setSelectedId] = useState(
    tenant?.defaultPackageId || packages[0]?.id || ""
  );
  const section = tenant?.packageSection || {};
  const checkout = tenant?.checkout || {};

  function nudge(direction) {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.min(420, track.clientWidth * 0.8) * direction;
    track.scrollBy({ left: amount, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function selectPackage(id) {
    setSelectedId(id);
    document
      .getElementById("package-inquiry")
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  if (!packages.length) return null;

  return (
    <section className={styles.section} id="packages">
      <div className={styles.container}>
        <Reveal className={styles.carouselHead}>
          <div>
            <h2 className={styles.h2}>{section.headline || "Content packages"}</h2>
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

        <Stagger className={styles.track} stagger={0.06} amount={0.1}>
          {packages.map((pack) => (
            <StaggerItem
              key={pack.id}
              as="article"
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
                Request this package
              </button>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className={styles.packInquiry} id="package-inquiry">
          <div className={styles.sectionHead}>
            <h3 className={styles.h2} style={{ fontSize: "clamp(24px, 3vw, 34px)" }}>
              {checkout.headline || "Tell us which package fits."}
            </h3>
            {checkout.body && <p className={styles.sectionBody}>{checkout.body}</p>}
          </div>
          <ShowcaseLeadForm
            key={selectedId}
            layout="inline"
            tenant={tenant}
            submitLabel="Request this package"
            successMessage="Request received. The team will follow up with scope and timeline."
            defaultValues={{ package: selectedId }}
            fields={[
              {
                name: "package",
                label: "Package",
                type: "select",
                required: true,
                options: packages.map((pack) => ({ value: pack.id, label: pack.name }))
              },
              { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
              { name: "email", label: "Email", type: "email", required: true, placeholder: "you@label.com" },
              { name: "notes", label: "Notes", type: "text", placeholder: "Artist, label, or brand?" }
            ]}
            mapPayload={(values) => ({
              name: values.name,
              email: values.email,
              category: "package-inquiry",
              packageId: values.package,
              notes: values.notes
            })}
          />
        </Reveal>
      </div>
    </section>
  );
}
