"use client";

import Reveal from "../../motion/Reveal";
import { Stagger, StaggerItem } from "../../motion/Stagger";
import { SECTION_VARIANTS } from "../../../lib/tenantBuilder/sectionVariants";

/* ---------------------------------------------------------------------------
 * Packages — variant contract (every variant must honor all three):
 * - each package card carries data-package-card={pkg.id}
 * - selecting calls ctx.selectPackage(pkg.id)
 * - the section keeps id="packages" (hero secondary CTA and the mobile bar
 *   scroll to it)
 * "cards" is the pre-variants FunnelPage rendering, verbatim.
 * ------------------------------------------------------------------------- */

function EnterpriseBand({ tenant, ctx }) {
  return (
    <Reveal className="enterprise-band">
      <div>
        {tenant.enterprise.eyebrow ? <p className="eyebrow">{tenant.enterprise.eyebrow}</p> : null}
        <h3>{tenant.enterprise.headline}</h3>
        <p>{tenant.enterprise.body}</p>
      </div>
      <button className="button button--secondary" onClick={() => ctx.selectPackage(tenant.enterprise.packageId)}>
        {tenant.enterprise.cta}
      </button>
    </Reveal>
  );
}

function CardsPackages({ tenant, ctx }) {
  return (
    <section id="packages" className="section packages">
      <div className="section__inner">
        <Reveal className="section__header">
          {tenant.packageSection.eyebrow ? <p className="eyebrow">{tenant.packageSection.eyebrow}</p> : null}
          <h2>{tenant.packageSection.headline}</h2>
          <p>{tenant.packageSection.body}</p>
        </Reveal>

        <Stagger className="package-grid" stagger={0.1}>
          {tenant.packages.map((pkg) => (
            <StaggerItem
              as="article"
              className={`package ${pkg.featured ? "package--featured" : ""} ${
                pkg.id === ctx.selectedPackageId ? "is-selected" : ""
              }`}
              data-package-card={pkg.id}
              key={pkg.id}
            >
              {pkg.featured ? <span className="package__badge">Most popular</span> : null}
              <div className="package__top">
                <h3>{pkg.name}</h3>
                <p>{pkg.summary}</p>
              </div>
              <div className="price">
                <span>{pkg.price}</span>
                <small>{pkg.priceQualifier}</small>
              </div>
              <p className="price__alt">{pkg.altPrice}</p>
              <ul>
                {pkg.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={`button ${pkg.featured ? "button--primary" : "button--dark"}`}
                onClick={() => ctx.selectPackage(pkg.id)}
              >
                {pkg.cta}
              </button>
            </StaggerItem>
          ))}
        </Stagger>

        <EnterpriseBand tenant={tenant} ctx={ctx} />
      </div>
    </section>
  );
}

/* "comparison": tier rail for buyers that comparison-shop (B2B, SaaS). One
   shared surface, hairline column dividers, aligned price rows, the featured
   tier flagged once. Collapses to stacked tiers under 768px. */
function ComparisonPackages({ tenant, ctx }) {
  return (
    <section id="packages" className="section packages">
      <div className="section__inner">
        <Reveal className="section__header">
          {tenant.packageSection.eyebrow ? <p className="eyebrow">{tenant.packageSection.eyebrow}</p> : null}
          <h2>{tenant.packageSection.headline}</h2>
          <p>{tenant.packageSection.body}</p>
        </Reveal>

        <Stagger className="package-compare" stagger={0.08}>
          {tenant.packages.map((pkg) => (
            <StaggerItem
              as="article"
              className={`package-compare__col ${pkg.featured ? "package-compare__col--featured" : ""} ${
                pkg.id === ctx.selectedPackageId ? "is-selected" : ""
              }`}
              data-package-card={pkg.id}
              key={pkg.id}
            >
              {pkg.featured ? <span className="package-compare__flag">Recommended</span> : null}
              <div className="package-compare__head">
                <h3>{pkg.name}</h3>
                <p>{pkg.summary}</p>
              </div>
              <div className="price price--compare">
                <span>{pkg.price}</span>
                <small>{pkg.priceQualifier}</small>
              </div>
              <ul>
                {pkg.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={`button ${pkg.featured ? "button--primary" : "button--secondary"}`}
                onClick={() => ctx.selectPackage(pkg.id)}
              >
                {pkg.cta}
              </button>
            </StaggerItem>
          ))}
        </Stagger>

        <EnterpriseBand tenant={tenant} ctx={ctx} />
      </div>
    </section>
  );
}

/* "single-offer": one flagship offer sold big (local/trades buyers pick the
   obvious choice, they don't tier-shop); remaining packages stay reachable as
   compact rows so no purchasable option disappears. */
function SingleOfferPackages({ tenant, ctx }) {
  const flagship = tenant.packages.find((pkg) => pkg.featured) || tenant.packages[0];
  if (!flagship) return null;
  const rest = tenant.packages.filter((pkg) => pkg.id !== flagship.id);

  return (
    <section id="packages" className="section packages">
      <div className="section__inner">
        <Reveal className="section__header">
          {tenant.packageSection.eyebrow ? <p className="eyebrow">{tenant.packageSection.eyebrow}</p> : null}
          <h2>{tenant.packageSection.headline}</h2>
          <p>{tenant.packageSection.body}</p>
        </Reveal>

        <Reveal
          className={`package-offer ${flagship.id === ctx.selectedPackageId ? "is-selected" : ""}`}
          data-package-card={flagship.id}
        >
          <div className="package-offer__body">
            <h3>{flagship.name}</h3>
            <p className="package-offer__summary">{flagship.summary}</p>
            <ul>
              {flagship.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
          <div className="package-offer__aside">
            <div className="price">
              <span>{flagship.price}</span>
              <small>{flagship.priceQualifier}</small>
            </div>
            {flagship.altPrice ? <p className="price__alt">{flagship.altPrice}</p> : null}
            <button className="button button--primary" onClick={() => ctx.selectPackage(flagship.id)}>
              {flagship.cta}
            </button>
          </div>
        </Reveal>

        {rest.length ? (
          <div className="package-offer__rest">
            {rest.map((pkg) => (
              <div
                className={`package-offer__row ${pkg.id === ctx.selectedPackageId ? "is-selected" : ""}`}
                data-package-card={pkg.id}
                key={pkg.id}
              >
                <div className="package-offer__row-copy">
                  <h4>{pkg.name}</h4>
                  <p>{pkg.summary}</p>
                </div>
                <span className="package-offer__row-price">{pkg.price}</span>
                <button className="button button--secondary" onClick={() => ctx.selectPackage(pkg.id)}>
                  {pkg.cta}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <EnterpriseBand tenant={tenant} ctx={ctx} />
      </div>
    </section>
  );
}

const VARIANTS = {
  cards: CardsPackages,
  comparison: ComparisonPackages,
  "single-offer": SingleOfferPackages
};

export default function PackagesSection({ tenant, ctx }) {
  const Variant =
    VARIANTS[ctx.design.sectionVariants?.packages] || VARIANTS[SECTION_VARIANTS.packages.defaultId];
  return <Variant tenant={tenant} ctx={ctx} />;
}
