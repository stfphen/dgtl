"use client";

import Reveal from "../../motion/Reveal";
import AgencyLeadForm from "../AgencyLeadForm";
import styles from "../Agency.module.css";

// The single project-inquiry form on the page. Offer-ladder cards land here
// with their package pre-selected (state lifted to AgencyPage); "Not sure
// yet" submits without a packageId so triage stays honest.
export default function StartProject({ tenant, selectedPackageId }) {
  const start = tenant?.agency?.startProject || {};
  const packages = tenant?.packages || [];

  const packageOptions = [
    ...packages.map((pack) => ({ value: pack.id, label: pack.name })),
    { value: "not-sure", label: "Not sure yet" }
  ];

  return (
    <section className={styles.section} id="start">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          <h2 className={styles.h2}>{start.headline || "Start a project."}</h2>
          {start.body && <p className={styles.sectionBody}>{start.body}</p>}
        </Reveal>
        <Reveal className={styles.startPanel}>
          <AgencyLeadForm
            key={selectedPackageId}
            layout="grid"
            tenant={tenant}
            submitLabel={start.submitCta || "Start a project"}
            successMessage="Received. We reply with a scope, a timeline, and a price."
            defaultValues={{ package: selectedPackageId }}
            fields={[
              {
                name: "package",
                label: "Where do you want to start?",
                type: "select",
                required: true,
                span: true,
                options: packageOptions
              },
              { name: "name", label: "Name", type: "text", required: true, placeholder: "Your name" },
              { name: "email", label: "Email", type: "email", required: true, placeholder: "you@company.com" },
              { name: "business", label: "Business", type: "text", required: true, placeholder: "Company or brand" },
              { name: "phone", label: "Phone", type: "tel", placeholder: "+1" },
              {
                name: "notes",
                label: "What are you trying to grow?",
                type: "textarea",
                span: true,
                placeholder: "The offer, the audience, and what success looks like in 90 days."
              }
            ]}
            mapPayload={(values) => ({
              name: values.name,
              email: values.email,
              business: values.business,
              phone: values.phone,
              category: "project-inquiry",
              notes: values.notes,
              ...(values.package && values.package !== "not-sure"
                ? { packageId: values.package }
                : {})
            })}
          />
        </Reveal>
      </div>
    </section>
  );
}
