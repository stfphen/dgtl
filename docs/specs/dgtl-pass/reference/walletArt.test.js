import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveBrandKit } from "./brand.js";
import { TIER_PRESETS, resolvePassDesign } from "./tiers.js";
import { artworkFor, iconSvg, sparkFromSvg, stripSvg, thumbnailSvg } from "./walletArt.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const spark = sparkFromSvg(await readFile(path.join(repoRoot, "engine/dgtl-brand-kit/assets/logos/spark.svg"), "utf8"));
const kit = resolveBrandKit({});

test("the spark comes from the brand kit file, not a retyped path", () => {
  assert.equal(spark.width, 327);
  assert.equal(spark.height, 450);
  assert.match(spark.d, /^M529\.17/);
  assert.throws(() => sparkFromSvg("<svg></svg>"), /viewBox/);
});

test("strip art: kit spark in the material color on the pass background, sized for Apple", () => {
  const svg = stripSvg({ spark, width: 375, height: 98, background: "#111111", material: "#A9B4C2", scale: 2 });
  assert.match(svg, /width="750" height="196" viewBox="0 0 375 98"/);
  assert.ok(svg.includes('fill="#111111"'));
  assert.ok(svg.includes(`d="${spark.d}"`));
  assert.ok(svg.includes('fill="#A9B4C2"'));
  assert.ok(!/href=|<image|url\((?!#)/.test(svg), "self-contained: no external references");
  assert.throws(() => stripSvg({ spark, background: "black", material: "#fff000" }), /#RRGGBB/);
});

test("VIP strip runs the spark at full strength; lower tiers keep it a watermark", () => {
  const vip = stripSvg({ spark, background: "#000000", material: "#F0CF50", vip: true });
  const day = stripSvg({ spark, background: "#111111", material: "#A9B4C2" });
  assert.match(vip, /opacity="0\.95"/);
  assert.match(day, /opacity="0\.32"/);
});

test("every preset gets the artwork its Wallet style needs", () => {
  const expected = { day_single: ["strip", 98], day: ["strip", 98], monthly: ["thumbnail", 90], yearly: ["thumbnail", 90], vip_lifetime: ["strip", 144] };
  for (const [presetId, [kind, size]] of Object.entries(expected)) {
    const p = TIER_PRESETS[presetId];
    const [art] = artworkFor(resolvePassDesign({ tier: p.tier, isVip: p.isVip, design: p.design }, kit));
    assert.equal(art.kind, kind, presetId);
    assert.equal(art.height ?? art.size, size, presetId);
    assert.equal(art.material, p.design.accent, `${presetId} art is drawn in the tier material`);
  }
});

test("thumbnail and icon render at their point sizes", () => {
  assert.match(thumbnailSvg({ spark, background: "#0a0a0a", material: "#D29666", scale: 3 }), /width="270" height="270" viewBox="0 0 90 90"/);
  assert.match(iconSvg({ spark, material: "#F0CF50", scale: 3 }), /width="87" height="87" viewBox="0 0 29 29"/);
});
