"use client";

import { useMemo, useState } from "react";
import { getTenantTheme } from "../lib/branding";
import { resolveDesign } from "../lib/tenantBuilder/designDirections";
import FundingSurveyWidget from "./funding/FundingSurveyWidget";
import Reveal from "./motion/Reveal";
import { Stagger, StaggerItem } from "./motion/Stagger";
// Variant-capable sections live in components/funnel/sections/ (each renders
// one of its registered compositions per ctx.design.sectionVariants); the
// single-composition sections below stay in this file until they grow
// variants.
import HeroSection from "./funnel/sections/HeroSection";
import PackagesSection from "./funnel/sections/PackagesSection";
import ReferencesSection from "./funnel/sections/ReferencesSection";
import { MediaImage } from "./funnel/sections/shared";

function PortfolioMedia({ item }) {
  const alt = item.alt || item.title || "Portfolio piece";

  if (item.mediaType === "embed") {
    return (
      <iframe
        src={item.src}
        title={item.title || "Portfolio media"}
        loading="lazy"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  if (item.mediaType === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={item.src}
        poster={item.thumbnail || undefined}
        aria-label={alt}
      />
    );
  }

  return <MediaImage src={item.src} alt={alt} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />;
}

function PortfolioSection({ tenant }) {
  const portfolio = tenant.portfolio;
  if (!portfolio?.items?.length) return null;

  return (
    <section className="section portfolio" aria-labelledby="portfolio-heading">
      <div className="section__inner">
        <Reveal className="section__header">
          {portfolio.eyebrow ? <p className="eyebrow">{portfolio.eyebrow}</p> : null}
          <h2 id="portfolio-heading">{portfolio.headline}</h2>
          {portfolio.body ? <p>{portfolio.body}</p> : null}
        </Reveal>
        <Stagger className="portfolio-grid" stagger={0.08}>
          {portfolio.items.map((item, index) => (
            <StaggerItem as="article" className="portfolio-card" key={item.id || item.src || index}>
              <div className="portfolio-card__media">
                <PortfolioMedia item={item} />
              </div>
              <div className="portfolio-card__body">
                {item.title ? (
                  <h3>
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                ) : null}
                {item.caption ? <p>{item.caption}</p> : null}
                {item.client || item.result ? (
                  <p className="portfolio-card__meta">
                    {item.client ? <span>{item.client}</span> : null}
                    {item.result ? <strong>{item.result}</strong> : null}
                  </p>
                ) : null}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Ordered sections — each self-contained; the render order comes from the
 * design direction (resolveSectionOrder guarantees hero-first and a checkout
 * section downstream of the package grid).
 * ------------------------------------------------------------------------- */

function ProblemSection({ tenant }) {
  return (
    <section className="problem section">
      <Reveal className="section__inner split">
        <div>
          {tenant.problem.eyebrow ? <p className="eyebrow">{tenant.problem.eyebrow}</p> : null}
          <h2>{tenant.problem.headline}</h2>
        </div>
        <div className="problem__grid">
          {tenant.problem.points.map((point) => (
            <p key={point}>{point}</p>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function SystemSection({ tenant }) {
  return (
    <section className="section section--soft">
      <div className="section__inner">
        <Reveal className="section__header">
          {tenant.system.eyebrow ? <p className="eyebrow">{tenant.system.eyebrow}</p> : null}
          <h2>{tenant.system.headline}</h2>
          <p>{tenant.system.body}</p>
        </Reveal>
        <Stagger className="feature-row" aria-label="Included services">
          {tenant.system.features.map((feature) => (
            <StaggerItem as="article" key={feature.title}>
              <span className="icon" aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function ProcessSection({ tenant }) {
  return (
    <section className="section">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          {tenant.process.eyebrow ? <p className="eyebrow">{tenant.process.eyebrow}</p> : null}
          <h2>{tenant.process.headline}</h2>
        </Reveal>
        <Stagger as="ol" className="timeline" stagger={0.06}>
          {tenant.process.steps.map((step, index) => (
            <StaggerItem as="li" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function OutputSection({ tenant }) {
  return (
    <section className="section section--black" aria-label="Content examples">
      <Reveal className="section__inner split split--center">
        <div>
          {tenant.output.eyebrow ? <p className="eyebrow">{tenant.output.eyebrow}</p> : null}
          <h2>{tenant.output.headline}</h2>
          <p>{tenant.output.body}</p>
        </div>
        <div className="content-grid" aria-hidden="true">
          {tenant.output.tiles.map((tile) => (
            <div key={tile}>{tile}</div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function FundedOpportunitySection({ tenant }) {
  if (!tenant.fundedOpportunity) return null;
  return (
    <section className="section">
      <Reveal className="section__inner split">
        <div>
          {tenant.fundedOpportunity.eyebrow ? <p className="eyebrow">{tenant.fundedOpportunity.eyebrow}</p> : null}
          <h2>{tenant.fundedOpportunity.headline}</h2>
          <p>{tenant.fundedOpportunity.body}</p>
        </div>
        <div className="problem__grid">
          {tenant.fundedOpportunity.points.map((point) => (
            <p key={point}>{point}</p>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function FundingPromoSection({ tenant, ctx }) {
  if (ctx.isFundingTenant || !tenant.fundingPromo?.enabled) return null;
  return (
    <section className="section section--soft" id="funding-survey" aria-label="Funding eligibility survey">
      <Reveal className="section__inner" amount={0.1}>
        <div className="section__header">
          {tenant.fundingPromo.eyebrow ? <p className="eyebrow">{tenant.fundingPromo.eyebrow}</p> : null}
          <h2>{tenant.fundingPromo.headline}</h2>
          <p>{tenant.fundingPromo.body}</p>
        </div>
        <FundingSurveyWidget tenant={tenant} />
      </Reveal>
    </section>
  );
}

function CheckoutSection({ tenant, ctx }) {
  if (ctx.isFundingTenant) {
    return (
      <section className="section section--soft checkout-section" id="funding-survey">
        <Reveal className="section__inner" amount={0.1}>
          <FundingSurveyWidget tenant={tenant} />
        </Reveal>
      </section>
    );
  }

  return (
    <section className="section section--soft checkout-section">
      <Reveal className="section__inner checkout-layout" amount={0.1}>
        <div>
          {tenant.checkout.eyebrow ? <p className="eyebrow">{tenant.checkout.eyebrow}</p> : null}
          <h2>{tenant.checkout.headline}</h2>
          <p>{tenant.checkout.body}</p>
          <div className="selected-package" id="selectedPackage" aria-live="polite">
            <strong>
              {ctx.selectedPackage.name} - {ctx.selectedPackage.priceDisplay}
            </strong>
            <span>{ctx.selectedPackage.description}</span>
          </div>
        </div>

        <form className="checkout-form" id="leadForm" onSubmit={ctx.submitLead}>
          <label>
            Business name
            <input name="business" autoComplete="organization" required />
          </label>
          <label>
            Name
            <input name="name" autoComplete="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Phone <span>optional</span>
            <input name="phone" type="tel" autoComplete="tel" />
          </label>
          <label>
            {tenant.checkout.urlLabel || "Website or Instagram"}
            <input name="url" autoComplete="url" placeholder="https://" />
          </label>
          <label>
            {tenant.checkout.notesLabel || "What do you need content for?"}
            <textarea name="notes" rows="4" />
          </label>
          <div className="form-actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={ctx.submitting}
              aria-busy={ctx.submitting}
            >
              {ctx.submitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Working…
                </>
              ) : (
                tenant.checkout.submitCta
              )}
            </button>
          </div>
          <p className="form-note" id="formNote">{ctx.formNote}</p>
        </form>
      </Reveal>
    </section>
  );
}

function FaqSection({ tenant }) {
  return (
    <section className="section objections">
      <div className="section__inner">
        <Reveal className="section__header section__header--compact">
          {tenant.faq.eyebrow ? <p className="eyebrow">{tenant.faq.eyebrow}</p> : null}
          <h2>{tenant.faq.headline}</h2>
        </Reveal>
        <Stagger className="faq-grid" stagger={0.07}>
          {tenant.faq.items.map((item) => (
            <StaggerItem as="article" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function FinalCtaSection({ tenant, ctx }) {
  return (
    <section className="final-cta">
      <Reveal className="final-cta__inner">
        {tenant.finalCta.eyebrow ? <p className="eyebrow">{tenant.finalCta.eyebrow}</p> : null}
        <h2>{tenant.finalCta.headline}</h2>
        <p>{tenant.finalCta.body}</p>
        <button className="button button--primary" onClick={() => ctx.selectPackage(tenant.defaultPackageId)}>
          {tenant.finalCta.cta}
        </button>
      </Reveal>
    </section>
  );
}

const SECTION_COMPONENTS = {
  hero: HeroSection,
  problem: ProblemSection,
  system: SystemSection,
  process: ProcessSection,
  output: OutputSection,
  portfolio: PortfolioSection,
  references: ReferencesSection,
  fundedOpportunity: FundedOpportunitySection,
  packages: PackagesSection,
  fundingPromo: FundingPromoSection,
  checkout: CheckoutSection,
  faq: FaqSection,
  finalCta: FinalCtaSection
};

export default function FunnelPage({ tenant }) {
  const [selectedPackageId, setSelectedPackageId] = useState(tenant.defaultPackageId);
  const [formNote, setFormNote] = useState(tenant.checkout.disclaimer);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isFundingTenant = tenant.slug === "funded-growth";
  const theme = useMemo(() => getTenantTheme(tenant.brand), [tenant.brand]);
  const design = useMemo(() => resolveDesign(tenant.design), [tenant.design]);

  const selectedPackage = useMemo(
    () => tenant.packages.find((pkg) => pkg.id === selectedPackageId) || tenant.packages[0],
    [selectedPackageId, tenant.packages]
  );

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  function selectPackage(packageId) {
    setSelectedPackageId(packageId);
    document.querySelector(".checkout-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function submitLead(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormNote("Preparing checkout...");

    const form = new FormData(event.currentTarget);
    const fundingScan = isFundingTenant
      ? {
          companyWebsite: form.get("companyWebsite"),
          industry: form.get("industry"),
          location: form.get("location"),
          employeeCount: form.get("employeeCount"),
          revenueRange: form.get("revenueRange"),
          yearsOperating: form.get("yearsOperating"),
          incorporated: form.get("incorporated"),
          currentlyExporting: form.get("currentlyExporting"),
          interestedInExporting: form.get("interestedInExporting"),
          digitalNeeds: form.get("digitalNeeds"),
          ecommerceNeeds: form.get("ecommerceNeeds"),
          crmAutomationNeeds: form.get("crmAutomationNeeds"),
          availableProjectBudget: form.get("availableProjectBudget"),
          mainGrowthGoal: form.get("mainGrowthGoal")
        }
      : null;
    const payload = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      packageId: selectedPackage.id,
      package: selectedPackage,
      business: form.get("business"),
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      url: isFundingTenant ? fundingScan.companyWebsite : form.get("url"),
      notes: isFundingTenant ? fundingScan.mainGrowthGoal : form.get("notes"),
      source: isFundingTenant ? "funding_scan" : window.location.href,
      ...(isFundingTenant
        ? {
            sourceType: "funding_scan",
            sourceUrl: window.location.href,
            category: fundingScan.industry,
            city: fundingScan.location,
            metadata: { fundingScan }
          }
        : {})
    };

    try {
      // Stripe Checkout path: /api/checkout captures the lead AND creates the
      // session server-side (price resolved from the tenant config, not here).
      if (selectedPackage.action === "checkout" && !selectedPackage.paymentLink) {
        const checkoutResponse = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const checkout = await checkoutResponse.json().catch(() => ({}));

        if (checkoutResponse.ok && checkout.url) {
          window.location.href = checkout.url;
          return;
        }
        if (checkoutResponse.ok && checkout.redirect) {
          window.location.href = checkout.redirect;
          return;
        }
        if (checkoutResponse.ok) {
          setFormNote(
            `${selectedPackage.name} selected. We captured your request and will follow up with next steps.`
          );
          showToast("Request captured.");
          return;
        }
        setFormNote("Checkout could not start. We saved your details and will follow up.");
        showToast("Checkout failed.");
        return;
      }

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setFormNote("Lead capture failed. Please try again or contact us directly.");
        showToast("Lead capture failed.");
        return;
      }

      if (selectedPackage.action === "checkout" && selectedPackage.paymentLink) {
        window.location.href = selectedPackage.paymentLink;
        return;
      }

      if (selectedPackage.bookingLink) {
        window.location.href = selectedPackage.bookingLink;
        return;
      }

      setFormNote(
        `${selectedPackage.name} selected. We captured your request and will follow up with next steps.`
      );
      showToast("Request captured.");
    } catch {
      setFormNote("Something went wrong. Please try again.");
      showToast("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const ctx = {
    selectedPackage,
    selectedPackageId,
    selectPackage,
    submitLead,
    formNote,
    submitting,
    isFundingTenant,
    design
  };

  return (
    <div
      className="tenant-root"
      style={{ ...theme.vars, ...design.vars }}
      data-tenant={tenant.slug}
      data-direction={design.id}
    >
      <main>
        {design.sectionOrder.map((sectionId) => {
          const Section = SECTION_COMPONENTS[sectionId];
          if (!Section) return null;
          return <Section key={sectionId} tenant={tenant} ctx={ctx} />;
        })}
      </main>

      <div className="mobile-action" aria-label="Mobile checkout shortcut">
        <button className="button button--primary" onClick={() => selectPackage(tenant.defaultPackageId)}>
          {tenant.mobileCta.primary}
        </button>
        <button
          className="button button--secondary"
          onClick={() => document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" })}
        >
          {tenant.mobileCta.secondary}
        </button>
      </div>

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
