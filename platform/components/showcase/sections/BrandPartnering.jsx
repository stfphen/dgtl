"use client";

import Reveal from "../../motion/Reveal";
import ShowcaseLeadForm from "../ShowcaseLeadForm";
import styles from "../Showcase.module.css";

// Tonal band with a compact inline inquiry form. Submissions land in the lead
// pipeline tagged brand-partnership against the activation package.
export default function BrandPartnering({ tenant }) {
  const partnering = tenant?.showcase?.partnering;
  if (!partnering) return null;

  return (
    <section className={styles.partnerBand} id="partner">
      <div className={styles.section}>
        <div className={styles.container}>
          <Reveal className={styles.sectionHead}>
            <h2 className={styles.h2}>{partnering.headline || "Brand partnering"}</h2>
            {partnering.body && <p className={styles.sectionBody}>{partnering.body}</p>}
          </Reveal>
          <Reveal className={styles.partnerForm} delay={0.08}>
            <ShowcaseLeadForm
              layout="inline"
              tenant={tenant}
              submitLabel={partnering.form?.submitCta || "Start a partnership"}
              successMessage="Inquiry received. The team will reach out to scope the campaign."
              fields={[
                { name: "business", label: "Company", type: "text", required: true, placeholder: "Brand or agency" },
                { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
                { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
                {
                  name: "budget",
                  label: "Budget range",
                  type: "select",
                  required: true,
                  options: [
                    { value: "Under $10K", label: "Under $10K" },
                    { value: "$10K to $25K", label: "$10K to $25K" },
                    { value: "$25K+", label: "$25K+" }
                  ]
                }
              ]}
              mapPayload={(values) => ({
                business: values.business,
                name: values.name,
                email: values.email,
                category: "brand-partnership",
                packageId: "custom-brand-activation",
                notes: values.budget ? `Budget: ${values.budget}` : ""
              })}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
