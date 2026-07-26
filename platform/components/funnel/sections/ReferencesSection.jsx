"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import { SECTION_VARIANTS } from "../../../lib/tenantBuilder/sectionVariants";
import { MediaImage } from "./shared";

/* ---------------------------------------------------------------------------
 * References — social proof, one section with N compositions.
 * "testimonial-grid" is the pre-variants FunnelPage rendering (testimonial
 * grid plus logo wall), verbatim. Every variant returns null when the tenant
 * has neither testimonials nor logos.
 * ------------------------------------------------------------------------- */

function LogoWall({ references }) {
  return (
    <Reveal as="ul" className="logo-wall" aria-label="Client logos">
      {references.logos.map((logo, index) => {
        const image = (
          <MediaImage src={logo.src} alt={logo.alt || logo.name || "Client logo"} sizes="160px" />
        );
        return (
          <li key={logo.src || index}>
            {logo.link ? (
              <a href={logo.link} target="_blank" rel="noopener noreferrer">
                {image}
              </a>
            ) : (
              image
            )}
          </li>
        );
      })}
    </Reveal>
  );
}

function TestimonialGridReferences({ tenant }) {
  const references = tenant.references;
  const hasTestimonials = Boolean(references?.testimonials?.length);
  const hasLogos = Boolean(references?.logos?.length);
  if (!hasTestimonials && !hasLogos) return null;

  return (
    <section className="section section--soft references" aria-labelledby="references-heading">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          {references.eyebrow ? <p className="eyebrow">{references.eyebrow}</p> : null}
          <h2 id="references-heading">{references.headline}</h2>
        </Reveal>
        {hasTestimonials ? (
          <Stagger className="testimonial-grid" stagger={0.07}>
            {references.testimonials.map((entry, index) => (
              <StaggerItem as="blockquote" className="testimonial" key={`${entry.name}-${index}`}>
                <p>{entry.quote}</p>
                <footer>
                  {entry.name ? <strong>{entry.name}</strong> : null}
                  {entry.role || entry.company ? (
                    <span>{[entry.role, entry.company].filter(Boolean).join(", ")}</span>
                  ) : null}
                </footer>
              </StaggerItem>
            ))}
          </Stagger>
        ) : null}
        {hasLogos ? <LogoWall references={references} /> : null}
      </div>
    </section>
  );
}

/* "logo-wall": logos-first institutional proof (professional services). A
   large uniform logo grid carries the section; at most two short quotes
   support it. No eyebrow: the new variants spend none of the page budget. */
