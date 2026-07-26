"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import AgencyHero from "./sections/AgencyHero";
import OfferLadder from "./sections/OfferLadder";
import ResultsWall from "./sections/ResultsWall";
import BrandFunnels from "./sections/BrandFunnels";
import GrowthPlatform from "./sections/GrowthPlatform";
import FundingBand from "./sections/FundingBand";
import AboutAgency from "./sections/AboutAgency";
import AgencyFaq from "./sections/AgencyFaq";
import StartProject from "./sections/StartProject";
import JoinDgtl from "./sections/JoinDgtl";
import styles from "./Agency.module.css";

const NAV_LINKS = [
  { href: "#offers", label: "Offers" },
  { href: "#work", label: "Work" },
  { href: "#funnels", label: "Funnels" },
  { href: "#platform", label: "Platform" },
  { href: "#faq", label: "FAQ" },
  { href: "#join", label: "Join" }
];

// The "agency" tenant template (components/templates/registry.js). Dark
// command-center look scoped entirely to the module stylesheet; the only theme
// inputs are the two brand colors, set as --ag-* vars inline. The funnel's
// --blue/--accent/--fp-* tokens are never touched.
//
// Package selection is lifted here: offer-ladder cards route into the single
// Start-a-project form (one CTA per intent, page-wide) with the chosen
// package pre-selected.
export default function AgencyPage({ tenant }) {
  const brand = tenant?.brand || {};
  const footer = tenant?.agency?.footer || {};
  const sentinelRef = useRef(null);
  const [navSolid, setNavSolid] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(
    tenant?.defaultPackageId || tenant?.packages?.[0]?.id || ""
  );

  // Solidify the nav once the top-of-hero sentinel scrolls away. Observer
  // instead of a scroll listener: fires only on the boundary crossing.
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
    "--ag-accent": brand.primaryColor || "#F0CF50",
    "--ag-accent-ink": brand.accentColor || "#0a0a0b"
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
          <a className={styles.navBrand} href="#top" aria-label={brand.name || "DGTL Group"}>
            {brand.logo ? (
              <img className={styles.navLogo} src={brand.logo} alt={brand.name || "DGTL"} />
            ) : (
              brand.logoText || brand.name || "DGTL"
            )}
          </a>
          <div className={styles.navLinks}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} className={styles.navLink} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <a className={styles.navCta} href="#start">
            Start a project
          </a>
        </div>
      </nav>

      <main id="top">
        <AgencyHero tenant={tenant} />
        <OfferLadder tenant={tenant} onSelect={setSelectedPackageId} />
        <ResultsWall tenant={tenant} />
        <BrandFunnels tenant={tenant} />
        <GrowthPlatform tenant={tenant} />
        <FundingBand tenant={tenant} />
        <AboutAgency tenant={tenant} />
        <AgencyFaq tenant={tenant} />
        <StartProject tenant={tenant} selectedPackageId={selectedPackageId} />
        <JoinDgtl tenant={tenant} />
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              {brand.logo ? (
                <img className={styles.footerLogo} src={brand.logo} alt={brand.name || "DGTL"} />
              ) : (
                <p className={styles.funnelName}>{brand.logoText || brand.name || "DGTL"}</p>
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
