"use client";

import Reveal from "../../motion/Reveal";
import PlatformRegisterForm from "../PlatformRegisterForm";
import styles from "../Platform.module.css";

// The single conversion point on the page — every Register CTA lands here.
// Left: the value recap (package features, straight from tenant config so
// copy stays in one place). Right: the access-request form.
export default function PlatformRegister({ tenant }) {
  const register = tenant?.platform?.register || {};
  const accessPackage =
    (tenant?.packages || []).find((pack) => pack.id === tenant?.defaultPackageId) ||
    tenant?.packages?.[0];

  return (
    <section className={styles.section} id="register">
      <div className={styles.container}>
        <Reveal className={styles.sectionHead}>
          {register.eyebrow && <span className={styles.eyebrow}>{register.eyebrow}</span>}
          <h2 className={styles.h2}>{register.headline || "Register your company."}</h2>
          {register.body && <p className={styles.sectionBody}>{register.body}</p>}
        </Reveal>
        <Reveal className={styles.registerPanel}>
          <div>
            <h3 className={styles.cardTitle}>
              {accessPackage?.name || "Platform Access"} — {accessPackage?.priceDisplay || "scoped at onboarding"}
            </h3>
            {accessPackage?.description && (
              <p className={styles.cardBody}>{accessPackage.description}</p>
            )}
            <ul className={styles.registerPoints}>
              {(accessPackage?.features || []).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <PlatformRegisterForm tenant={tenant} content={register} />
        </Reveal>
      </div>
    </section>
  );
}
