import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig } from "../lib/tenantValidation.js";
import { applyManualPatch } from "../lib/tenantBuilder/editTenant.js";

async function withTempStore(t) {
  const previousStorePath = process.env.APP_STORE_PATH;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const dir = await mkdtemp(path.join(tmpdir(), "media-resolve-"));
  process.env.APP_STORE_PATH = path.join(dir, "store.json");
  delete process.env.DATABASE_URL;
  t.after(async () => {
    if (previousStorePath === undefined) delete process.env.APP_STORE_PATH;
    else process.env.APP_STORE_PATH = previousStorePath;
    if (previousDatabaseUrl !== undefined) process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(dir, { recursive: true, force: true });
  });
  return import("../lib/store.js");
}

test("resolveTenantMediaConfig substitutes asset urls, fills blank alt, strips ids", async (t) => {
  const { createMediaAsset, resolveTenantMediaConfig } = await withTempStore(t);

  const hero = await createMediaAsset(
    { url: "/uploads/team_a/hero.png", alt: "Studio hero shot" },
    { teamId: "team_a" }
  );
  const work = await createMediaAsset(
    { url: "/uploads/team_a/work.png", alt: "Case study", thumbnailUrl: "/uploads/team_a/thumb.png" },
    { teamId: "team_a" }
  );
  const logo = await createMediaAsset({ url: "/uploads/team_a/logo.png" }, { teamId: "team_a" });

  const config = normalizeTenantConfig({
    media: { heroImage: "/assets/old-hero.png", heroImageId: hero.id, heroAlt: "" },
    portfolio: {
      items: [
        { id: "w1", mediaId: work.id, mediaType: "image", src: "", alt: "" },
        { id: "w2", src: "/assets/direct.png", mediaType: "image", alt: "Direct" },
        { id: "w3", mediaId: "media_deleted", src: "/assets/fallback.png", mediaType: "image" }
      ]
    },
    references: { logos: [{ name: "Acme", mediaId: logo.id, src: "", alt: "Acme logo" }] }
  });

  const resolved = await resolveTenantMediaConfig(config, { teamId: "team_a" });

  assert.equal(resolved.media.heroImage, "/uploads/team_a/hero.png");
  assert.equal(resolved.media.heroAlt, "Studio hero shot");
  assert.ok(!("heroImageId" in resolved.media));

  const [w1, w2, w3] = resolved.portfolio.items;
  assert.equal(w1.src, "/uploads/team_a/work.png");
  assert.equal(w1.alt, "Case study");
  assert.equal(w1.thumbnail, "/uploads/team_a/thumb.png");
  assert.ok(!("mediaId" in w1));
  // Direct-src item untouched:
  assert.equal(w2.src, "/assets/direct.png");
  assert.equal(w2.alt, "Direct");
  // Unresolved id falls back to the direct src:
  assert.equal(w3.src, "/assets/fallback.png");
  assert.ok(!("mediaId" in w3));

  assert.equal(resolved.references.logos[0].src, "/uploads/team_a/logo.png");
  // Authored alt wins over asset alt:
  assert.equal(resolved.references.logos[0].alt, "Acme logo");

  // The input config is not mutated.
  assert.equal(config.media.heroImageId, hero.id);
});

test("resolveTenantMediaConfig fast-path returns the same object when no ids", async (t) => {
  const { resolveTenantMediaConfig } = await withTempStore(t);
  const config = normalizeTenantConfig({});
  assert.equal(await resolveTenantMediaConfig(config, { teamId: "team_a" }), config);
});

test("cross-team media ids never resolve", async (t) => {
  const { createMediaAsset, resolveTenantMediaConfig } = await withTempStore(t);
  const asset = await createMediaAsset({ url: "/uploads/team_b/x.png" }, { teamId: "team_b" });

  const config = normalizeTenantConfig({
    media: { heroImage: "/assets/own-hero.png", heroImageId: asset.id }
  });
  const resolved = await resolveTenantMediaConfig(config, { teamId: "team_a" });
  assert.equal(resolved.media.heroImage, "/assets/own-hero.png");
  assert.ok(!("heroImageId" in resolved.media));
});

test("sanitize keeps mediaId-only portfolio items and logos, still drops empty ones", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    portfolio: {
      ...defaultTenant.portfolio,
      items: [
        { id: "lib-only", title: "From library", mediaId: " media_1 ", mediaType: "image" },
        { id: "direct", title: "Direct", src: "/assets/x.png" },
        { id: "empty", title: "Dropped" }
      ]
    },
    references: {
      ...defaultTenant.references,
      logos: [{ name: "LibLogo", mediaId: "media_2" }, { name: "Dropped" }]
    }
  });

  assert.equal(tenant.portfolio.items.length, 2);
  assert.equal(tenant.portfolio.items[0].mediaId, "media_1");
  assert.equal(tenant.portfolio.items[0].src, "");
  assert.equal(tenant.portfolio.items[1].mediaId, "");
  assert.equal(tenant.references.logos.length, 1);
  assert.equal(tenant.references.logos[0].mediaId, "media_2");
});

