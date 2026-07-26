"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import AgencyLeadForm from "../AgencyLeadForm";
import styles from "../Agency.module.css";

// The white-label roster: full-width rows linking to the live tenant pages,
// then the whitelabel-inquiry form. This is the section no competitor can
// copy, so the rows get the widest treatment on the page.
export default function BrandFunnels({ tenant }) {
  const funnels = tenant?.agency?.funnels;
  if (!funnels) return null;

  const roster = funnels.roster || [];
  const form = funnels.form || {};

  return (
    <section className={styles.section} id="funnels">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {funnels.eyebrow && <span className={styles.eyebrow}>{funnels.eyebrow}</span>}
          <h2 className={styles.h2}>{funnels.headline || "Brand funnels we run."}</h2>
          {funnels.body && <p className={styles.sectionBody}>{funnels.body}</p>}
        </Reveal>

        {roster.length > 0 && (
          <div className={styles.funnelRows}>
            {roster.map((funnel, index) => (
              <Reveal
                key={funnel.name}
                as="a"
                delay={index * 0.08}
                className={styles.funnelRow}
                href={funnel.href}
              >
                <h3 className={styles.funnelName}>{funnel.name}</h3>
                <p className={styles.funnelBlurb}>{funnel.blurb}</p>
                <div className={styles.funnelMeta}>
                  {funnel.entryOffer && <span className={styles.funnelOffer}>{funnel.entryOffer}</span>}
                  {funnel.proof && <span className={styles.funnelProof}>{funnel.proof}</span>}
                </div>
                <span className={styles.funnelLinkLabel}>
                  Visit the live page
                  <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className={styles.funnelForm}>
          <h3 className={styles.h2} style={{ fontSize: "clamp(22px, 2.6vw, 32px)" }}>
            {form.headline || "Want your brand run like this?"}
          </h3>
          {form.body && <p className={styles.sectionBody}>{form.body}</p>}
          <AgencyLeadForm
            layout="grid"
            tenant={tenant}
            submitLabel={form.submitCta || "Ask about white-label"}
            successMessage="Received. We will come back with a funnel map and next steps."
            fields={[
              { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
              { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
              { name: "business", label: "Brand", type: "text", required: true, placeholder: "Brand or company name" },
              { name: "url", label: "Website or Instagram", type: "text", placeholder: "brand.com or @handle" },
              {
                name: "notes",
                label: "What should the funnel sell?",
                type: "textarea",
                span: true,
                placeholder: "The offer, the audience, and where sales come from today."
              }
            ]}
            mapPayload={(values) => ({
              name: values.name,
              email: values.email,
              business: values.business,
              url: values.url,
              category: "whitelabel-inquiry",
              notes: values.notes
            })}
          />
        </Reveal>
      </div>
    </section>
  );
}
