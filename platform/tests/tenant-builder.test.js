import assert from "node:assert/strict";
import test from "node:test";
import { validateTenantConfig } from "../lib/tenantValidation.js";
import { buildTenantConfigFromModelOutput } from "../lib/tenantBuilder/generateTenant.js";

// A representative shape of what the model returns under the structured-output schema.
function sampleModelOutput() {
  return {
    brand: {
      name: "Acme Content Studio",
      eyebrow: "Acme",
      logoText: "Acme",
      tagline: "Content that converts.",
      primaryColor: "#0071e3",
      accentColor: "#050505"
    },
    hero: {
      headline: "A month of content in a single shoot day.",
      subheadline: "We plan, shoot, and deliver short-form video for busy brands.",
      primaryCta: "Book a Call",
      secondaryCta: "View Packages",
      stats: [{ value: "20+", label: "videos" }]
    },
    problem: { eyebrow: "Problem", headline: "Content is hard.", points: ["No time", "No plan"] },
    system: {
      eyebrow: "System",
      headline: "Done for you.",
      body: "We handle it.",
      features: [{ title: "Strategy", body: "We plan." }]
    },
    process: { eyebrow: "Process", headline: "Simple.", steps: [{ title: "Call", body: "We meet." }] },
    output: { eyebrow: "Output", headline: "Great content.", body: "A mix.", tiles: ["UGC", "ADS"] },
    packageSection: { eyebrow: "Packages", headline: "Pick one.", body: "Start here." },
    packages: [
      {
        id: "starter-package",
        name: "Starter",
        summary: "Entry tier.",
        price: "$1,500",
        priceQualifier: "/ month",
        priceDisplay: "$1,500/month",
        action: "checkout",
        cta: "Select Starter",
        featured: false,
        description: "Great for getting started.",
        features: ["12 videos", "Fast turnaround"]
      },
      {
        id: "pro-package",
        name: "Pro",
        summary: "Higher tier.",
        price: "$3,000",
        priceQualifier: "/ month",
        priceDisplay: "$3,000/month",
        action: "booking",
        cta: "Select Pro",
        featured: true,
        description: "For brands that post daily.",
        features: ["30 videos", "Priority editing"]
      }
    ],
    enterprise: { eyebrow: "Enterprise", headline: "Bigger.", body: "Campaigns.", cta: "Scope it" },
    faq: { eyebrow: "FAQ", headline: "Questions", items: [{ question: "How?", answer: "Easily." }] },
    finalCta: { eyebrow: "Ready", headline: "Let's go.", body: "Book now.", cta: "Book a Call" },
    mobileCta: { primary: "Book", secondary: "Packages" }
  };
}

test("buildTenantConfigFromModelOutput produces a valid draft config", () => {
  const { config, warnings } = buildTenantConfigFromModelOutput({
    modelOutput: sampleModelOutput(),
    brandName: "Acme Content Studio"
  });

  assert.equal(config.status, "draft");
  assert.equal(config.slug, "acme-content-studio");
  assert.equal(config.id, "tenant_acme-content-studio");
  assert.ok(config.domains.length >= 1, "seeds a placeholder domain");
  assert.equal(config.packages.length, 2);

  const { ok, errors } = validateTenantConfig(config);
  assert.equal(ok, true, `expected valid config, got: ${JSON.stringify(errors)}`);

  // Always warns operator about the placeholder domain.
  assert.ok(warnings.some((w) => /placeholder domain/i.test(w)));
});

test("buildTenantConfigFromModelOutput prefers an explicit slug", () => {
  const { config } = buildTenantConfigFromModelOutput({
    modelOutput: sampleModelOutput(),
    brandName: "Acme Content Studio",
    slug: "Custom Slug!!"
  });
  assert.equal(config.slug, "custom-slug");
});

test("buildTenantConfigFromModelOutput fills missing sections from defaults", () => {
  // Even a sparse model output should normalize into a renderable config.
  const sparse = {
    brand: {
      name: "Tiny Co",
      eyebrow: "Tiny",
      logoText: "Tiny",
      tagline: "Small but mighty.",
      primaryColor: "#123456",
      accentColor: "#000000"
    },
    packages: sampleModelOutput().packages
  };
  const { config } = buildTenantConfigFromModelOutput({ modelOutput: sparse, brandName: "Tiny Co" });

  // Sections the model omitted come from defaultTenant via normalizeTenantConfig.
  assert.ok(config.hero && typeof config.hero.headline === "string");
  assert.ok(config.faq && Array.isArray(config.faq.items));
  assert.ok(config.routing && typeof config.routing === "object");
});
