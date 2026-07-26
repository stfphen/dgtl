"use client";

import Image from "next/image";
import { StaggerItem } from "../../motion/Stagger";

// Same rule as the hero image: local "/"-prefixed assets go through next/image
// (resized WebP/AVIF); remote tenant URLs fall back to a plain <img> so the
// image optimizer isn't opened to arbitrary hosts.
export function MediaImage({ src, alt, className, sizes }) {
  if (src?.startsWith("/")) {
    return <Image className={className} src={src} alt={alt} fill sizes={sizes} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt={alt} loading="lazy" decoding="async" />
  );
}

export function HeroBrandbar({ tenant }) {
  return (
    <StaggerItem className="brandbar">
      {tenant.brand.logo ? (
        <img className="brandbar__logo" src={tenant.brand.logo} alt={`${tenant.brand.name} logo`} />
      ) : (
        <span className="brandbar__wordmark">{tenant.brand.logoText || tenant.brand.name}</span>
      )}
      {tenant.brand.tagline ? <span className="brandbar__tagline">{tenant.brand.tagline}</span> : null}
      <a className="button button--secondary brandbar__login" href="/admin">Log in</a>
    </StaggerItem>
  );
}

export function HeroActions({ tenant, ctx }) {
  return (
    <StaggerItem className="hero__actions">
      <button className="button button--primary" onClick={() => ctx.selectPackage(tenant.defaultPackageId)}>
        {tenant.hero.primaryCta}
      </button>
      <button
        className="button button--secondary"
        onClick={() => document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" })}
      >
        {tenant.hero.secondaryCta}
      </button>
      {!ctx.isFundingTenant && tenant.fundingPromo?.enabled ? (
        <a className="button button--secondary" href={tenant.fundingPromo.link}>
          {tenant.fundingPromo.cta}
        </a>
      ) : null}
    </StaggerItem>
  );
}

export function HeroStats({ tenant, ctx }) {
  if (!tenant.hero.stats?.length) return null;
  // When the references section renders the "stat-band" variant, the numbers
  // live there and only there; a page must not repeat its stats twice.
  if (ctx?.design?.sectionVariants?.references === "stat-band") return null;
  return (
    <StaggerItem as="dl" className="hero__stats" aria-label="Content day highlights">
      {tenant.hero.stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.value}</dt>
          <dd>{stat.label}</dd>
        </div>
      ))}
    </StaggerItem>
  );
}

export function HeroImage({ tenant, priority }) {
  if (!tenant.media.heroImage) return null;
  /* LCP element: optimize local tenant images via next/image (resized
     WebP/AVIF + preload). Remote tenant URLs (edge case) fall back to a
     prioritized plain <img> so the image optimizer isn't opened to
     arbitrary hosts. */
  if (tenant.media.heroImage.startsWith("/")) {
    return (
      <Image
        className="hero__image"
        src={tenant.media.heroImage}
        alt={tenant.media.heroAlt}
        fill
        priority={priority}
        sizes="100vw"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="hero__image"
      src={tenant.media.heroImage}
      alt={tenant.media.heroAlt}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}
