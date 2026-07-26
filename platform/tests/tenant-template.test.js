import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";
import { dmtvStudioTenant } from "../lib/tenants/dmtvStudio.js";

// The showcase template relies on two top-level tenant config fields that are
// not part of the funnel schema: `template` (renderer selection) and
// `showcase` (section content). Both must ride through normalization and
// sanitization untouched — these tests lock that passthrough in.

test("template field survives normalizeTenantConfig", () => {
  const normalized = normalizeTenantConfig({ slug: "any-tenant", template: "showcase" });
  assert.equal(normalized.template, "showcase");
});

test("tenants without a template field stay template-less (funnel fallback)", () => {
  const normalized = normalizeTenantConfig({ slug: "plain-tenant" });
  assert.equal(normalized.template, undefined);
});

test("dmtv-studio config survives sanitize with template and showcase intact", () => {
  const sanitized = sanitizeTenantConfig(dmtvStudioTenant);
  assert.equal(sanitized.template, "showcase");
  assert.equal(sanitized.slug, "dmtv-studio");
  assert.ok(sanitized.showcase, "showcase content block should pass through");
  assert.ok(Array.isArray(sanitized.showcase.minuteOfMusic.reels));
  assert.ok(sanitized.showcase.team.tracks.length === 3);
});

test("dmtv-studio config passes tenant validation", () => {
  const { ok, errors } = validateTenantConfig(dmtvStudioTenant);
  assert.equal(ok, true, JSON.stringify(errors));
});

test("dmtv-studio hero video is a playable sanitized block", () => {
  const sanitized = sanitizeTenantConfig(dmtvStudioTenant);
  assert.equal(sanitized.media.heroVideo.kind, "video");
  assert.equal(sanitized.media.heroVideo.videoId, "T_xIf3tkGls");
});

test("dmtv-studio does not claim the original dmtv host", () => {
  assert.ok(!dmtvStudioTenant.domains.includes("dmtv.dgtlmag.com"));
  assert.notEqual(dmtvStudioTenant.slug, "dmtv");
});
