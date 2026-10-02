// DGTL Pass — Wallet artwork as PNG, rasterized with sharp from the SVGs in
// lib/passes/art.js (the brand kit's spark and wordmark, never retyped).
//
// Two consumers, one look:
//   appleImages(design)        icon / logo / strip (or thumbnail) at @1x, @2x, @3x,
//                              in Apple's point sizes, for a DGTL-signed .pkpass
//   walletWalletImages(design) the same art as data URIs in WalletWallet Pro's
//                              sizes (strip 1080×360, icon 120×120)
//
// Rendering is deterministic per design, so results are cached in memory.

import sharp from "sharp";
import { iconSvg, SPARK, stripSvg, thumbnailSvg } from "../art.js";
import { WORDMARK_SVG } from "../brandAssets.js";
import { requiredImages } from "./passJson.js";

const SCALES = [1, 2, 3];
const CACHE_LIMIT = 200;
const cache = new Map();

function cached(key, make) {
  if (!cache.has(key)) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, make().catch((error) => {
      cache.delete(key);
      throw error;
    }));
  }
  return cache.get(key);
}

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

// The wordmark has only a viewBox: render it large, then fit it inside the box.
const wordmark = (width, height) =>
  sharp(Buffer.from(WORDMARK_SVG), { density: 600 }).resize({ width, height, fit: "inside" }).png({ compressionLevel: 9 }).toBuffer();

const designKey = (design) =>
  [design.wallet.style, design.face, design.field, design.accent, design.brandMark, design.isVip ? "vip" : ""].join("|");

function artFor(design, file, scale) {
  const common = { spark: SPARK, face: design.face, field: design.field, accent: design.accent, mark: design.brandMark, scale };
  if (file === "strip") {
    const height = design.wallet.style === "eventTicket" ? 98 : 144;
    return png(stripSvg({ ...common, width: 375, height, vip: design.isVip }));
  }
  if (file === "thumbnail") return png(thumbnailSvg({ ...common, size: 90 }));
  throw new Error(`No artwork for ${file}.`);
}

/** Every image a DGTL-signed pass of this design needs, keyed by filename. */
export function appleImages(design) {
  return cached(`apple|${designKey(design)}`, async () => {
    const files = {};
    const slots = Object.keys(requiredImages(design.wallet.style)).map((name) => name.replace(/\.png$/, ""));
    for (const slot of slots) {
      for (const scale of SCALES) {
        const name = scale === 1 ? `${slot}.png` : `${slot}@${scale}x.png`;
        if (slot === "icon") files[name] = await png(iconSvg({ spark: SPARK, size: 29, mark: design.brandMark, scale }));
        else if (slot === "logo") files[name] = await wordmark(160 * scale, 50 * scale);
        else files[name] = await artFor(design, slot, scale);
      }
    }
    return files;
  });
}

const dataUri = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`;

/** WalletWallet Pro art: data URIs, each well under its 1 MB limit. */
export function walletWalletImages(design) {
  return cached(`ww|${designKey(design)}`, async () => {
    const strip = await sharp(
      Buffer.from(stripSvg({ spark: SPARK, width: 375, height: 125, face: design.face, field: design.field, accent: design.accent, mark: design.brandMark, vip: design.isVip, scale: 3 }))
    )
      .resize(1080, 360, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return {
      stripURL: dataUri(strip),
      iconURL: dataUri(await png(iconSvg({ spark: SPARK, size: 120, mark: design.brandMark }))),
      logoURL: dataUri(await wordmark(480, 150))
    };
  });
}

export function __clearWalletImageCacheForTests() {
  cache.clear();
}
