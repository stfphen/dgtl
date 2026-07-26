"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import PlatformHero from "./sections/PlatformHero";
import PlatformProblem from "./sections/PlatformProblem";
import PlatformPillars from "./sections/PlatformPillars";
import PlatformSystem from "./sections/PlatformSystem";
import PlatformOnboarding from "./sections/PlatformOnboarding";
import PlatformProof from "./sections/PlatformProof";
import PlatformFaq from "./sections/PlatformFaq";
import PlatformRegister from "./sections/PlatformRegister";
import styles from "./Platform.module.css";

// The "platform" tenant template (components/templates/registry.js): the
// marketing-first funnel for the DGTL Growth Platform itself, positioned as
// white-label B2B software with a Register (access-request) flow. Dark
// brand-kit look scoped entirely to the module stylesheet; the only theme
// inputs are the two brand colors, set as --pf-* vars inline. Content comes
// from the tenant's top-level `platform` block (lib/tenants/dgtlPlatform.js),
// read defensively throughout — the block is seed-authored, never public
// input.
export default function PlatformPage({ tenant }) {
  const brand = tenant?.brand || {};
  const content = tenant?.platform || {};
  const footer = content.footer || {};
  const navLinks = content.nav || [];
  const sentinelRef = useRef(null);
  const [navSolid, setNavSolid] = useState(false);

  // Solidify the nav once the top-of-hero sentinel scrolls away — boundary
  // observer instead of a scroll listener (same pattern as AgencyPage).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setNavSolid(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const themeVars = {
    "--pf-accent": brand.primaryColor || "#F0CF50",
    "--pf-accent-ink": brand.accentColor || "#000000"
  };

  return (
    <div className={styles.page} style={themeVars} data-tenant={tenant?.slug}>
      <div
        ref={sentinelRef}
        style={{ position: "absolute", top: 0, height: 1, width: 1 }}
        aria-hidden="true"
      />

      <nav className={`${styles.nav} ${navSolid ? styles.navSolid : ""}`}>
        <div className={styles.navInner}>
          <a className={styles.navBrand} href="#top" aria-label={brand.name || "DGTL Growth Platform"}>
            {brand.logo ? (
              <img className={styles.navLogo} src={brand.logo} alt={brand.logoText || "DGTL"} />
            ) : (
              brand.logoText || "DGTL"
            )}
            <span className={styles.navWordmark}>Growth Platform</span>
          </a>
          <div className={styles.navLinks}>
            {navLinks.map((link) => (
              <a key={link.href} className={styles.navLink} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <a className={styles.navCta} href="#register">
            Register →
          </a>
        </div>
      </nav>

      <main id="top">
        <PlatformHero tenant={tenant} />
        <PlatformProblem tenant={tenant} />
        <PlatformPillars tenant={tenant} />
        <PlatformSystem tenant={tenant} />
        <PlatformOnboarding tenant={tenant} />
        <PlatformProof tenant={tenant} />
        <PlatformFaq tenant={tenant} />
        <PlatformRegister tenant={tenant} />
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              {brand.logo ? (
                <img className={styles.footerLogo} src={brand.logo} alt={brand.logoText || "DGTL"} />
              ) : (
                <p className={styles.funnelName}>{brand.logoText || "DGTL"}</p>
              )}
              {footer.blurb && <p className={styles.footerBlurb}>{footer.blurb}</p>}
            </div>
            <div className={styles.footerLinks}>
              {(footer.links || []).map((link) => (
                <a
                  key={link.label}
                  className={styles.footerLink}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <div className={styles.footerFine}>
            <span>
              &copy; {new Date().getFullYear()} DGTL Group Holdings Limited. All rights reserved.
            </span>
            <span>Toronto, Canada</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
