// DGTL Pass — branded Apple Wallet artwork (reference implementation).
//
// Wallet passes carry images, not CSS, so the DGTL identity is drawn here as
// SVG. Phase 5 rasterizes these exact SVGs to @1x/@2x/@3x PNGs with `sharp`
// (already in the platform tree through next); the email and the holder pass
// page show the same strip PNG, so the pass looks identical everywhere.
//
// One composition for every tier: brand constant + tier variable.
//
//   strip (375×98 eventTicket, 375×144 storeCard)
//     1. the tier face (deep tint)
//     2. the tier field glowing in from the right, behind everything
//     3. a giant spark watermark in the tier accent, rotated, cropped
//     4. THE DGTL spark, crisp, in the brand mark color (DGTL gold) at the right
//     5. a 2-pt tier-accent hairline along the base
//   The left ~55% stays calm: Wallet overlays the primary field text there.
//
//   thumbnail (90×90, generic) — the gold spark on the tier face, tier ring
//   icon (29×29, required)     — the gold spark on black
//
// The spark path comes from engine/dgtl-brand-kit/assets/logos/spark.svg. The
// platform build can't reach engine/ at runtime, so copy the file into
// platform/assets/brand/ with a byte-identical drift test (task P5.2). Never
// retype the path.
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
 * Branded strip. Pass `scale` 2 or 3 for the @2x/@3x files (vector; only the canvas grows).
 *   face: tier face · field: tier field · accent: tier accent · mark: brand mark color (DGTL gold)
 */
export function stripSvg({ spark, width = 375, height = 144, face, field, accent, mark, vip = false, scale = 1 }) {
  color(face, "face");
  color(field, "field");
  color(accent, "accent");
  color(mark, "mark");
  const ratio = spark.width / spark.height;
  // giant watermark: twice the strip height, rotated, cropped top and bottom
  const wmH = height * 2.1;
  const wmLeft = width * 0.5;
  const wmTop = -height * 0.55;
  // the brand spark: 80% of the strip height, right-aligned with a margin
  const bH = height * 0.8;
  const bW = bH * ratio;
  const bLeft = width - bW - width * 0.075;
  const bTop = (height - bH) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${field}" stop-opacity="0"/>
      <stop offset="0.45" stop-color="${field}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${field}" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.5" r="${vip ? 0.42 : 0.55}">
      <stop offset="0" stop-color="${vip ? mark : accent}" stop-opacity="${vip ? 0.38 : 0.3}"/>
      <stop offset="1" stop-color="${vip ? mark : accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${face}"/>
  <rect width="${width}" height="${height}" fill="url(#field)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  ${sparkUse(spark, { left: wmLeft, top: wmTop, h: wmH, fill: accent, opacity: vip ? 0.1 : 0.14, rotate: -14 })}
  ${sparkUse(spark, { left: bLeft, top: bTop, h: bH, fill: mark })}
  <rect x="0" y="${height - 2}" width="${width}" height="2" fill="${accent}"/>
</svg>`;
}

// Thumbnail for generic passes: 90×90 pt. The gold spark on the tier face, tier ring.
export function thumbnailSvg({ spark, size = 90, face, accent, mark, scale = 1 }) {
  color(face, "face");
  color(accent, "accent");
  color(mark, "mark");
  const h = size * 0.66;
  const w = spark.width * (h / spark.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${face}"/>
  <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${size * 0.18}" fill="none" stroke="${accent}" stroke-width="2"/>
  ${sparkUse(spark, { left: (size - w) / 2, top: (size - h) / 2, h, fill: mark })}
</svg>`;
}

// icon.png: 29×29 pt, required on every pass. The brand spark on black.
export function iconSvg({ spark, size = 29, background = "#000000", mark, scale = 1 }) {
  color(background, "background");
  color(mark, "mark");
  const h = size * 0.74;
  const w = spark.width * (h / spark.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  ${sparkUse(spark, { left: (size - w) / 2, top: (size - h) / 2, h, fill: mark })}
</svg>`;
}

// Which artwork a resolved pass design needs, with Apple's point sizes.
export function artworkFor(design) {
  const { style } = design.wallet;
  const common = { face: design.face, field: design.field, accent: design.accent, mark: design.brandMark, vip: design.isVip };
  if (style === "generic") return [{ file: "thumbnail", kind: "thumbnail", size: 90, ...common }];
  return [{ file: "strip", kind: "strip", width: 375, height: style === "eventTicket" ? 98 : 144, ...common }];
}

// The same strip, sized for the email and pass-page card (552 px wide in email).
export function cardArtSvg(design, spark, { scale = 2 } = {}) {
  return stripSvg({ spark, width: 375, height: 120, face: design.face, field: design.field, accent: design.accent, mark: design.brandMark, vip: design.isVip, scale });
}