test("mediaId survives a draft save/load round trip", async (t) => {
  const { saveTenantDraftConfig, getTenantByIdOrSlug, getRenderableTenantConfig } =
    await withTempStore(t);

  const saved = await saveTenantDraftConfig(
    null,
    {
      ...defaultTenant,
      id: "tenant_media_rt",
      slug: "media-rt",
      domains: ["media-rt.local"],
      media: { ...defaultTenant.media, heroImageId: "media_hero_1" },
      portfolio: {
        ...defaultTenant.portfolio,
        items: [{ id: "w1", title: "W1", mediaId: "media_w1", mediaType: "image" }]
      }
    },
    { teamId: "team_default" }
  );

  const loaded = await getTenantByIdOrSlug(saved.id, { teamId: "team_default" });
  const draft = getRenderableTenantConfig(loaded, "draft");
  assert.equal(draft.media.heroImageId, "media_hero_1");
  assert.equal(draft.portfolio.items[0].mediaId, "media_w1");
});

test("manual patch can swap the hero to a library asset and back to a URL", () => {
  const base = normalizeTenantConfig({
    id: "tenant_swap",
    slug: "swap",
    domains: ["swap.local"],
    brand: { name: "Swap Co" }
  });

  const toLibrary = applyManualPatch(base, { media: { heroImageId: "media_9" } });
  assert.equal(toLibrary.valid, true);
  assert.equal(toLibrary.config.media.heroImageId, "media_9");
  assert.equal(toLibrary.config.media.heroImage, base.media.heroImage);

  const toUrl = applyManualPatch(toLibrary.config, {
    media: { heroImageId: "", heroImage: "https://cdn.example.com/h.jpg" }
  });
  assert.equal(toUrl.config.media.heroImageId, "");
  assert.equal(toUrl.config.media.heroImage, "https://cdn.example.com/h.jpg");

  const portfolioSwap = applyManualPatch(base, {
    portfolio: { items: [{ id: "p1", title: "P1", mediaId: "media_p1", mediaType: "image" }] }
  });
  assert.equal(portfolioSwap.valid, true);
  assert.equal(portfolioSwap.config.portfolio.items[0].mediaId, "media_p1");
});

test("heroVideo config survives normalize, sanitize, patch, resolver, and draft round trip", async (t) => {
  const heroVideo = {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    kind: "video",
    videoId: "dQw4w9WgXcQ",
    playlistId: ""
  };

  // normalize fills the empty default and keeps authored blocks wholesale.
  assert.deepEqual(normalizeTenantConfig({}).media.heroVideo, {
    url: "",
    kind: "",
    videoId: "",
    playlistId: ""
  });
  assert.deepEqual(normalizeTenantConfig({ media: { heroVideo } }).media.heroVideo, heroVideo);

  // sanitize keeps valid blocks and coerces garbage to empty.
  assert.deepEqual(sanitizeTenantConfig({ ...defaultTenant, media: { ...defaultTenant.media, heroVideo } }).media.heroVideo, heroVideo);
  const junk = sanitizeTenantConfig({
    ...defaultTenant,
    media: { ...defaultTenant.media, heroVideo: { kind: "video", videoId: "nope", url: "https://evil.example" } }
  });
  assert.deepEqual(junk.media.heroVideo, { url: "", kind: "", videoId: "", playlistId: "" });

  // manual patch (the picker path) one-level merges media and preserves siblings.
  const base = normalizeTenantConfig({
    id: "tenant_yt",
    slug: "yt",
    domains: ["yt.local"],
    brand: { name: "YT Co" }
  });
  const patched = applyManualPatch(base, { media: { heroVideo } });
  assert.equal(patched.valid, true);
  assert.deepEqual(patched.config.media.heroVideo, heroVideo);
  assert.equal(patched.config.media.heroImage, base.media.heroImage);
  const cleared = applyManualPatch(patched.config, {
    media: { heroVideo: { url: "", kind: "", videoId: "", playlistId: "" } }
  });
  assert.equal(cleared.config.media.heroVideo.kind, "");

  // resolver: heroVideo passes through untouched alongside heroImageId resolution.
  const { createMediaAsset, resolveTenantMediaConfig, saveTenantDraftConfig, getTenantByIdOrSlug, getRenderableTenantConfig } =
    await withTempStore(t);
  const asset = await createMediaAsset({ url: "/uploads/team_a/h.png", alt: "A" }, { teamId: "team_a" });
  const config = normalizeTenantConfig({
    media: { heroImage: "/assets/x.png", heroImageId: asset.id, heroAlt: "", heroVideo }
  });
  const resolved = await resolveTenantMediaConfig(config, { teamId: "team_a" });
  assert.equal(resolved.media.heroImage, "/uploads/team_a/h.png");
  assert.deepEqual(resolved.media.heroVideo, heroVideo);

  // draft save/load round trip.
  const saved = await saveTenantDraftConfig(
    null,
    {
      ...defaultTenant,
      id: "tenant_yt_rt",
      slug: "yt-rt",
      domains: ["yt-rt.local"],
      media: { ...defaultTenant.media, heroVideo }
    },
    { teamId: "team_default" }
  );
  const loaded = await getTenantByIdOrSlug(saved.id, { teamId: "team_default" });
  assert.deepEqual(getRenderableTenantConfig(loaded, "draft").media.heroVideo, heroVideo);
});
