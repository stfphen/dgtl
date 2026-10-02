// DGTL Pass — QR codes for the holder pass page and the admin "open on phone" panel.
//
// Level M with a 4-module quiet zone, black on white, as an SVG data URI: it
// scales to any screen and needs no image route. The text is always one of our
// own URLs (the pass link), never user input.

import QRCode from "qrcode";

export async function qrSvg(text, { margin = 4 } = {}) {
  return QRCode.toString(String(text), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    color: { dark: "#000000", light: "#FFFFFF" }
  });
}

export async function qrDataUri(text, options) {
  const svg = await qrSvg(text, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