function LogoWallReferences({ tenant }) {
  const references = tenant.references;
  const hasLogos = Boolean(references?.logos?.length);
  const hasTestimonials = Boolean(references?.testimonials?.length);
  if (!hasLogos && !hasTestimonials) return null;

  return (
    <section className="section section--soft references" aria-labelledby="references-heading">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          <h2 id="references-heading">{references.headline}</h2>
        </Reveal>
        {hasLogos ? (
          <Stagger as="ul" className="refs-logos" aria-label="Client logos" stagger={0.05}>
            {references.logos.map((logo, index) => (
              <StaggerItem as="li" key={logo.src || index}>
                <MediaImage src={logo.src} alt={logo.alt || logo.name || "Client logo"} sizes="200px" />
              </StaggerItem>
            ))}
          </Stagger>
        ) : null}
        {hasTestimonials ? (
          <div className="refs-quote-duo">
            {references.testimonials.slice(0, 2).map((entry, index) => (
              <blockquote className="refs-quote" key={`${entry.name}-${index}`}>
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
      </div>
    </section>
  );
}

/* "stat-band": quantified proof (SaaS register). hero.stats set large in the
   display face; while this variant is active the hero suppresses its own
   stats row (see shared.jsx HeroStats) so the numbers live in one place. */
function StatBandReferences({ tenant }) {
  const references = tenant.references;
  const stats = tenant.hero?.stats || [];
  const lead = references?.testimonials?.[0];
  const hasLogos = Boolean(references?.logos?.length);
  if (!stats.length && !lead && !hasLogos) return null;

  return (
    <section className="section references refs-stats" aria-labelledby="references-heading">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          <h2 id="references-heading">{references.headline}</h2>
        </Reveal>
        {stats.length ? (
          <Stagger as="dl" className="refs-stats__band" stagger={0.08} aria-label="Results">
            {stats.map((stat) => (
              <StaggerItem as="div" key={stat.label}>
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        ) : null}
        {lead ? (
          <Reveal as="blockquote" className="refs-stats__quote">
            <p>{lead.quote}</p>
            <footer>
              {lead.name ? <strong>{lead.name}</strong> : null}
              {lead.role || lead.company ? (
                <span>{[lead.role, lead.company].filter(Boolean).join(", ")}</span>
              ) : null}
            </footer>
          </Reveal>
        ) : null}
        {hasLogos ? <LogoWall references={references} /> : null}
      </div>
    </section>
  );
}

/* "case-strip": named-client outcomes as an editorial ledger (agency
   register): one hairline between rows, client identity left, the outcome
   quote right. Distinct family from the card grid. */
function CaseStripReferences({ tenant }) {
  const references = tenant.references;
  const hasTestimonials = Boolean(references?.testimonials?.length);
  const hasLogos = Boolean(references?.logos?.length);
  if (!hasTestimonials && !hasLogos) return null;

  return (
    <section className="section references" aria-labelledby="references-heading">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          <h2 id="references-heading">{references.headline}</h2>
        </Reveal>
        {hasTestimonials ? (
          <Stagger as="ul" className="refs-ledger" stagger={0.06}>
            {references.testimonials.map((entry, index) => (
              <StaggerItem as="li" className="refs-ledger__row" key={`${entry.name}-${index}`}>
                <div className="refs-ledger__who">
                  {entry.name ? <strong>{entry.name}</strong> : null}
                  {entry.role || entry.company ? (
                    <span>{[entry.role, entry.company].filter(Boolean).join(", ")}</span>
                  ) : null}
                </div>
                <blockquote>
                  <p>{entry.quote}</p>
                </blockquote>
              </StaggerItem>
            ))}
          </Stagger>
        ) : null}
        {hasLogos ? <LogoWall references={references} /> : null}
      </div>
    </section>
  );
}

/* "testimonial-editorial": one lead voice set large in the display face
   (local/boutique register), remaining quotes quiet beneath. */
function TestimonialEditorialReferences({ tenant }) {
  const references = tenant.references;
  const testimonials = references?.testimonials || [];
  const hasLogos = Boolean(references?.logos?.length);
  if (!testimonials.length && !hasLogos) return null;
  const [lead, ...support] = testimonials;

  return (
    <section className="section section--soft references" aria-labelledby="references-heading">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          <h2 id="references-heading">{references.headline}</h2>
        </Reveal>
        {lead ? (
          <Reveal as="blockquote" className="refs-editorial__lead">
            <p>{lead.quote}</p>
            <footer>
              {lead.name ? <strong>{lead.name}</strong> : null}
              {lead.role || lead.company ? (
                <span>{[lead.role, lead.company].filter(Boolean).join(", ")}</span>
              ) : null}
            </footer>
          </Reveal>
        ) : null}
        {support.length ? (
          <div className="refs-quote-duo">
            {support.slice(0, 2).map((entry, index) => (
              <blockquote className="refs-quote" key={`${entry.name}-${index}`}>
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
        {hasLogos ? <LogoWall references={references} /> : null}
      </div>
    </section>
  );
}

const VARIANTS = {
  "testimonial-grid": TestimonialGridReferences,
  "logo-wall": LogoWallReferences,
  "stat-band": StatBandReferences,
  "case-strip": CaseStripReferences,
  "testimonial-editorial": TestimonialEditorialReferences
};

export default function ReferencesSection({ tenant, ctx }) {
  const Variant =
    VARIANTS[ctx.design.sectionVariants?.references] ||
    VARIANTS[SECTION_VARIANTS.references.defaultId];
  return <Variant tenant={tenant} ctx={ctx} />;
}
