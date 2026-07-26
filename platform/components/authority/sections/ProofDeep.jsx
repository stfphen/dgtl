"use client";

import styles from "../Authority.module.css";
import { MediaImage } from "../../funnel/sections/shared";

function caseItems(tenant) {
  const items = Array.isArray(tenant.portfolio?.items) ? tenant.portfolio.items : [];
  // Editorial page: still images only. Reels and embeds belong to the funnel
  // and showcase archetypes.
  return items.filter((item) => item?.src && (!item.mediaType || item.mediaType === "image"));
}

// Deep proof, editorial register: named case results with imagery, at most
// three long-form testimonials, and a quiet client-logo row. Renders nothing
// when the tenant has no proof material at all.
export default function ProofDeep({ tenant }) {
  const cases = caseItems(tenant);
  const testimonials = (tenant.references?.testimonials || []).slice(0, 3);
  const logos = tenant.references?.logos || [];
  if (!cases.length && !testimonials.length && !logos.length) return null;

  return (
    <section className={styles.proof} aria-label="Results and references">
      {tenant.portfolio?.headline && cases.length ? (
        <h2 className={styles.proofHeading}>{tenant.portfolio.headline}</h2>
      ) : null}

      {cases.length ? (
        <div className={styles.caseList}>
          {cases.map((item, index) => (
            <article className={styles.caseItem} key={item.id || item.src || index}>
              <div className={styles.caseMedia}>
                <MediaImage
                  src={item.src}
                  alt={item.alt || item.title || "Case study"}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
              </div>
              <div className={styles.caseBody}>
                {item.title ? <h3 className={styles.caseTitle}>{item.title}</h3> : null}
                {item.caption ? <p className={styles.caseCaption}>{item.caption}</p> : null}
                {item.client || item.result ? (
                  <p className={styles.caseMeta}>
                    {item.client ? <span>{item.client}</span> : null}
                    {item.result ? <strong>{item.result}</strong> : null}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {testimonials.length ? (
        <div className={styles.quoteRow}>
          {testimonials.map((entry, index) => (
            <blockquote className={styles.quoteEditorial} key={`${entry.name}-${index}`}>
              <p>{entry.quote}</p>
              <footer>
                {entry.name ? <strong>{entry.name}</strong> : null}
                {entry.role || entry.company ? (
                  <span>{[entry.role, entry.company].filter(Boolean).join(", ")}</span>
                ) : null}
              </footer>
            </blockquote>
          ))}
        </div>
      ) : null}

      {logos.length ? (
        <ul className={styles.logoRow} aria-label="Client logos">
          {logos.map((logo, index) => (
            <li key={logo.src || index}>
              <MediaImage src={logo.src} alt={logo.alt || logo.name || "Client logo"} sizes="140px" />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
