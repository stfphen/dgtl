// Writes the DGTL Pass UI design targets into docs/specs/dgtl-pass/previews/:
//
//   wallet.html     the five Apple Wallet passes (front, stack, back) from buildPassJson + walletArt
//   pass-page.html  the holder pass page (/p/<credential>) in its three states
//   scanner.html    the /scan PWA: start, scanning, admit, VIP admit, warn, deny, offline, manual
//   admin.html      the admin Passes tab: overview, live scans, and issue with live preview
//
//   node docs/specs/dgtl-pass/reference/ui/mockups.js
//   (set PREVIEW_QRCODE_PATH to a `qrcode` install for real QR codes; otherwise a placeholder)
//
// Styled ONLY from the DGTL brand kit: engine/dgtl-brand-kit/assets/dgtl-tokens.css is read
// and inlined verbatim, and the logo and spark come from the kit's assets/logos. Content comes
// from the reference modules (verdict titles, validity labels, Wallet field layout), so the
// mockups can't drift from the code.
//
// These are design targets, not production code. The platform builds them in React against
// platform/app/admin/dgtl-admin.css, where the kit's gold is spelled --blue (the kit's
// references/repo-surfaces.md). Sample people and numbers are fictional and labelled as such.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBrandKit } from "../brand.js";
import { TIER_PRESETS, TIER_MATERIALS, resolvePassDesign } from "../tiers.js";
import { computeValidityWindow, describeValidity } from "../validity.js";
import { RESULT_META } from "../verify.js";
import { buildPassJson } from "../passJson.js";
import { iconSvg, sparkFromSvg, stripSvg, thumbnailSvg } from "../walletArt.js";
import { formatShortCode } from "../credentials.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const kitDir = path.join(repoRoot, "engine/dgtl-brand-kit/assets");
const outDir = path.resolve(here, "../../previews");
const require = createRequire(import.meta.url);

const TOKENS_CSS = await readFile(path.join(kitDir, "dgtl-tokens.css"), "utf8");
const LOGO_SVG = await readFile(path.join(kitDir, "logos/logo-white-gold.svg"), "utf8");
const SPARK_SVG = await readFile(path.join(kitDir, "logos/spark.svg"), "utf8");
const spark = sparkFromSvg(SPARK_SVG);
const FONT = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
const LOGO = svgUrl(LOGO_SVG);
const sparkIn = (fill) => svgUrl(SPARK_SVG.replace(/fill="#F0CF50"/, `fill="${fill}"`));

async function qrSvg(text) {
  try {
    const QRCode = require(process.env.PREVIEW_QRCODE_PATH || "qrcode");
    return await QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#FFFFFF" } });
  } catch {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 33"><rect width="33" height="33" fill="#fff"/><path d="M1 1h7v7H1zM25 1h7v7h-7zM1 25h7v7H1z" fill="none" stroke="#000" stroke-width="2"/></svg>`;
  }
}
const QR = await qrSvg("https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS");

const kit = resolveBrandKit({ brand: { name: "DGTL", logoText: "DGTL" }, passes: { brandKit: { logoIncludesName: true, legal: { supportEmail: "help@example.com", termsUrl: "https://example.com/terms" } } } });
const TZ = "America/Toronto";

function sample(presetId, holderName, startDate, shortCode, extra = {}) {
  const preset = TIER_PRESETS[presetId];
  const passType = { name: preset.name, tier: preset.tier, isVip: preset.isVip, design: preset.design };
  const window = computeValidityWindow({ rule: preset.validity, startDate, timeZone: TZ });
  const pass = { id: `pass_${presetId}`, status: "active", maxUses: preset.usage.maxUses, shortCode, ...window, ...extra };
  const design = resolvePassDesign(passType, kit);
  const validity = describeValidity(pass, { timeZone: TZ });
  return { preset, passType, pass, design, validity, holder: { name: holderName } };
}

const SAMPLES = [
  sample("day_single", "Jordan Avery", "2026-10-03", "K7M2QX9P"),
  sample("day", "Priya Nair", "2026-10-03", "D4YP8SS2"),
  sample("monthly", "Maya Chen", "2026-09-30", "Q4TN8WZ2"),
  sample("yearly", "Sam Okafor", "2026-09-30", "M3RX7HB9"),
  sample("vip_lifetime", "Alex Rivera", "2026-09-30", "V1PG0LD8")
];

