"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "../../motion/Reveal";
import AgencyLeadForm from "../AgencyLeadForm";
import styles from "../Agency.module.css";

// Funding cross-sell band pointing at the Funded Growth Studio. The framing
// is compliance-safe on purpose: interest capture plus the free Fit Scan,
// never an eligibility or approval claim.
export default function FundingBand({ tenant }) {
  const funding = tenant?.agency?.funding;
  if (!funding) return null;

  return (
    <section className={`${styles.section} ${styles.fundingBand}`} id="funding">
      <div className={styles.container}>
        <div className={styles.fundingInner}>
          <Reveal>
            <h2 className={styles.h2}>
              {funding.headline || "Could funding help pay for your next growth project?"}
            </h2>
            {funding.body && <p className={styles.sectionBody}>{funding.body}</p>}
            {funding.href && (
              <a className={styles.fundingLink} href={funding.href}>
                {funding.linkLabel || "Visit the Funded Growth Studio"}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            )}
          </Reveal>
          <Reveal delay={0.1}>
            <AgencyLeadForm
              layout="stack"
              tenant={tenant}
              submitLabel={funding.form?.submitCta || "Check your funding fit"}
              successMessage="Received. The funding desk will follow up about your free Fit Scan."
              fields={[
                { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
                { name: "email", label: "Email", type: "email", required: true, placeholder: "you@company.com" },
                { name: "business", label: "Business", type: "text", required: true, placeholder: "Company name" }
              ]}
              mapPayload={(values) => ({
                name: values.name,
                email: values.email,
                business: values.business,
                category: "funding-interest",
                packageId: "funding-fit-scan"
              })}
            />
            {funding.disclaimer && <p className={styles.fundingDisclaimer}>{funding.disclaimer}</p>}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
