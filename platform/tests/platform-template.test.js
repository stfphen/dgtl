import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";
import { dgtlPlatformTenant } from "../lib/tenants/dgtlPlatform.js";
import { dgtlGroupTenant } from "../lib/tenants/dgtlGroup.js";
import { dmtvTenant } from "../lib/tenants/dmtv.js";
import { dmtvStudioTenant } from "../lib/tenants/dmtvStudio.js";
import { elixrTenant } from "../lib/tenants/elixr.js";
import { onHomeDecorTenant } from "../lib/tenants/onHomeDecor.js";
import { fundedGrowthTenant } from "../lib/funding/tenant.js";

// The platform template relies on the same passthrough contract as the agency
// template: top-level `template` (renderer selection) and `platform` (section
// content) must ride through normalization and sanitization untouched. It
// additionally owns the canonical app host — app.dgtlmedia.io must resolve to
// this tenant and no other, or the root landing page silently regresses to
// Content Day.

test("platform template field survives normalizeTenantConfig", () => {
  const normalized = normalizeTenantConfig({ slug: "any-tenant", template: "platform" });
  assert.equal(normalized.template, "platform");
});

test("dgtl-platform config survives sanitize with template and platform intact", () => {
  const sanitized = sanitizeTenantConfig(dgtlPlatformTenant);
  assert.equal(sanitized.template, "platform");
  assert.equal(sanitized.slug, "dgtl-platform");
  assert.ok(sanitized.platform, "platform content block should pass through");
  assert.equal(sanitized.platform.pillars.items.length, 6);
  assert.equal(sanitized.platform.rail.steps.length, 6);
  assert.equal(sanitized.platform.proof.funnels.length, 3);
  assert.ok(sanitized.platform.register.headline);
});

test("dgtl-platform config passes tenant validation", () => {
  const { ok, errors } = validateTenantConfig(dgtlPlatformTenant);
  assert.equal(ok, true, JSON.stringify(errors));
});

test("registration tagging contract: capture package platform-access", () => {
  // PlatformRegisterForm tags submissions with the tenant's defaultPackageId
  // and category "platform-registration"; the package must exist, stay a
  // capture action (no Stripe/booking pretence), and keep its id stable so
  // pipeline filters don't silently break.
  const access = dgtlPlatformTenant.packages.find(
    (pack) => pack.id === dgtlPlatformTenant.defaultPackageId
  );
  assert.ok(access, "defaultPackageId must match a package");
  assert.equal(access.id, "platform-access");
  assert.equal(access.action, "capture");
  assert.equal(access.paymentLink, "");
  assert.equal(access.bookingLink, "");
});

test("proof roster links to live tenant slugs", () => {
  const hrefs = dgtlPlatformTenant.platform.proof.funnels.map((funnel) => funnel.href);
  assert.deepEqual(hrefs, ["/t/dmtv-studio", "/t/elixr", "/t/on-home-decor"]);
  assert.equal(dmtvStudioTenant.slug, "dmtv-studio");
  assert.equal(elixrTenant.slug, "elixr");
  assert.equal(onHomeDecorTenant.slug, "on-home-decor");
});

test("no tenant claims the canonical app host — its root is the admin door", () => {
  // app.dgtlmedia.io root redirects to /admin (app/page.jsx). If any tenant
  // claims it, the root renders a funnel again — that is a regression.
  const all = [
    dgtlPlatformTenant,
    defaultTenant,
    fundedGrowthTenant,
    dgtlGroupTenant,
    dmtvTenant,
    dmtvStudioTenant,
    elixrTenant,
    onHomeDecorTenant
  ];
  for (const tenant of all) {
    assert.ok(
      !tenant.domains.includes("app.dgtlmedia.io"),
      `app.dgtlmedia.io must not be claimed by ${tenant.slug}`
    );
  }
});

test("dgtl-platform does not collide with any existing tenant", () => {
  const others = [
    defaultTenant,
    fundedGrowthTenant,
    dgtlGroupTenant,
    dmtvTenant,
    dmtvStudioTenant,
    elixrTenant,
    onHomeDecorTenant
  ];
  for (const other of others) {
    assert.notEqual(dgtlPlatformTenant.id, other.id);
    assert.notEqual(dgtlPlatformTenant.slug, other.slug);
    for (const domain of dgtlPlatformTenant.domains) {
      assert.ok(
        !other.domains.includes(domain),
        `domain ${domain} already claimed by ${other.slug}`
      );
    }
  }
});

test("marquee logo assets exist in public/", () => {
  const logos = dgtlPlatformTenant.platform.marquee.logos;
  assert.ok(logos.length >= 12, "marquee should carry the client logo wall");
  for (const logo of logos) {
    const assetPath = path.join(process.cwd(), "public", logo.src);
    assert.ok(existsSync(assetPath), `missing marquee asset: ${logo.src}`);
  }
});
