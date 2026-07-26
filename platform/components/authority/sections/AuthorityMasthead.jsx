"use client";

import styles from "../Authority.module.css";

// Restrained opening block: brand line, one editorial headline, the lede, and
// a single anchor to the closing form. The anchor reuses the form's own CTA
// label so the page carries exactly one CTA intent.
export default function AuthorityMasthead({ tenant }) {
  return (
    <header className={styles.masthead} aria-label={`${tenant.brand.name} introduction`}>
      <div className={styles.mastheadBrand}>
        {tenant.brand.logo ? (
          <img className={styles.mastheadLogo} src={tenant.brand.logo} alt={`${tenant.brand.name} logo`} />
        ) : (
          <span className={styles.mastheadWordmark}>{tenant.brand.logoText || tenant.brand.name}</span>
        )}
      </div>
      <p className={styles.mastheadEyebrow}>{tenant.brand.eyebrow}</p>
      <h1 className={styles.mastheadTitle}>{tenant.hero.headline}</h1>
      <p className={styles.mastheadLede}>{tenant.hero.subheadline}</p>
      {tenant.authority?.byline || tenant.brand.tagline ? (
        <p className={styles.mastheadByline}>{tenant.authority?.byline || tenant.brand.tagline}</p>
      ) : null}
      <a className={styles.mastheadCta} href="#authority-cta">
        {tenant.checkout.submitCta}
      </a>
    </header>
  );
}
