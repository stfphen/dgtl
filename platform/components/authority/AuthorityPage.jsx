"use client";

import { useMemo } from "react";
import { getTenantTheme } from "../../lib/branding";
import { resolveDesign } from "../../lib/tenantBuilder/designDirections";
import AuthorityMasthead from "./sections/AuthorityMasthead";
import NarrativeSection from "./sections/NarrativeSection";
import ProofDeep from "./sections/ProofDeep";
import CredentialsStrip from "./sections/CredentialsStrip";
import AuthorityFaq from "./sections/AuthorityFaq";
import SingleCta from "./sections/SingleCta";
import styles from "./Authority.module.css";

/**
 * The "authority" tenant template (components/templates/registry.js): a
 * conversion-lite, long-form credibility page. Editorial narrative, deep
 * proof, exactly one CTA intent (the closing lead form; the masthead link
 * carries the same label and anchors to it).
 *
 * Reads the standard funnel config sections (brand, hero, problem, system,
 * output, process, portfolio, references, faq, checkout), so every generated
 * tenant can render it with no schema changes. An optional top-level
 * `authority` block ({ narrative: [{ heading, body }], pullQuote, byline })
 * upgrades the derived narrative to purpose-written long-form copy.
 *
 * Theming: consumes the same --fp-* direction tokens as the funnel, applied
 * inline on the page root, with premium-agency-equivalent fallbacks inside
 * Authority.module.css. All five directions restyle this archetype with zero
 * changes to styles.css. Fixed editorial section sequence; sectionOrder and
 * sectionVariants do not apply here (like showcase).
 */
export default function AuthorityPage({ tenant }) {
  const theme = useMemo(() => getTenantTheme(tenant.brand), [tenant.brand]);
  const design = useMemo(() => resolveDesign(tenant.design), [tenant.design]);

  return (
    <div
      className={styles.page}
      style={{ ...theme.vars, ...design.vars }}
      data-tenant={tenant.slug}
      data-direction={design.id}
    >
      <main>
        <AuthorityMasthead tenant={tenant} />
        <NarrativeSection tenant={tenant} />
        <ProofDeep tenant={tenant} />
        <CredentialsStrip tenant={tenant} />
        <AuthorityFaq tenant={tenant} />
        <SingleCta tenant={tenant} />
      </main>
    </div>
  );
}
