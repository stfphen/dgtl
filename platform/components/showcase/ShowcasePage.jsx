"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ShowcaseHero from "./sections/ShowcaseHero";
import PackagesCarousel from "./sections/PackagesCarousel";
import VideoWall from "./sections/VideoWall";
import MinuteOfMusic from "./sections/MinuteOfMusic";
import LiveShowcase from "./sections/LiveShowcase";
import AboutSection from "./sections/AboutSection";
import ShortFilms from "./sections/ShortFilms";
import ShowcaseFaq from "./sections/ShowcaseFaq";
import BrandPartnering from "./sections/BrandPartnering";
import JoinTeam from "./sections/JoinTeam";
import styles from "./Showcase.module.css";

const NAV_LINKS = [
  { href: "#packages", label: "Packages" },
  { href: "#videos", label: "Videos" },
  { href: "#minute", label: "Minute of Music" },
  { href: "#faq", label: "FAQ" },
  { href: "#team", label: "Apply" }
];

// The "showcase" tenant template (components/templates/registry.js). Dark
// broadcast look scoped entirely to the module stylesheet; the only theme
// inputs are the two brand colors, set as --sc-* vars inline. The funnel's
// --blue/--accent/--fp-* tokens are never touched.
export default function ShowcasePage({ tenant }) {
  const brand = tenant?.brand || {};
  const footer = tenant?.showcase?.footer || {};
  const sentinelRef = useRef(null);
  const [navSolid, setNavSolid] = useState(false);

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
    "--sc-accent": brand.primaryColor || "#f7d64a",
    "--sc-accent-ink": brand.accentColor || "#0a0a0b"
  };

  return (
    <div className={styles.page} style={themeVars} data-tenant={tenant?.slug}>
      <div className={styles.static} aria-hidden="true" />
      <div
        ref={sentinelRef}
        style={{ position: "absolute", top: 0, height: 1, width: 1 }}
        aria-hidden="true"
      />

      <nav className={`${styles.nav} ${navSolid ? styles.navSolid : ""}`}>
        <div className={styles.navInner}>
          <a className={styles.navBrand} href="#top">
            {brand.logoText || brand.name || "DMTV"}
            <sup>&reg;</sup>
          </a>
          <div className={styles.navLinks}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} className={styles.navLink} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <a className={styles.navCta} href="#minute">
            Submit your minute
          </a>
        </div>
      </nav>

      <main id="top">
        <ShowcaseHero tenant={tenant} />
        <PackagesCarousel tenant={tenant} />
        <VideoWall tenant={tenant} />
        <MinuteOfMusic tenant={tenant} />
        <LiveShowcase tenant={tenant} />
        <AboutSection tenant={tenant} />
        <ShortFilms tenant={tenant} />
        <ShowcaseFaq tenant={tenant} />
        <BrandPartnering tenant={tenant} />
        <JoinTeam tenant={tenant} />
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              <p className={styles.footerBrand}>
                {brand.logoText || brand.name || "DMTV"}
                <sup>&reg;</sup>
              </p>
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
            <span>&copy; {new Date().getFullYear()} {brand.name || "DMTV"}. All rights reserved.</span>
            <span>Toronto, Canada</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