function page({ title, lede, css, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT}" rel="stylesheet">
<style>
/* ---- engine/dgtl-brand-kit/assets/dgtl-tokens.css (inlined verbatim) ---- */
${TOKENS_CSS}
/* ---- mockup page chrome ---- */
.wrap{max-width:1320px;margin:0 auto;padding:56px 24px 96px;display:grid;grid-template-columns:minmax(0,1fr);gap:56px}
.head{display:grid;gap:12px;max-width:780px;min-width:0}
.head h1{font-size:clamp(32px,4vw,48px);font-weight:700;letter-spacing:-1.4px;line-height:1.1;color:var(--text)}
.head p{color:var(--text-muted)}
.head .nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.head .nav a{font-size:14px;color:var(--text-muted);text-decoration:none;border:1px solid var(--border);border-radius:var(--r-pill);padding:8px 16px}
.head .nav a[aria-current]{background:var(--text);color:#000;border-color:var(--text)}
.section{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;min-width:0}
.section h2{font-size:24px;font-weight:700;color:var(--text);letter-spacing:-0.4px}
.section > p{color:var(--text-muted);max-width:70ch}
.note{font-size:13px;color:var(--text-dim);max-width:72ch}
.mono{font-family:ui-monospace,'SFMono-Regular',Menlo,monospace}
.row{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
figure{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin:0;min-width:0;max-width:100%;flex:0 1 auto}
figcaption{font-size:13px;color:var(--text-dim);max-width:390px;line-height:1.5}
figcaption b{color:var(--text-muted);font-weight:600}
.phone{width:390px;max-width:100%;min-height:844px;border-radius:44px;border:1px solid var(--border);background:var(--bg);overflow:hidden;position:relative;box-shadow:var(--shadow-card);display:flex;flex-direction:column}
.status{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;font-size:14px;font-weight:600;color:var(--text);flex:none}
.watermark{position:absolute;width:520px;right:-170px;top:110px;opacity:.05;transform:rotate(-12deg);pointer-events:none}
.vignette{position:absolute;inset:0;background:radial-gradient(120% 55% at 50% 0%,rgba(255,255,255,.035),transparent 60%);pointer-events:none}
.chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border-radius:var(--r-pill);font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;padding:5px 10px;color:var(--tier);background:color-mix(in srgb,var(--tier) 12%,transparent)}
@media (max-width:480px){.wrap{padding:40px 16px 72px;gap:44px}.phone{border-radius:28px}}
${css}
</style></head>
<body><div class="wrap">
<header class="head">
  <img src="${LOGO}" alt="DGTL" height="26" style="height:26px;width:auto">
  <span class="eyebrow">DGTL Pass · UI design targets · DGTL brand kit</span>
  <h1>${esc(title)}</h1>
  <p>${lede}</p>
  <nav class="nav" aria-label="Design targets">
    ${[["index.html", "Emails"], ["wallet.html", "Wallet passes"], ["pass-page.html", "Pass page"], ["scanner.html", "Scanner"], ["admin.html", "Admin"]]
      .map(([href, label]) => `<a href="${href}"${href === `${title.toLowerCase().includes("wallet") ? "wallet" : title.toLowerCase().includes("scanner") ? "scanner" : title.toLowerCase().includes("admin") ? "admin" : "pass-page"}.html` ? ' aria-current="page"' : ""}>${label}</a>`)
      .join("")}
  </nav>
</header>
${body}
<p class="note">Sample people, numbers and offers are fictional. Styled only from <span class="mono">engine/dgtl-brand-kit</span> tokens and assets. Production code reads the same values through <span class="mono">platform/app/admin/dgtl-admin.css</span>.</p>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// wallet.html
// ---------------------------------------------------------------------------

const WALLET_CSS = `
.wcard{width:330px;max-width:100%;border-radius:var(--r-card);background:var(--wbg);color:var(--wfg);overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.07);display:flex;flex-direction:column}
.w-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px 12px}
.w-logo{height:24px;width:auto;margin-top:2px}
.w-f{display:grid;gap:2px;min-width:0}
.w-l{font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--wlb)}
.w-v{font-size:14px;font-weight:600;line-height:1.25;color:var(--wfg)}
.w-hdr{text-align:right}
.w-strip{position:relative;background-size:cover;background-position:center}
.w-strip .w-primary{position:absolute;left:16px;bottom:14px}
.w-primary .w-v{font-size:24px;font-weight:700;letter-spacing:-.4px}
.w-prow{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 16px 10px}
.w-thumb{width:60px;height:60px;border-radius:9px}
.w-fields{display:flex;justify-content:space-between;gap:12px;padding:12px 16px 0}
.w-fields .w-f:last-child{text-align:right}
.w-barcode{margin:18px auto 18px;background:#fff;border-radius:7px;padding:10px 10px 6px;display:grid;justify-items:center;gap:4px;width:146px}
.w-barcode svg{width:126px;height:126px;display:block}
.w-alt{font-family:ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:10px;letter-spacing:.18em;color:#000}
.stack{display:grid;justify-items:start}
.stack .wcard{margin-top:-382px}
.stack .wcard:first-child{margin-top:0}
.spec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}
.spec-card{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-card);padding:20px;display:grid;gap:12px;align-content:start}
.spec-card h3{font-size:15px;font-weight:700}
.spec-card img{max-width:100%;border-radius:7px;border:1px solid var(--border)}
.back{width:330px;max-width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-card);padding:8px 0}
.back div{padding:12px 18px;border-bottom:1px solid #1c1c1c}
.back div:last-child{border-bottom:0}
.back dt{font-size:12px;color:var(--text-dim)}
.back dd{margin:2px 0 0;font-size:14px;color:var(--text);word-break:break-all}
`;

function walletFields(fields = [], cls = "w-fields") {
  if (!fields.length) return "";
  return `<div class="${cls}">${fields.map((f) => `<div class="w-f"><span class="w-l">${esc(f.label)}</span><span class="w-v">${esc(f.value)}</span></div>`).join("")}</div>`;
}

function walletCard(s) {
  const json = buildPassJson({
    pass: s.pass, passType: s.passType, holder: s.holder, brandKit: kit, design: s.design, validity: s.validity,
    links: { credentialUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS", passPageUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS" },
    wallet: { passTypeIdentifier: "pass.io.dgtl.passes", teamIdentifier: "ABCDE12345" },
    issuedLabel: "Sep 30, 2026"
  });
  const style = s.design.wallet.style;
  const body = json[style];
  const vars = `--wbg:${s.design.wallet.background};--wfg:${s.design.wallet.foreground};--wlb:${s.design.wallet.label}`;
  const header = `<div class="w-top"><img class="w-logo" src="${LOGO}" alt="DGTL">${walletFields(body.headerFields, "w-f w-hdr")}</div>`;
  let middle;
  if (style === "generic") {
    const thumb = svgUrl(thumbnailSvg({ spark, background: s.design.wallet.background, material: s.design.wallet.label, scale: 2 }));
    middle = `<div class="w-prow"><div class="w-primary">${walletFields(body.primaryFields, "w-f")}</div><img class="w-thumb" src="${thumb}" alt=""></div>`;
  } else {
    const h = style === "eventTicket" ? 98 : 144;
    const strip = svgUrl(stripSvg({ spark, height: h, background: s.design.wallet.background, material: s.design.wallet.label, vip: s.design.isVip, scale: 2 }));
    middle = `<div class="w-strip" style="background-image:url('${strip}');aspect-ratio:375/${h}"><div class="w-primary">${walletFields(body.primaryFields, "w-f")}</div></div>`;
  }
  const card = `<div class="wcard" style="${vars}">${header}${middle}${walletFields(body.secondaryFields)}${walletFields(body.auxiliaryFields)}<div class="w-barcode">${QR}<span class="w-alt">${esc(json.barcodes[0].altText)}</span></div></div>`;
  return { card, json };
}

function walletPage() {
  const cards = SAMPLES.map((s) => ({ s, ...walletCard(s) }));
  const figures = cards
    .map(({ s, card }) => `<figure>${card}<figcaption><b>${esc(s.preset.name)} · ${esc(s.preset.material)}</b><br>${esc(s.design.wallet.style)} · background <span class="mono">${esc(s.design.wallet.background)}</span> · labels + art <span class="mono">${esc(s.design.wallet.label)}</span><br>${esc(s.design.wallet.art)} art: the kit spark in the tier material</figcaption></figure>`)
    .join("");
  const vip = cards.find(({ s }) => s.design.isVip);
  const back = vip.json[vip.s.design.wallet.style].backFields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("");
  const specImg = (svg) => svgUrl(svg);
  const specs = [
    ["icon.png · 29 × 29 pt · required", specImg(iconSvg({ spark, material: TIER_MATERIALS.gold, scale: 4 })), "The kit spark on black. Lock screen, Mail and notifications."],
    ["logo.png · ≤ 160 × 50 pt", LOGO, "The DGTL wordmark. It spells the name, so logoText is omitted (logoIncludesName)."],
    ["strip.png · eventTicket · 375 × 98 pt", specImg(stripSvg({ spark, height: 98, background: SAMPLES[0].design.wallet.background, material: TIER_MATERIALS.steel, scale: 2 })), "Day passes. Steel spark watermark, steel hairline."],
    ["strip.png · storeCard · 375 × 144 pt", specImg(stripSvg({ spark, height: 144, background: "#000000", material: TIER_MATERIALS.gold, vip: true, scale: 2 })), "VIP. The spark at full strength over a soft gold glow."],
    ["thumbnail.png · generic · 90 × 90 pt", specImg(thumbnailSvg({ spark, background: "#0a0a0a", material: TIER_MATERIALS.bronze, scale: 3 })), "Monthly (bronze) and yearly (silver). Becomes the holder photo later (R4)."]
  ]
    .map(([h, src, p]) => `<div class="spec-card"><h3>${esc(h)}</h3><img src="${src}" alt=""><p class="note">${esc(p)}</p></div>`)
    .join("");

  return page({
    title: "Apple Wallet passes",
    lede: "Every pass sits on the kit's black surface ladder. The tier is carried by its material: labels, artwork and the hairline. Gold is the material of VIP only. Field layout comes straight from <span class=\"mono\">buildPassJson</span>.",
    css: WALLET_CSS,
    body: `
<section class="section"><h2>The five presets</h2><div class="row">${figures}</div></section>
<section class="section"><h2>In the Wallet stack</h2><p>Stacked, only the top of each card shows: logo and header field. The tier label color does the work, so each card stays identifiable on the same black.</p>
  <div class="stack">${cards.map(({ card }) => card).join("")}</div></section>
<section class="section"><h2>Back of the VIP pass</h2><dl class="back">${back}</dl></section>
<section class="section"><h2>Artwork, generated from the kit</h2><p>Rendered by <span class="mono">reference/walletArt.js</span> and rasterized with <span class="mono">sharp</span> in Phase 5. A tenant can upload its own art per pass type instead.</p><div class="spec-grid">${specs}</div></section>`
  });
}

// ---------------------------------------------------------------------------
// pass-page.html
// ---------------------------------------------------------------------------

const PASS_CSS = `
.pp-bar{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;position:relative;z-index:1}
.pp{position:relative;z-index:1;padding:28px 24px 28px;display:grid;gap:20px;flex:1;align-content:start}
.pp-name{font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.pp-meta{color:var(--text-muted);font-size:15px;margin-top:6px}
.pp-code{display:grid;justify-items:center;gap:12px;padding:22px}
.qr-tile{background:#fff;border-radius:var(--r-control);padding:14px;width:248px}
.qr-tile svg{display:block;width:220px;height:220px}
.code{font-family:ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:15px;font-weight:700;letter-spacing:.22em;color:var(--text-muted)}
.badge-wallet{display:flex;align-items:center;justify-content:center;gap:10px;height:48px;border-radius:var(--r-control);background:#000;border:1px solid var(--border-strong);color:#fff;font-weight:600;font-size:15px;text-decoration:none}
.badge-wallet small{font-size:10px;color:var(--text-dim);font-weight:500}
.tip{font-size:13px;color:var(--text-dim);text-align:center}
.optin{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;cursor:pointer}
.optin input{width:18px;height:18px;margin-top:2px;flex:none}
.optin b{display:block;font-size:14px;color:var(--text)}
.optin small{display:block;font-size:12px;color:var(--text-dim);margin-top:2px}
.pp-foot{font-size:12px;color:var(--text-dim);text-align:center;display:grid;gap:4px;padding-top:4px}
.pp-foot a{color:var(--text-muted)}
.state{display:grid;gap:12px;padding:22px}
.state h3{font-size:18px;font-weight:700;color:var(--text)}
.state p{font-size:14px;color:var(--text-muted)}
`;

function passPhone({ s, state }) {
  const tier = s.design.accent;
  const chip = s.design.isVip ? "VIP" : s.design.materialLabel;
  const eyebrow = s.design.isVip ? "VIP · Lifetime" : s.passType.name;
  const qrBlock = `<div class="card card-solid pp-code"><div class="qr-tile">${QR}</div><span class="code">${esc(formatShortCode(s.pass.shortCode))}</span><button class="btn btn-ghost btn-sm" type="button">Show barcode instead</button></div>
    <a class="badge-wallet" href="#wallet"> Add to Apple Wallet <small>(official badge in production)</small></a>
    <p class="tip">Turn your brightness up at the door.</p>`;
  let main;
  if (state === "expired") {
    main = `<div class="card card-solid state"><span class="pill badge-error" style="justify-self:start">Expired</span><h3>This pass expired on ${esc(s.validity.untilShort)}.</h3><p>The code is hidden so it can't be shown at a busy door. To renew or ask a question, contact ${esc(kit.name)}.</p><p class="mono" style="color:var(--text)">help@example.com</p><a class="btn btn-secondary btn-sm" style="justify-self:start" href="#contact">Contact ${esc(kit.name)}</a></div>`;
  } else {
    const startNote = state === "scheduled" ? `<span class="pill badge-info" style="justify-self:start">Starts ${esc(s.validity.fromDate)}</span>` : "";
    main = `${startNote}${qrBlock}${s.design.isVip ? `<label class="card card-solid optin"><input type="checkbox"><span><b>Send me VIP offers</b><small>First word on events and offers. Unsubscribe anytime.</small></span></label>` : ""}`;
  }
  const meta = state === "expired" ? `${s.passType.name} · Expired` : s.validity.lifetime ? `${s.passType.name} · Never expires` : `${s.passType.name} · ${s.validity.until}`;
  return `<div class="phone"><div class="status"><span>9:41</span><span>●●●</span></div>
    <img class="watermark" src="${sparkIn(tier)}" alt=""><div class="vignette"></div>
    <div class="pp-bar glass-bar"><img src="${LOGO}" alt="DGTL" style="height:22px;width:auto"><span class="chip" style="--tier:${tier}">${esc(chip)}</span></div>
    <main class="pp"><div><p class="eyebrow">${esc(eyebrow)}</p><h2 class="pp-name">${esc(s.holder.name)}</h2><p class="pp-meta">${esc(meta)}</p></div>
    ${main}
    <footer class="pp-foot"><span><a href="#help">Help</a> · <a href="#terms">Terms</a></span><span>© 2026 ${esc(kit.name)}. All rights reserved.</span></footer></main></div>`;
}

function passPage() {
  const vip = SAMPLES[4];
  const day = SAMPLES[0];
  const monthly = SAMPLES[2];
  return page({
    title: "Holder pass page",
    lede: "What a holder sees at <span class=\"mono\">/p/&lt;credential&gt;</span>, themed from the tenant brand kit (DGTL by default). It shows the QR only while the pass can be used, offers Apple Wallet, and on VIP passes collects express marketing consent in the holder's own hand.",
    css: PASS_CSS,
    body: `<section class="section"><div class="row">
      <figure>${passPhone({ s: vip, state: "active" })}<figcaption><b>VIP · active.</b> Gold appears once, in the tier chip; the checkbox accent is the kit's form style. Opening this page is the invitation's "accept" (first_viewed_at).</figcaption></figure>
      <figure>${passPhone({ s: day, state: "scheduled" })}<figcaption><b>Day · scheduled.</b> The QR shows before the window opens so holders can add it to Wallet early. The info badge says when it starts.</figcaption></figure>
      <figure>${passPhone({ s: monthly, state: "expired" })}<figcaption><b>Monthly · expired.</b> No QR. Plain words, the support address as selectable text, and a secondary action. Revoked, used and suspended follow the same pattern.</figcaption></figure>
    </div></section>`
  });
}

// ---------------------------------------------------------------------------
// scanner.html
// ---------------------------------------------------------------------------

const SCAN_CSS = `
.sc-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;position:relative;z-index:2}
.gate{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--text);border:1px solid var(--border);border-radius:var(--r-pill);padding:6px 12px;background:var(--surface-1)}
.online{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--success)}
.online::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--success)}
.start{flex:1;display:grid;place-content:center;justify-items:center;gap:16px;padding:32px 28px;text-align:center;position:relative;z-index:1}
.start img{width:64px}
.start h3{font-size:26px;font-weight:700;letter-spacing:-.6px}
.start p{color:var(--text-muted);font-size:14px}
.start .btn{width:100%;justify-content:center;margin-top:10px}
.cam{position:relative;flex:1;background:radial-gradient(90% 60% at 50% 40%,#1a1a1a,#050505);display:grid;place-items:center}
.finder{width:236px;height:236px;position:relative}
.finder i{position:absolute;width:42px;height:42px;border:3px solid var(--text);border-radius:4px}
.finder i:nth-child(1){top:0;left:0;border-right:0;border-bottom:0}
.finder i:nth-child(2){top:0;right:0;border-left:0;border-bottom:0}
.finder i:nth-child(3){bottom:0;left:0;border-right:0;border-top:0}
.finder i:nth-child(4){bottom:0;right:0;border-left:0;border-top:0}
.finder .qr-ghost{position:absolute;inset:44px;opacity:.16}
.cam-hint{position:absolute;bottom:22px;left:0;right:0;text-align:center;font-size:14px;color:var(--text-muted)}
.sc-controls{display:flex;gap:10px;padding:14px 16px}
.sc-controls .btn-secondary{flex:1;justify-content:center}
.recent{border-top:1px solid var(--border);padding:8px 16px 14px;display:grid;gap:2px}
.recent .r{display:flex;align-items:center;justify-content:space-between;font-size:13px;padding:7px 0;color:var(--text)}
.recent .r span:last-child{color:var(--text-dim);font-variant-numeric:tabular-nums}
.verdict{flex:1;display:grid;align-content:center;justify-items:center;gap:10px;padding:32px 28px;text-align:center;color:#000}
.verdict.admit{background:var(--success)}
.verdict.warn{background:var(--warning)}
.verdict.deny{background:var(--error)}
.v-icon{width:104px;height:104px;border-radius:50%;border:4px solid #000;display:grid;place-items:center;margin-bottom:8px}
.v-icon svg{width:52px;height:52px}
.v-title{font-size:32px;font-weight:800;letter-spacing:-.6px}
.v-name{font-size:28px;font-weight:700;letter-spacing:-.4px;margin-top:6px}
.v-detail{font-size:16px;font-weight:600;opacity:.78;line-height:1.5}
.v-foot{font-size:13px;font-weight:600;opacity:.7;margin-top:18px}
.v-progress{width:160px;height:4px;border-radius:var(--r-pill);background:rgba(0,0,0,.18);overflow:hidden;margin-top:6px}
.v-progress span{display:block;width:62%;height:100%;background:#000}
.vip-band{display:flex;align-items:center;justify-content:center;gap:10px;background:#000;color:var(--gold);padding:12px;font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
.vip-band img{height:18px}
.offline{flex:1;display:grid;align-content:center;justify-items:center;gap:12px;padding:32px 28px;text-align:center}
.offline .v-icon{border-color:var(--error);color:var(--error)}
.offline h3{font-size:28px;font-weight:800;letter-spacing:-.5px}
.offline p{color:var(--text-muted)}
.manual{flex:1;display:grid;align-content:start;gap:16px;padding:28px 20px}
.manual h3{font-size:22px;font-weight:700}
.code-input{font-family:ui-monospace,'SFMono-Regular',Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:.24em;text-align:center;padding:18px 16px}
.manual .btn{justify-content:center}
.focus-ring{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-ring)}
`;

const ICON = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  bang: `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"><path d="M12 5v9M12 19h.01"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18"/></svg>`,
  torch: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l-1 6H9zM9 8h6v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM12 12v3"/></svg>`
};

function scanBar() {
  return `<div class="sc-bar glass-bar"><img src="${LOGO}" alt="DGTL" style="height:20px;width:auto"><span class="gate">Main door ▾</span><span class="online">Online</span></div>`;
}

function scanPhone(inner, { bar = true } = {}) {
  return `<div class="phone"><div class="status"><span>21:15</span><span>●●●</span></div>${bar ? scanBar() : ""}${inner}</div>`;
}

function verdictScreen({ result, name, detail, foot, vip = false, auto = false }) {
  const meta = RESULT_META[result];
  const icon = meta.tone === "admit" ? ICON.check : meta.tone === "warn" ? ICON.bang : ICON.cross;
  const band = vip ? `<div class="vip-band"><img src="${sparkIn(TIER_MATERIALS.gold)}" alt="">VIP · Lifetime</div>` : "";
  const progress = auto ? `<div class="v-progress" aria-hidden="true"><span></span></div>` : "";
  return `${band}<div class="verdict ${meta.tone}" role="status" aria-live="assertive"><div class="v-icon">${icon}</div><div class="v-title">${esc(meta.title)}</div>${name ? `<div class="v-name">${esc(name)}</div>` : ""}<div class="v-detail">${detail}</div>${progress}<div class="v-foot">${esc(foot)}</div></div>`;
}

function scannerPage() {
  const monthly = SAMPLES[2];
  const start = scanPhone(`<img class="watermark" src="${sparkIn(TIER_MATERIALS.gold)}" alt=""><div class="start"><img src="${sparkIn(TIER_MATERIALS.gold)}" alt=""><h3>Ready at Main door</h3><p>Signed in as Sam · Door team · DGTL</p><button class="btn btn-primary" type="button">Start scanning →</button><button class="btn btn-ghost btn-sm" type="button">Change gate</button></div>`);
  const scanning = scanPhone(`<div class="cam"><div class="finder"><i></i><i></i><i></i><i></i><div class="qr-ghost">${QR}</div></div><p class="cam-hint">Point at the QR code</p></div>
    <div class="sc-controls"><button class="btn btn-secondary btn-sm" type="button">Enter code</button><button class="btn btn-icon" type="button" aria-label="Torch" style="border:1px solid var(--border)">${ICON.torch}</button></div>
    <div class="recent"><div class="r"><span class="pill badge-success">Valid</span><span>Maya Chen</span><span>21:15</span></div><div class="r"><span class="pill badge-error">Used</span><span>Jordan Avery</span><span>21:14</span></div><div class="r"><span class="pill badge-warning">Recently used</span><span>Sam Okafor</span><span>21:12</span></div></div>`);
  const admit = scanPhone(verdictScreen({ result: "valid", name: monthly.holder.name, detail: `${esc(monthly.passType.name)} · Bronze<br>${esc(monthly.validity.until)} · Visit 14`, foot: "Continues automatically · tap to skip", auto: true }));
  const vipAdmit = scanPhone(verdictScreen({ result: "valid", name: "Alex Rivera", detail: "Never expires · Visit 31", foot: "Continues automatically · tap to skip", vip: true, auto: true }));
  const warn = scanPhone(verdictScreen({ result: "recently_used", name: "Sam Okafor", detail: "Annual Pass · admitted 2 min ago at Side door<br>Re-entry opens in 3:00", foot: "Tap to continue" }));
  const deny = scanPhone(verdictScreen({ result: "used", name: "Jordan Avery", detail: "Single Entry · used 21:14 at Main door", foot: "Tap to continue" }));
  const offline = scanPhone(`<div class="offline" role="status" aria-live="assertive"><div class="v-icon">${ICON.wifi}</div><span class="pill badge-error">Don't admit</span><h3>No connection</h3><p>Can't verify this pass. Check Wi-Fi or mobile data, then scan again. The scan will retry with the same ID, so nobody is admitted twice.</p><button class="btn btn-secondary btn-sm" type="button">Retry</button></div>`);
  const manual = scanPhone(`<div class="manual"><p class="eyebrow">Manual entry</p><h3>Type the pass code</h3><label class="label" for="code">Pass code</label><input id="code" class="input code-input focus-ring" value="K7M2-QX9P" aria-describedby="code-help"><p id="code-help" class="note">8 characters, printed under the QR. Letters and numbers only. O and 0 are the same.</p><button class="btn btn-primary" type="button">Check code →</button><button class="btn btn-ghost btn-sm" type="button">Back to camera</button></div>`);
  const fig = (html, cap) => `<figure>${html}<figcaption>${cap}</figcaption></figure>`;
  return page({
    title: "Door scanner",
    lede: "The <span class=\"mono\">/scan</span> PWA for door staff. DGTL platform chrome, an internal tool, so it's quiet: gold appears only on the one primary action and the VIP band. Verdicts fill the screen in the kit's functional colors with black text, because a dark door needs an answer at arm's length. Icon, title and sound always accompany the color.",
    css: SCAN_CSS,
    body: `<section class="section"><h2>Before and during a shift</h2><div class="row">
      ${fig(start, "<b>Start.</b> One tap unlocks the camera and audio (iOS needs a gesture). The single gold moment on the screen.")}
      ${fig(scanning, "<b>Scanning.</b> Gate in the header, online status, white viewfinder, manual entry and torch (Android) below, last verdicts underneath.")}
      ${fig(manual, "<b>Manual entry.</b> Kit input with the gold focus ring, Crockford-forgiving, 10-miss lockout.")}
    </div></section>
    <section class="section"><h2>Verdicts</h2><div class="row">
      ${fig(admit, `<b>${esc(RESULT_META.valid.title)}.</b> Success fill, auto-returns after 2.5 s.`)}
      ${fig(vipAdmit, "<b>VIP admit.</b> A black band with the gold spark sits on top of the green, so staff spot VIP in one glance.")}
      ${fig(warn, `<b>${esc(RESULT_META.recently_used.title)}.</b> Warning fill. Anti-passback on reusable passes, with the gate and time of the last admit.`)}
      ${fig(deny, `<b>${esc(RESULT_META.used.title)}.</b> Error fill for every refusal (used, expired, revoked, not found), each with its own title.`)}
      ${fig(offline, "<b>No connection.</b> Black, not a verdict color: it's a network problem, not a bad pass. It still means don't admit.")}
    </div></section>`
  });
}

// ---------------------------------------------------------------------------
// admin.html
// ---------------------------------------------------------------------------

const ADMIN_CSS = `
.shell-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-card)}
.shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-width:1180px;background:var(--bg)}
.side{background:var(--surface-1);border-right:1px solid var(--border);padding:20px 14px;display:flex;flex-direction:column;gap:4px;min-height:980px}
.side .logo{padding:4px 10px 18px}
.side .sec{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--text-dim);padding:14px 12px 6px}
.nav-i{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;color:var(--text-muted);border-radius:var(--r-control);padding:10px 12px;position:relative}
.nav-i svg{width:18px;height:18px;flex:none}
.nav-i.active{background:var(--gold-tint);color:var(--gold)}
.nav-i.active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:2px;border-radius:2px;background:var(--gold)}
.user{margin-top:auto;border-top:1px solid var(--border-subtle);padding:14px 10px 4px;display:flex;gap:10px;align-items:center;font-size:13px}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--border);display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--gold)}
.user small{display:block;color:var(--text-dim);font-size:12px}
.main{display:flex;flex-direction:column;min-width:0}
.top{display:flex;align-items:center;gap:16px;padding:14px 28px;position:sticky;top:0;z-index:2}
.top h2{font-size:18px;font-weight:700}
.crumb{font-size:13px;color:var(--text-dim)}
.crumb b{color:var(--text);font-weight:600}
.top .search{margin-left:auto;width:260px;border-radius:var(--r-pill)}
.content{padding:24px 28px 40px;display:grid;gap:24px}
.tabs{display:flex;gap:28px;border-bottom:1px solid var(--border)}
.tabs span{font-size:14px;font-weight:600;color:var(--text-dim);padding:10px 0 12px;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs span.on{color:var(--text);border-bottom-color:var(--gold)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
.kpi{padding:20px 22px;display:grid;gap:8px}
.kpi .k-l{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim)}
.kpi .k-v{font-size:38px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums;color:var(--text);line-height:1}
.kpi .k-v.gold{color:var(--gold)}
.kpi .k-s{font-size:13px;color:var(--text-dim);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:20px;align-items:start}
.panel{padding:22px;display:grid;gap:16px}
.panel h3{font-size:16px;font-weight:700}
.bar{display:grid;grid-template-columns:76px minmax(0,1fr) 52px;gap:12px;align-items:center;font-size:13px}
.bar .track{height:8px;border-radius:var(--r-pill);background:var(--surface-2);overflow:hidden}
.bar .track span{display:block;height:100%;border-radius:var(--r-pill);background:var(--tier)}
.bar .n{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}
.bar .t{color:var(--tier);font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase}
.table td{white-space:nowrap}
.table td .sub,.table td.sub{color:var(--text-dim)}
.issue{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}
.form{display:grid;gap:16px}
.form .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form fieldset{border:0;padding:0;margin:0;display:grid;gap:12px}
.form legend{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold-tan);margin-bottom:4px}
.check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--text)}
.check input{margin-top:3px}
.check small{display:block;color:var(--text-dim);font-size:12px}
.seg{display:inline-flex;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-pill);padding:3px}
.seg span{font-size:13px;padding:7px 14px;border-radius:var(--r-pill);color:var(--text-dim)}
.seg span.on{background:var(--border);color:var(--text)}
.toggle{width:38px;height:22px;border-radius:var(--r-pill);background:var(--gold);position:relative;flex:none}
.toggle::after{content:"";position:absolute;right:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#000}
.toggle.off{background:var(--border)}
.toggle.off::after{right:auto;left:3px;background:var(--text-dim)}
.trow{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px}
.actions{display:flex;justify-content:flex-end;gap:10px;padding-top:6px}
.preview{padding:0;overflow:hidden}
.preview-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)}
.preview iframe{width:100%;height:760px;border:0;display:block;background:#000}
.ok-line{display:flex;gap:8px;flex-wrap:wrap}
`;

const NAV_ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const NAV = [
  ["Pipeline", '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'],
  ["Funding", '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 20 7H4z"/>'],
  ["Prospecting", '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'],
  ["Accounts", '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>'],
  ["Outreach", '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'],
  ["Calls", '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'],
  ["Tenants", '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>'],
  ["Team", '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>'],
  ["Passes", '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>']
];

function adminPage() {
  const nav = NAV.map(([label, d]) => `<div class="nav-i${label === "Passes" ? " active" : ""}">${NAV_ICON(d)}${label}</div>`).join("");
  const tiers = [["Steel", TIER_MATERIALS.steel, 610], ["Bronze", TIER_MATERIALS.bronze, 402], ["Silver", TIER_MATERIALS.silver, 219], ["Gold", TIER_MATERIALS.gold, 53]];
  const max = Math.max(...tiers.map((t) => t[2]));
  const bars = tiers.map(([name, color, n]) => `<div class="bar" style="--tier:${color}"><span class="t">${name}</span><span class="track"><span style="width:${((n / max) * 100).toFixed(1)}%"></span></span><span class="n">${n.toLocaleString("en-CA")}</span></div>`).join("");
  const badge = { valid: ["badge-success", "Valid"], used: ["badge-error", "Used"], recently_used: ["badge-warning", "Recently used"], expired: ["badge-error", "Expired"], not_found: ["badge-error", "Unknown code"] };
  const scans = [
    ["21:15", "valid", "Maya Chen", ["Monthly Pass", TIER_MATERIALS.bronze], "Main door", "Sam"],
    ["21:15", "valid", "Alex Rivera", ["VIP Lifetime", TIER_MATERIALS.gold], "VIP entrance", "Lee"],
    ["21:14", "used", "Jordan Avery", ["Single Entry", TIER_MATERIALS.steel], "Main door", "Sam"],
    ["21:12", "recently_used", "Sam Okafor", ["Annual Pass", TIER_MATERIALS.silver], "Side door", "Lee"],
    ["21:09", "not_found", "—", null, "Main door", "Sam"],
    ["21:06", "expired", "Chris Lowe", ["Monthly Pass", TIER_MATERIALS.bronze], "Main door", "Sam"]
  ]
    .map(([time, result, holder, type, gate, who]) => `<tr><td class="num" style="text-align:left">${time}</td><td><span class="pill ${badge[result][0]}">${badge[result][1]}</span></td><td>${esc(holder)}</td><td>${type ? `<span class="chip" style="--tier:${type[1]}">${esc(type[0])}</span>` : '<span class="sub">foreign_host</span>'}</td><td class="sub">${esc(gate)}</td><td class="sub">${esc(who)}</td></tr>`)
    .join("");

  return page({
    title: "Admin Passes tab",
    lede: "The ninth tab in the existing admin shell. Internal-tool restraint: gold marks the active nav item, the active tab, THE number of the screen and the one primary action. Everything else is white, muted or dim on the black ladder.",
    css: ADMIN_CSS,
    body: `<section class="section"><h2>Overview</h2><div class="shell-wrap"><div class="shell">
  <aside class="side"><div class="logo"><img src="${LOGO}" alt="DGTL" style="height:24px;width:auto"></div><div class="sec">Workspace</div>${nav}<div class="user"><span class="avatar">AM</span><span>Alexis Marin<small>Owner · sample user</small></span></div></aside>
  <div class="main">
    <div class="top glass-bar"><h2>Passes</h2><span class="crumb">Tenant · <b>DGTL ▾</b></span><input class="input search" placeholder="Search name, email, code" aria-label="Search passes"><a class="btn btn-primary btn-sm" href="#issue">Issue pass →</a></div>
    <div class="content">
      <div class="tabs"><span class="on">Overview</span><span>Issue</span><span>Passes</span><span>Pass types</span><span>Scans</span></div>
      <div class="kpis">
        <div class="card card-solid kpi"><span class="k-l">Active passes</span><span class="k-v gold">1,284</span><span class="k-s"><span class="pill badge-success">▲ 12%</span> vs last 30 days</span></div>
        <div class="card card-solid kpi"><span class="k-l">Scans today</span><span class="k-v">892</span><span class="k-s">861 admitted · 31 refused</span></div>
        <div class="card card-solid kpi"><span class="k-l">Issued today</span><span class="k-v">147</span><span class="k-s">138 email · 96 SMS delivered</span></div>
        <div class="card card-solid kpi"><span class="k-l">Expiring in 7 days</span><span class="k-v">42</span><span class="k-s"><a href="#expiring" style="color:var(--text-muted)">Renewal list →</a></span></div>
      </div>
      <div class="two">
        <div class="card card-solid panel"><h3>Active by tier</h3>${bars}<p class="note">1,284 active · business day ends 04:00 (America/Toronto)</p></div>
        <div class="card card-solid panel" style="padding:0"><div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px"><h3>Live scans</h3><span class="online">Live · every 10 s</span></div>
          <table class="table"><thead><tr><th>Time</th><th>Result</th><th>Holder</th><th>Pass</th><th>Gate</th><th>Verifier</th></tr></thead><tbody>${scans}</tbody></table></div>
      </div>
    </div>
  </div>
</div></div><p class="note">Sample data. The table's "not found" row shows the internal reason only to owners and admins.</p></section>

<section class="section" id="issue"><h2>Issue, with the real renderer as the preview</h2><div class="issue">
  <div class="card card-solid panel form">
    <fieldset><legend>Recipient</legend>
      <div><label class="label" for="n">Name</label><input id="n" class="input" value="Alex Rivera"></div>
      <div class="grid2"><div><label class="label" for="e">Email</label><input id="e" class="input" value="alex@example.com"></div><div><label class="label" for="p">Phone</label><input id="p" class="input" value="+1 416 555 0100"></div></div>
    </fieldset>
    <fieldset><legend>Pass</legend>
      <div class="grid2"><div><label class="label" for="t">Type</label><select id="t" class="select"><option>VIP Lifetime · Gold</option></select></div><div><label class="label" for="s">Starts</label><input id="s" class="input" value="2026-09-30"></div></div>
      <p class="note">Never expires · VIP list: 53 members. The count keeps "the list is short" honest.</p>
    </fieldset>
    <fieldset><legend>Delivery</legend>
      <div class="trow"><span>Email</span><span class="toggle" aria-hidden="true"></span></div>
      <div class="trow"><span>Email style</span><span class="seg"><span class="on">VIP invitation</span><span>Standard VIP</span></span></div>
      <div class="trow"><span>SMS</span><span class="toggle" aria-hidden="true"></span></div>
      <label class="check"><input type="checkbox" checked><span>This person agreed to receive offers<small>Required note: "Signed up at the bar, 28 Sep". Without it the invitation sends without the offer.</small></span></label>
    </fieldset>
    <div class="ok-line"><span class="pill badge-success">Sendable</span><span class="pill badge-info">Offer included</span><span class="pill badge-warning">Wallet badge placeholder</span></div>
    <div class="actions"><a class="btn btn-ghost btn-sm" href="#cancel">Cancel</a><a class="btn btn-primary btn-sm" href="#send">Issue &amp; send →</a></div>
  </div>
  <div class="card card-solid preview"><div class="preview-head"><span class="seg"><span class="on">Email</span><span>SMS</span><span>Wallet</span></span><span class="note">Subject: Alex, you're on the list</span></div><iframe src="vip_onboarding.html" title="Live preview: VIP invitation email" loading="lazy"></iframe></div>
</div></section>`
  });
}

await mkdir(outDir, { recursive: true });
const pages = { "wallet.html": walletPage(), "pass-page.html": passPage(), "scanner.html": scannerPage(), "admin.html": adminPage() };
for (const [file, html] of Object.entries(pages)) await writeFile(path.join(outDir, file), html);
console.log(`Wrote ${Object.keys(pages).join(", ")} to ${path.relative(process.cwd(), outDir)}`);
