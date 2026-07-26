import assert from "node:assert/strict";
import test from "node:test";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";

test("normalizes tenant config with default portfolio and references sections", () => {
  const tenant = normalizeTenantConfig({
    id: "tenant_partner",
    slug: "partner",
    domains: ["partner.example.com"],
    brand: { name: "Partner Media" }
  });

  assert.equal(tenant.portfolio.eyebrow, "Portfolio");
  assert.deepEqual(tenant.portfolio.items, []);
  assert.equal(tenant.references.eyebrow, "References");
  assert.deepEqual(tenant.references.testimonials, []);
  assert.deepEqual(tenant.references.logos, []);
});

test("partial portfolio override keeps default arrays and copy", () => {
  const tenant = normalizeTenantConfig({ portfolio: { headline: "Our recent work" } });

  assert.equal(tenant.portfolio.headline, "Our recent work");
  assert.equal(tenant.portfolio.eyebrow, defaultTenant.portfolio.eyebrow);
  assert.deepEqual(tenant.portfolio.items, []);
});

test("sanitizes portfolio items: trims, coerces mediaType, drops unusable src", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    portfolio: {
      ...defaultTenant.portfolio,
      items: [
        {
          id: " work-1 ",
          title: "  Launch video  ",
          caption: " 30-day content sprint ",
          client: " A local clinic ",
          result: " 2x reach ",
          mediaType: "gif",
          src: " /assets/work-1.png ",
          thumbnail: "//evil.example/thumb.png",
          alt: " Behind the scenes of a shoot ",
          tags: { industry: [" health ", 7, ""], format: [" short-form "] },
          link: "javascript:alert(1)"
        },
        { title: "No src, dropped", mediaType: "image" },
        { title: "Bad src, dropped", src: "javascript:alert(1)" },
        { title: "Protocol-relative, dropped", src: "//evil.example/x.png" },
        { title: "Remote kept", mediaType: "embed", src: "https://player.example/embed/42" },
        "not-an-object"
      ]
    }
  });

  assert.equal(tenant.portfolio.items.length, 2);
  const [first, second] = tenant.portfolio.items;
  assert.equal(first.id, "work-1");
  assert.equal(first.title, "Launch video");
  assert.equal(first.mediaType, "image");
  assert.equal(first.src, "/assets/work-1.png");
  assert.equal(first.thumbnail, "");
  assert.equal(first.link, "");
  assert.equal(first.alt, "Behind the scenes of a shoot");
  assert.deepEqual(first.tags, { industry: ["health"], format: ["short-form"] });
  assert.equal(second.mediaType, "embed");
  assert.equal(second.src, "https://player.example/embed/42");
});

test("sanitizes references: drops quote-less testimonials and src-less logos", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    references: {
      ...defaultTenant.references,
      testimonials: [
        { quote: "  Great to work with.  ", name: " Jane ", role: " Owner ", company: " Clinic " },
        { quote: "   ", name: "Dropped" },
        "not-an-object"
      ],
      logos: [
        { name: " Clinic ", src: " /assets/logo.svg ", alt: " Clinic logo ", link: "https://clinic.example" },
        { name: "Dropped", src: "not-a-url" },
        { name: "Dropped too" }
      ]
    }
  });

  assert.equal(tenant.references.testimonials.length, 1);
  assert.deepEqual(tenant.references.testimonials[0], {
    quote: "Great to work with.",
    name: "Jane",
    role: "Owner",
    company: "Clinic"
  });
  assert.equal(tenant.references.logos.length, 1);
  assert.deepEqual(tenant.references.logos[0], {
    name: "Clinic",
    src: "/assets/logo.svg",
    mediaId: "",
    alt: "Clinic logo",
    link: "https://clinic.example"
  });
});

test("normalizes null portfolio/reference arrays to empty arrays", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    portfolio: { ...defaultTenant.portfolio, items: null },
    references: { ...defaultTenant.references, testimonials: null, logos: null }
  });

  assert.deepEqual(tenant.portfolio.items, []);
  assert.deepEqual(tenant.references.testimonials, []);
  assert.deepEqual(tenant.references.logos, []);
});

test("populated portfolio validates ok and differs from the empty default", () => {
  const populated = validateTenantConfig({
    ...defaultTenant,
    portfolio: {
      ...defaultTenant.portfolio,
      items: [
        {
          id: "work-1",
          title: "Sample work",
          mediaType: "image",
          src: "/assets/work-1.png",
          alt: "Sample portfolio piece"
        }
      ]
    }
  });
  const empty = validateTenantConfig(defaultTenant);

  assert.equal(populated.ok, true);
  assert.equal(empty.ok, true);
  assert.equal(populated.tenant.portfolio.items.length, 1);
  assert.notDeepEqual(populated.tenant.portfolio.items, empty.tenant.portfolio.items);
});
