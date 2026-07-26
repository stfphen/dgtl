import assert from "node:assert/strict";
import test from "node:test";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import {
  EDITABLE_KEYS,
  applyEditedSections,
  applyManualPatch
} from "../lib/tenantBuilder/editTenant.js";
import { diffConfigs } from "../lib/tenantBuilder/configDiff.js";

function baseDraft() {
  return normalizeTenantConfig({
    id: "tenant_edit_me",
    slug: "edit-me",
    status: "draft",
    domains: ["edit-me.example.com"],
    brand: {
      name: "Edit Me Studio",
      appIcon: "data:image/png;base64,AAAA",
      logo: "/assets/logo.png"
    },
    design: { direction: "warm-boutique", overrides: { "--fp-radius": "24px" } },
    routing: { leadWebhookUrl: "https://hooks.example.com/lead" },
    portfolio: {
      items: [{ id: "w1", title: "Work", mediaType: "image", src: "/assets/w1.png" }]
    },
    packages: [
      { id: "starter", name: "Starter", action: "capture", featured: false, features: [] },
      { id: "pro", name: "Pro", action: "checkout", featured: true, features: [] }
    ],
    defaultPackageId: "pro"
  });
}

test("applyEditedSections merges only editable keys and preserves everything else", () => {
  const draft = baseDraft();
  const result = applyEditedSections(draft, {
    hero: { ...draft.hero, headline: "New headline." },
    // Hostile/model-noise keys that must be ignored:
    checkout: { headline: "CLOBBERED" },
    routing: { leadWebhookUrl: "https://evil.example.com" },
    domains: ["evil.example.com"],
    slug: "evil",
    id: "tenant_evil",
    media: { heroImage: "https://evil.example.com/x.png" }
  });

  assert.equal(result.valid, true);
  assert.equal(result.config.hero.headline, "New headline.");
  // Non-editable surfaces carried over from the draft:
  assert.equal(result.config.checkout.headline, draft.checkout.headline);
  assert.equal(result.config.routing.leadWebhookUrl, "https://hooks.example.com/lead");
  assert.deepEqual(result.config.domains, ["edit-me.example.com"]);
  assert.equal(result.config.slug, "edit-me");
  assert.equal(result.config.id, "tenant_edit_me");
  assert.equal(result.config.media.heroImage, draft.media.heroImage);
  assert.equal(result.config.portfolio.items.length, 1);
  // brand extras beyond the schema survive a brand edit:
  const brandEdit = applyEditedSections(draft, { brand: { name: "Renamed Co" } });
  assert.equal(brandEdit.config.brand.name, "Renamed Co");
  assert.equal(brandEdit.config.brand.appIcon, "data:image/png;base64,AAAA");
  assert.equal(brandEdit.config.brand.logo, "/assets/logo.png");
});

test("applyEditedSections repairs defaultPackageId when packages are renamed", () => {
  const draft = baseDraft();
  const result = applyEditedSections(draft, {
    packages: [
      { ...draft.packages[0], id: "basic", name: "Basic" },
      { ...draft.packages[1], id: "growth", name: "Growth", featured: true }
    ]
  });

  assert.equal(result.valid, true);
  assert.equal(result.config.defaultPackageId, "growth");
});

test("applyEditedSections switches direction, keeps overrides, rejects unknown ids", () => {
  const draft = baseDraft();

  const switched = applyEditedSections(draft, { design: { direction: "bold-brutalist" } });
  assert.equal(switched.config.design.direction, "bold-brutalist");
  assert.deepEqual(switched.config.design.overrides, { "--fp-radius": "24px" });
  // Copy untouched by a pure restyle:
  assert.equal(switched.config.hero.headline, draft.hero.headline);

  const unknown = applyEditedSections(draft, { design: { direction: "vaporwave" } });
  assert.equal(unknown.config.design.direction, "warm-boutique");
  assert.ok(unknown.warnings.some((w) => w.includes('Unknown design direction "vaporwave"')));
});

test("applyEditedSections surfaces copy-limit warnings from edited copy", () => {
  const draft = baseDraft();
  const result = applyEditedSections(draft, {
    hero: { ...draft.hero, headline: "h".repeat(90) }
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.startsWith("hero.headline: 90 chars (limit 70)")));
});

test("applyManualPatch deep-merges one section without clobbering siblings", () => {
  const draft = baseDraft();
  const result = applyManualPatch(draft, {
    hero: { headline: "Patched headline." },
    // Non-patchable keys are ignored:
    checkout: { headline: "NOPE" },
    domains: ["evil.example.com"]
  });

  assert.equal(result.valid, true);
  assert.equal(result.config.hero.headline, "Patched headline.");
  assert.equal(result.config.hero.subheadline, draft.hero.subheadline);
  assert.deepEqual(
    result.config.hero.stats.map((s) => s.label),
    draft.hero.stats.map((s) => s.label)
  );
  assert.equal(result.config.checkout.headline, draft.checkout.headline);
  assert.deepEqual(result.config.domains, ["edit-me.example.com"]);
});

test("applyManualPatch can update media slots (picker path)", () => {
  const draft = baseDraft();
  const result = applyManualPatch(draft, {
    media: { heroImage: "/uploads/team_default/media_1.png" }
  });
  assert.equal(result.valid, true);
  assert.equal(result.config.media.heroImage, "/uploads/team_default/media_1.png");
  assert.equal(result.config.media.heroAlt, draft.media.heroAlt);
});

test("EDITABLE_KEYS matches the AI-authored sections plus design", () => {
  assert.deepEqual(
    [...EDITABLE_KEYS].sort(),
    [
      "brand",
      "design",
      "enterprise",
      "faq",
      "finalCta",
      "hero",
      "mobileCta",
      "output",
      "packageSection",
      "packages",
      "problem",
      "process",
      "system"
    ].sort()
  );
});

test("diffConfigs reports changed paths with truncated values", () => {
  const before = baseDraft();
  const after = normalizeTenantConfig({
    ...before,
    hero: { ...before.hero, headline: "Changed." },
    packages: [before.packages[0], { ...before.packages[1], price: "$9,999" }]
  });

  const changes = diffConfigs(before, after);
  const paths = changes.map((change) => change.path);
  assert.ok(paths.includes("hero.headline"));
  assert.ok(paths.includes("packages.1.price"));
  assert.ok(!paths.some((path) => path.startsWith("checkout")));

  const headlineChange = changes.find((change) => change.path === "hero.headline");
  assert.equal(headlineChange.after, "Changed.");

  assert.deepEqual(diffConfigs(before, before), []);

  const long = normalizeTenantConfig({ ...before, system: { ...before.system, body: "z".repeat(400) } });
  const longChange = diffConfigs(before, long).find((change) => change.path === "system.body");
  assert.ok(longChange.after.length <= 140);
  assert.ok(longChange.after.endsWith("…"));
});

test("diffConfigs skips snapshot bookkeeping keys", () => {
  const before = { ...defaultTenant, draftConfig: { a: 1 }, lastPublishedAt: "x" };
  const after = { ...defaultTenant, draftConfig: { a: 2 }, lastPublishedAt: "y" };
  assert.deepEqual(diffConfigs(before, after), []);
});
