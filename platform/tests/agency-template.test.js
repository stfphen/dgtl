import assert from "node:assert/strict";
import test from "node:test";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";
import { dgtlGroupTenant } from "../lib/tenants/dgtlGroup.js";
import { dmtvTenant } from "../lib/tenants/dmtv.js";
import { dmtvStudioTenant } from "../lib/tenants/dmtvStudio.js";
import { elixrTenant } from "../lib/tenants/elixr.js";
import { onHomeDecorTenant } from "../lib/tenants/onHomeDecor.js";
import { fundedGrowthTenant } from "../lib/funding/tenant.js";

// The agency template relies on two top-level tenant config fields that are
// not part of the funnel schema: `template` (renderer selection) and `agency`
// (section content). Like the showcase template before it, both must ride
// through normalization and sanitization untouched.

test("agency template field survives normalizeTenantConfig", () => {
  const normalized = normalizeTenantConfig({ slug: "any-tenant", template: "agency" });
  assert.equal(normalized.template, "agency");
});

test("dgtl-group config survives sanitize with template and agency intact", () => {
  const sanitized = sanitizeTenantConfig(dgtlGroupTenant);
  assert.equal(sanitized.template, "agency");
  assert.equal(sanitized.slug, "dgtl-group");
  assert.ok(sanitized.agency, "agency content block should pass through");
  assert.equal(sanitized.agency.funnels.roster.length, 3);
  assert.equal(sanitized.agency.join.tracks.length, 3);
  assert.equal(sanitized.agency.results.caseStudies.length, 2);
});

test("dgtl-group config passes tenant validation", () => {
  const { ok, errors } = validateTenantConfig(dgtlGroupTenant);
  assert.equal(ok, true, JSON.stringify(errors));
});

test("dgtl-group reuses the canonical Content Day package ids", () => {
  const ids = dgtlGroupTenant.packages.map((pack) => pack.id);
  assert.deepEqual(ids, ["ugc-content", "pro-content-day", "growth-retainer", "campaign-scope"]);
  assert.equal(dgtlGroupTenant.defaultPackageId, "pro-content-day");
});

test("dgtl-group funding band targets the free Fit Scan by its canonical id", () => {
  assert.equal(dgtlGroupTenant.agency.funding.href, "/t/funded-growth");
  assert.equal(
    fundedGrowthTenant.defaultPackageId,
    "funding-fit-scan",
    "FundingBand hardcodes packageId funding-fit-scan; it must stay the Fit Scan id"
  );
});

test("dgtl-group white-label roster links to live tenant slugs", () => {
  const hrefs = dgtlGroupTenant.agency.funnels.roster.map((funnel) => funnel.href);
  assert.deepEqual(hrefs, ["/t/dmtv-studio", "/t/elixr", "/t/on-home-decor"]);
  assert.equal(dmtvStudioTenant.slug, "dmtv-studio");
  assert.equal(elixrTenant.slug, "elixr");
  assert.equal(onHomeDecorTenant.slug, "on-home-decor");
});

test("dgtl-group does not collide with any existing tenant", () => {
  const others = [
    defaultTenant,
    fundedGrowthTenant,
    dmtvTenant,
    dmtvStudioTenant,
    elixrTenant,
    onHomeDecorTenant
  ];
  for (const other of others) {
    assert.notEqual(dgtlGroupTenant.id, other.id);
    assert.notEqual(dgtlGroupTenant.slug, other.slug);
    for (const domain of dgtlGroupTenant.domains) {
      assert.ok(
        !other.domains.includes(domain),
        `domain ${domain} already claimed by ${other.slug}`
      );
    }
  }
});
