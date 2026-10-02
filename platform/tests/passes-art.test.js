// DGTL Pass: brand assets that are copied, never retyped. The spark comes from
// the brand kit; the scanner's decoder is self-hosted so the door never waits
// on a CDN. Both fail here the moment they drift from their source.

import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPARK_SVG } from "../lib/passes/brandAssets.js";
import { cardArtSvg, SPARK, sparkSvg } from "../lib/passes/art.js";
import { resolveBrandKit } from "../lib/passes/brandKit.js";
import { resolvePassDesign, TIER_PALETTE } from "../lib/passes/tiers.js";
import { ZXING_WASM_SHA256, ZXING_WASM_VERSION } from "zxing-wasm/reader";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the spark is byte-identical to the brand kit's (rerun scripts/sync-pass-brand-assets.mjs)", async () => {
  const kit = await readFile(path.resolve(platformRoot, "../engine/dgtl-brand-kit/assets/logos/spark.svg"), "utf8");
  assert.equal(SPARK_SVG, kit);
  assert.equal(SPARK.width, 327);
  assert.ok(SPARK.d.length > 200);
});

test("card art: the DGTL spark in the brand mark colour on every tier, the tier's own face", () => {
  const kit = resolveBrandKit({ brand: { name: "DGTL", primaryColor: TIER_PALETTE.gold.accent } });
  for (const [tier, palette] of [["day", TIER_PALETTE.steel], ["monthly", TIER_PALETTE.bronze], ["yearly", TIER_PALETTE.silver], ["vip_lifetime", TIER_PALETTE.gold]]) {
    const svg = cardArtSvg(resolvePassDesign({ tier, isVip: tier === "vip_lifetime" }, kit), SPARK);
    assert.match(svg, new RegExp(`fill="${palette.face}"`), `${tier} face`);
    assert.match(svg, new RegExp(`d="${SPARK.d.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*" fill="${TIER_PALETTE.gold.accent}"`), `${tier} carries the gold spark`);
  }
  assert.match(sparkSvg(TIER_PALETTE.steel.accent), new RegExp(`fill="${TIER_PALETTE.steel.accent}"`));
  assert.throws(() => sparkSvg("gold"), /#RRGGBB/);
});

test("the self-hosted zxing decoder is the exact build the package pins", async () => {
  const wasm = await readFile(path.join(platformRoot, "public/scan/zxing_reader.wasm"));
  assert.equal(crypto.createHash("sha256").update(wasm).digest("hex"), ZXING_WASM_SHA256, `public/scan/zxing_reader.wasm must be zxing-wasm ${ZXING_WASM_VERSION}'s; copy it from node_modules/zxing-wasm/dist/reader/`);
  const scanner = await readFile(path.join(platformRoot, "components/scan/Scanner.jsx"), "utf8");
  assert.match(scanner, /WASM_URL = "\/scan\/zxing_reader\.wasm"/);
  assert.match(scanner, /locateFile/, "the decoder must never fall back to its default CDN");
});
