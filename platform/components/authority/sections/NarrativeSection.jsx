"use client";

import styles from "../Authority.module.css";

function deriveChapters(tenant) {
  const chapters = [];
  if (tenant.problem?.headline) {
    chapters.push({
      heading: tenant.problem.headline,
      paragraphs: Array.isArray(tenant.problem.points) ? tenant.problem.points : []
    });
  }
  if (tenant.system?.headline) {
    chapters.push({
      heading: tenant.system.headline,
      paragraphs: tenant.system.body ? [tenant.system.body] : []
    });
  }
  if (tenant.output?.headline) {
    chapters.push({
      heading: tenant.output.headline,
      paragraphs: tenant.output.body ? [tenant.output.body] : [],
      // The body copy typically points at these ("what you receive"); without
      // them the chapter dangles on a promise.
      items: Array.isArray(tenant.output.tiles) ? tenant.output.tiles : []
    });
  }
  return chapters;
}

// Long-form editorial narrative. Purpose-written chapters come from the
// optional authority.narrative block; without it the chapters derive from the
// funnel's problem/system/output copy so every tenant renders a full page.
// A single pull quote (authority.pullQuote, else the strongest testimonial)
// breaks the prose after the first chapter.
export default function NarrativeSection({ tenant }) {
  const authored = Array.isArray(tenant.authority?.narrative)
    ? tenant.authority.narrative
        .filter((chapter) => chapter?.heading && chapter?.body)
        .map((chapter) => ({ heading: chapter.heading, paragraphs: [chapter.body] }))
    : [];
  const chapters = authored.length ? authored : deriveChapters(tenant);
  if (!chapters.length) return null;

  const firstTestimonial = tenant.references?.testimonials?.[0];
  const pullQuote = tenant.authority?.pullQuote || firstTestimonial?.quote || "";
  const pullQuoteAttr = tenant.authority?.pullQuote
    ? ""
    : [firstTestimonial?.name, firstTestimonial?.company].filter(Boolean).join(", ");

  return (
    <section className={styles.narrative} aria-label="Our story">
      {chapters.map((chapter, index) => (
        <article className={styles.chapter} key={chapter.heading}>
          <h2 className={styles.chapterHeading}>{chapter.heading}</h2>
          <div className={styles.prose}>
            {chapter.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {chapter.items?.length ? (
            <ul className={styles.chapterList}>
              {chapter.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {index === 0 && pullQuote ? (
            <blockquote className={styles.pullQuote}>
              <p>{pullQuote}</p>
              {pullQuoteAttr ? <footer>{pullQuoteAttr}</footer> : null}
            </blockquote>
          ) : null}
        </article>
      ))}
    </section>
  );
}
