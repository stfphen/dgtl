// DGTL Pass — Apple Wallet artwork (reference implementation).
//
// Wallet passes carry images, not CSS, so the brand kit's "atmosphere" (the
// spark bolt, the black ladder, the material hairline) is drawn here as SVG.
// Phase 5 rasterizes these exact SVGs to @1x/@2x/@3x PNGs with `sharp`
// (already in the platform tree through next): see 07-apple-wallet.md "Artwork".
//
// One composition for every tier, so a Wallet stack reads as one family:
//   strip     — pass background, a soft radial glow of the material, the spark
//               cropped off the right edge (primary fields sit on the left, where
//               Wallet overlays them), a 1-pt material hairline at the base
//   thumbnail — the spark centred on the pass background (generic passes;
//               roadmap R4 swaps it for the holder photo)
//   icon      — the spark on black (lock screen, Mail, notifications)
//
// VIP renders the spark at full strength. The lower tiers render it as a
// watermark, so gold stays the loudest thing in the Wallet.
//
// The spark path comes from engine/dgtl-brand-kit/assets/logos/spark.svg. The
// platform build can't reach engine/ at runtime, so copy the file into
// platform/assets/brand/ and add a drift test (task P5.2). Never retype the path.
//
// Port target: platform/lib/passes/wallet/art.js.

import { isHex } from "./brand.js";

export function sparkFromSvg(svgText) {
  const viewBox = /viewBox="([^"]+)"/.exec(svgText)?.[1];
  const d = /<path[^>]*\sd="([^"]+)"/.exec(svgText)?.[1];
  if (!viewBox || !d) throw new Error("spark.svg must contain a viewBox and a single path.");
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  return { d, x, y, width, height };
}

function color(value, name) {
  if (!isHex(value)) throw new Error(`${name} must be a #RRGGBB color.`);
  return value;
}

// Place the spark so that it is `h` units tall, with its box's top-left at (left, top).
function sparkUse(spark, { left, top, h, fill, opacity = 1, rotate = 0 }) {
  const scale = h / spark.height;
  const w = spark.width * scale;
  const cx = left + w / 2;
  const cy = top + h / 2;
  return `<g transform="rotate(${rotate} ${cx.toFixed(1)} ${cy.toFixed(1)})" opacity="${opacity}"><path transform="translate(${left.toFixed(2)} ${top.toFixed(2)}) scale(${scale.toFixed(5)}) translate(${-spark.x} ${-spark.y})" d="${spark.d}" fill="${fill}"/></g>`;
}

/**
 * Strip image. eventTicket strips are 375×98 pt, storeCard strips 375×144 pt.
 * Pass `scale` 2 or 3 for the @2x/@3x files (the SVG is vector; only the canvas grows).
 */
export function stripSvg({ spark, width = 375, height = 144, background, material, vip = false, scale = 1 }) {
  color(background, "background");
  color(material, "material");
  // The bolt stays recognisable: ~95% of its width on the canvas, a slight
  // crop top and bottom, clear of the left half where Wallet sets the text.
  const h = height * 1.25;
  const sparkW = spark.width * (h / spark.height);
  const left = width - sparkW * 0.95;
  const top = -height * 0.12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="glow" cx="0.82" cy="0.5" r="0.75">
      <stop offset="0" stop-color="${material}" stop-opacity="${vip ? 0.22 : 0.1}"/>
      <stop offset="1" stop-color="${material}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${background}"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  ${sparkUse(spark, { left, top, h, fill: material, opacity: vip ? 0.95 : 0.32, rotate: -8 })}
  <rect x="0" y="${height - 1}" width="${width}" height="1" fill="${material}" opacity="${vip ? 0.9 : 0.6}"/>
</svg>`;
}

// Thumbnail for generic passes: 90×90 pt.
export function thumbnailSvg({ spark, size = 90, background, material, scale = 1 }) {
  color(background, "background");
  color(material, "material");
  const h = size * 0.7;
  const w = spark.width * (h / spark.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${background}"/>
  <rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${size * 0.18}" fill="none" stroke="${material}" stroke-opacity="0.35"/>
  ${sparkUse(spark, { left: (size - w) / 2, top: (size - h) / 2, h, fill: material })}
</svg>`;
}

// icon.png: 29×29 pt, required on every pass. The spark on black, full strength.
export function iconSvg({ spark, size = 29, background = "#000000", material, scale = 1 }) {
  color(background, "background");
  color(material, "material");
  const h = size * 0.74;
  const w = spark.width * (h / spark.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  ${sparkUse(spark, { left: (size - w) / 2, top: (size - h) / 2, h, fill: material })}
</svg>`;
}

// Which artwork a resolved pass design needs, with Apple's point sizes.
export function artworkFor(design) {
  const { style, background, label } = design.wallet;
  if (style === "generic") return [{ file: "thumbnail", kind: "thumbnail", size: 90, background, material: label }];
  return [{ file: "strip", kind: "strip", width: 375, height: style === "eventTicket" ? 98 : 144, background, material: label, vip: design.isVip }];
}
