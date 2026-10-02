// Ported from docs/specs/dgtl-pass/reference/walletArt.test.js (paths only).
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveBrandKit } from "../lib/passes/brandKit.js";
import { TIER_PALETTE, TIER_PRESETS, resolvePassDesign } from "../lib/passes/tiers.js";
import { artworkFor, iconSvg, sparkFromSvg, stripSvg, thumbnailSvg } from "../lib/passes/art.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const spark = sparkFromSvg(await readFile(path.join(repoRoot, "engine/dgtl-brand-kit/assets/logos/spark.svg"), "utf8"));
const kit = resolveBrandKit({});

test("the spark comes from the brand kit file, not a retyped path", () => {
  assert.equal(spark.width, 327);
  assert.equal(spark.height, 450);
  assert.match(spark.d, /^M529\.17/);
  assert.throws(() => sparkFromSvg("<svg></svg>"), /viewBox/);
});

test("strip art: tier face and field, tier watermark, gold DGTL spark, sized for Apple", () => {
  const p = TIER_PALETTE.steel;
  const svg = stripSvg({ spark, width: 375, height: 98, face: p.face, field: p.field, accent: p.accent, mark: "#F0CF50", scale: 2 });
  assert.match(svg, /width="750" height="196" viewBox="0 0 375 98"/);
  for (const c of [p.face, p.field, p.accent, "#F0CF50"]) assert.ok(svg.includes(c), `strip uses ${c}`);
  assert.equal((svg.match(new RegExp(`d="${spark.d.slice(0, 12).replace(/[.]/g, "\\.")}`, "g")) || []).length, 2, "watermark + brand mark");
  assert.ok(!/href=|<image|url\((?!#)/.test(svg), "self-contained: no external references");
  assert.throws(() => stripSvg({ spark, face: "black", field: p.field, accent: p.accent, mark: "#F0CF50" }), /#RRGGBB/);
});

test("the gold spark is crisp on every tier; VIP gets the gold spotlight", () => {
  for (const key of ["steel", "bronze", "silver", "gold"]) {
    const p = TIER_PALETTE[key];
    const svg = stripSvg({ spark, face: p.face, field: p.field, accent: p.accent, mark: "#F0CF50", vip: key === "gold" });
    assert.match(svg, /fill="#F0CF50"\/><\/g>/, `${key}: brand spark present`);
  }
  assert.match(stripSvg({ spark, ...TIER_PALETTE.gold, mark: "#F0CF50", vip: true }), /stop-color="#F0CF50" stop-opacity="0\.38"/);
});

test("every preset gets the artwork its Wallet style needs, in its own palette", () => {
  const expected = { day_single: ["strip", 98], day: ["strip", 98], monthly: ["strip", 144], yearly: ["strip", 144], vip_lifetime: ["strip", 144] };
  for (const [presetId, [kind, size]] of Object.entries(expected)) {
    const p = TIER_PRESETS[presetId];
    const [art] = artworkFor(resolvePassDesign({ tier: p.tier, isVip: p.isVip, design: p.design }, kit));
    assert.equal(art.kind, kind, presetId);
    assert.equal(art.height ?? art.size, size, presetId);
    assert.equal(art.face, p.design.face, presetId);
    assert.equal(art.mark, "#F0CF50", `${presetId}: DGTL gold brand mark`);
  }
});

test("thumbnail and icon render at their point sizes", () => {
  assert.match(thumbnailSvg({ spark, face: "#3A1F0C", accent: "#E0A170", mark: "#F0CF50", scale: 3 }), /width="270" height="270" viewBox="0 0 90 90"/);
  assert.match(iconSvg({ spark, mark: "#F0CF50", scale: 3 }), /width="87" height="87" viewBox="0 0 29 29"/);
});
