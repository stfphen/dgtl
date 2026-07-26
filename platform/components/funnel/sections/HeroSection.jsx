"use client";

import { Stagger, StaggerItem } from "../../motion/Stagger";
import YouTubeHeroPlayer from "../../YouTubeHeroPlayer";
import { SECTION_VARIANTS } from "../../../lib/tenantBuilder/sectionVariants";
import { HeroActions, HeroBrandbar, HeroImage, HeroStats } from "./shared";

/* ---------------------------------------------------------------------------
 * Hero — one section, N layout variants picked by ctx.design.sectionVariants
 * (explicit tenant choice > vertical preset > direction heroVariant):
 * full-bleed (default, image-backed), split (light two-column with framed
 * media), typographic (light, type-led, no image). Shared fragments keep the
 * copy/CTA/stats markup identical across variants.
 * ------------------------------------------------------------------------- */

function heroAriaLabel(tenant) {
  return `${tenant.brand.name} sales offer`;
}

function TypographicHero({ tenant, ctx }) {
  return (
    <section className="hero hero--typographic hero--onlight" aria-label={heroAriaLabel(tenant)}>
      <Stagger className="hero__content" stagger={0.1} amount={0.1}>
        <HeroBrandbar tenant={tenant} />
        <StaggerItem as="p" className="eyebrow">{tenant.brand.eyebrow}</StaggerItem>
        <StaggerItem as="h1">{tenant.hero.headline}</StaggerItem>
        <StaggerItem as="p" className="hero__copy">{tenant.hero.subheadline}</StaggerItem>
        <HeroActions tenant={tenant} ctx={ctx} />
        <HeroStats tenant={tenant} ctx={ctx} />
      </Stagger>
    </section>
  );
}

function SplitHero({ tenant, ctx }) {
  return (
    <section className="hero hero--split hero--onlight" aria-label={heroAriaLabel(tenant)}>
      <Stagger className="hero__content" stagger={0.1} amount={0.1}>
        <HeroBrandbar tenant={tenant} />
        <div className="hero__split-grid">
          <div>
            <StaggerItem as="p" className="eyebrow">{tenant.brand.eyebrow}</StaggerItem>
            <StaggerItem as="h1">{tenant.hero.headline}</StaggerItem>
            <StaggerItem as="p" className="hero__copy">{tenant.hero.subheadline}</StaggerItem>
            <HeroActions tenant={tenant} ctx={ctx} />
            <HeroStats tenant={tenant} ctx={ctx} />
          </div>
          {tenant.media.heroImage || tenant.media.heroVideo?.kind ? (
            <StaggerItem className="hero__media-frame">
              <HeroImage tenant={tenant} priority />
              <YouTubeHeroPlayer video={tenant.media.heroVideo} />
            </StaggerItem>
          ) : null}
        </div>
      </Stagger>
    </section>
  );
}

function FullBleedHero({ tenant, ctx }) {
  return (
    <section className="hero" aria-label={heroAriaLabel(tenant)}>
      <HeroImage tenant={tenant} priority />
      {/* Paint order is DOM order: image (poster/LCP) → looping video → shade
          (keeps darkening whichever is visible) → content. */}
      <YouTubeHeroPlayer video={tenant.media.heroVideo} />
      <div className="hero__shade" />
      <Stagger className="hero__content" stagger={0.1} amount={0.1}>
        <HeroBrandbar tenant={tenant} />
        <StaggerItem as="p" className="eyebrow">{tenant.brand.eyebrow}</StaggerItem>
        <StaggerItem as="h1">{tenant.hero.headline}</StaggerItem>
        <StaggerItem as="p" className="hero__copy">{tenant.hero.subheadline}</StaggerItem>
        <HeroActions tenant={tenant} ctx={ctx} />
        <HeroStats tenant={tenant} ctx={ctx} />
      </Stagger>
    </section>
  );
}

const VARIANTS = {
  "full-bleed": FullBleedHero,
  split: SplitHero,
  typographic: TypographicHero
};

export default function HeroSection({ tenant, ctx }) {
  const Variant =
    VARIANTS[ctx.design.sectionVariants?.hero] || VARIANTS[SECTION_VARIANTS.hero.defaultId];
  return <Variant tenant={tenant} ctx={ctx} />;
}
