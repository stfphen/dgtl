import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";

// The authority template mirrors the showcase contract: a top-level
// `template: "authority"` selects the renderer and an optional top-level
// `authority` block carries long-form extras. Both must ride through
// normalization and sanitization untouched. (Registry resolution itself is
// JSX and can't run under node --test; the source cross-check below locks the
// registration instead, and the build/smoke pass exercises the real path.)

const AUTHORITY_FIXTURE = {
  ...defaultTenant,
  id: "tenant_authority_fixture",
  slug: "authority-fixture",
  domains: ["authority-fixture.example.com"],
  template: "authority",
  authority: {
    byline: "Founded by working producers, run like a newsroom.",
    pullQuote: "They are the only partner we brief once.",
    narrative: [
      {
        heading: "The work is the argument",
        body: "We built this practice on shipped campaigns, not capability decks."
      }
    ]
  }
};

test("template: authority survives normalizeTenantConfig", () => {
  const normalized = normalizeTenantConfig({ slug: "any-tenant", template: "authority" });
  assert.equal(normalized.template, "authority");
});

test("authority block survives sanitize with template intact", () => {
  const sanitized = sanitizeTenantConfig(AUTHORITY_FIXTURE);
  assert.equal(sanitized.template, "authority");
  assert.ok(sanitized.authority, "authority content block should pass through");
  assert.equal(sanitized.authority.narrative.length, 1);
  assert.equal(sanitized.authority.narrative[0].heading, "The work is the argument");
  assert.ok(sanitized.authority.pullQuote);
  assert.ok(sanitized.authority.byline);
});

test("authority fixture passes tenant validation", () => {
  const { ok, errors } = validateTenantConfig(AUTHORITY_FIXTURE);
  assert.equal(ok, true, JSON.stringify(errors));
});

test("tenants without an authority block stay clean", () => {
  const sanitized = sanitizeTenantConfig({ ...defaultTenant });
  assert.equal(sanitized.authority, undefined);
});

test("registry source registers the authority template", () => {
  const registrySource = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "components",
      "templates",
      "registry.js"
    ),
    "utf8"
  );
  assert.match(registrySource, /authority:\s*\{/);
  assert.match(registrySource, /AuthorityPage/);
  assert.match(registrySource, /DEFAULT_TEMPLATE_ID = "funnel"/);
});
