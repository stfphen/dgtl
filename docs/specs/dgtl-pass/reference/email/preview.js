// Writes rendered sample emails to docs/specs/dgtl-pass/previews/ for design review.
//
//   node docs/specs/dgtl-pass/reference/email/preview.js
//
// QR codes: if the `qrcode` package can be resolved (set PREVIEW_QRCODE_PATH to
// its absolute path, or run from a checkout where it is installed), previews
// embed a real, scannable QR as a data: URI. Otherwise a placeholder tile is
// used. data: images are for browser previews only. Production emails
// reference the hosted /p/<credential>/qr.png, because Gmail strips data: URIs.

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMAIL_VARIANTS, esc, renderPassEmail, renderPassSms } from "./render.js";
import { buildSample } from "./fixtures.js";
import { resolveBrandKit } from "../brand.js";
import { resolvePassDesign } from "../tiers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../previews");
const require = createRequire(import.meta.url);

async function qrDataUrl(text) {
  try {
    const QRCode = require(process.env.PREVIEW_QRCODE_PATH || "qrcode");
    return await QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 0, width: 400, color: { dark: "#000000", light: "#FFFFFF" } });
  } catch {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/><rect x="8" y="8" width="56" height="56" fill="none" stroke="#000" stroke-width="12"/><rect x="136" y="8" width="56" height="56" fill="none" stroke="#000" stroke-width="12"/><rect x="8" y="136" width="56" height="56" fill="none" stroke="#000" stroke-width="12"/><text x="100" y="108" font-family="Arial" font-size="14" text-anchor="middle">QR</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }
}

const pages = [];

async function emit(file, title, note, input) {
  const out = renderPassEmail({ ...input, allowDataImages: true });
  await writeFile(path.join(outDir, file), out.html);
  pages.push({ file, title, note, subject: out.subject, preheader: out.preheader, warnings: out.warnings, blockers: out.blockers });
}

await mkdir(outDir, { recursive: true });
const qr = await qrDataUrl("https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS");

const titles = {
  day: ["Day · Steel", "Single-entry day ticket. Practical, fast, door-first."],
  monthly: ["Monthly · Bronze", "Membership voice starts here. Wallet is the hero action."],
  yearly: ["Annual · Silver", "A year of access. Warmer, more welcoming."],
  vip_lifetime: ["VIP Lifetime · Gold", "The brand at full strength: gold frame, centered, personal."],
  vip_onboarding: ["VIP Onboarding · Invitation", "Hook + offer. Previews the pass; the QR is revealed on accept."]
};

for (const variant of EMAIL_VARIANTS) {
  const [title, note] = titles[variant];
  await emit(`${variant}.html`, title, note, buildSample(variant, { qrImageUrl: qr }));
}

await emit(
  "vip_onboarding-no-consent.html",
  "VIP Onboarding · no marketing consent",
  "Same invitation for a holder with no consent on file: the offer and unsubscribe are removed automatically.",
  buildSample("vip_onboarding", { qrImageUrl: qr, marketingAllowed: false })
);

// White-label proof: a fictional light-themed tenant with a blue brand, zero code changes.
const lightTenant = {
  brand: { name: "Northside Studio", logoText: "NORTHSIDE", primaryColor: "#2459E0" },
  passes: {
    brandKit: {
      theme: "light",
      legal: { postalAddress: "Sample address · Vancouver, BC · Canada", supportEmail: "help@example.com" }
    }
  }
};
const light = buildSample("monthly", { qrImageUrl: qr });
light.brandKit = resolveBrandKit(lightTenant);
light.passType = { ...light.passType, design: { ...light.passType.design, useBrandAccent: true } };
light.design = resolvePassDesign(light.passType, light.brandKit);
await emit(
  "monthly-light-tenant.html",
  "Monthly · another tenant (light kit)",
  "A fictional tenant with a light brand kit and a blue accent. Same templates, no code change.",
  light
);

const sms = [false, true].map((vip) =>
  renderPassSms({
    vip,
    brandKit: resolveBrandKit({}),
    passType: { name: vip ? "VIP Lifetime" : "Monthly Pass" },
    holder: { name: vip ? "Alex Rivera" : "Maya Chen" },
    url: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS"
  })
);

const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DGTL Pass email previews</title>
<style>
  :root { --bg:#000; --surface:#0a0a0a; --line:#2a2a2a; --text:#F0F0F0; --dim:#8a8a8a; --gold:#F0CF50; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:Manrope, "Helvetica Neue", Arial, sans-serif; }
  header { padding:40px 24px 8px; max-width:1400px; margin:0 auto; }
  h1 { margin:0 0 8px; font-size:28px; letter-spacing:-0.3px; }
  p.lead { margin:0; color:var(--dim); max-width:760px; line-height:1.6; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(420px, 1fr)); gap:24px; padding:24px; max-width:1400px; margin:0 auto; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .meta { padding:18px 20px; border-bottom:1px solid var(--line); }
  .meta h2 { margin:0 0 6px; font-size:16px; } .meta h2 a { color:var(--gold); text-decoration:none; }
  .meta p { margin:0 0 4px; font-size:13px; color:var(--dim); line-height:1.5; }
  .meta code { color:var(--text); }
  iframe { width:100%; height:1100px; border:0; background:#000; display:block; }
  .sms { max-width:1400px; margin:0 auto; padding:0 24px 48px; }
  .bubble { display:inline-block; max-width:420px; margin:8px 12px 8px 0; padding:12px 16px; border-radius:18px; background:#1f1f1f; font-size:14px; line-height:1.45; }
  .bubble small { display:block; margin-top:6px; color:var(--dim); font-size:11px; }
  @media (max-width:480px) { .grid { grid-template-columns:1fr; padding:16px; } iframe { height:1000px; } }
</style></head>
<body>
<header>
  <h1>DGTL Pass: email previews</h1>
  <p class="lead">Rendered by <code>reference/email/render.js</code> from the default DGTL brand kit and tier presets. All names, addresses and offers are sample content. The Apple Wallet button is a placeholder until the official badge artwork is configured. The QR codes are real and point at a sample URL.</p>
</header>
<div class="grid">
${pages
  .map(
    (p) => `<section class="card"><div class="meta">
  <h2><a href="${esc(p.file)}">${esc(p.title)}</a></h2>
  <p>${esc(p.note)}</p>
  <p>Subject: <code>${esc(p.subject)}</code></p>
  <p>Preheader: <code>${esc(p.preheader)}</code></p>
  ${p.warnings.length ? `<p>Renderer notes: <code>${esc(p.warnings.join(", "))}</code></p>` : ""}
</div><iframe src="${esc(p.file)}" title="${esc(p.title)}" loading="lazy"></iframe></section>`
  )
  .join("\n")}
</div>
<div class="sms"><h2 style="font-size:16px">SMS</h2>
${sms.map((s) => `<div class="bubble">${esc(s.body)}<small>${s.units} chars · ${s.encoding} · ${s.segments} segment</small></div>`).join("\n")}
</div>
</body></html>`;

await writeFile(path.join(outDir, "index.html"), index);
console.log(`Wrote ${pages.length} previews + index.html to ${path.relative(process.cwd(), outDir)}`);
for (const p of pages) console.log(` - ${p.file}${p.blockers.length ? `  BLOCKED: ${p.blockers.join(",")}` : ""}`);
