// DGTL Pass — branded email + SMS renderer (reference implementation).
//
// One layout system, five variants: day · monthly · yearly · vip_lifetime ·
// vip_onboarding. Output is table-based HTML with inline styles, so it
// survives Gmail, Apple Mail and Outlook. The only <style> block is
// progressive: mobile padding, plus Manrope for clients that load web fonts.
//
// Everything visual comes from the resolved brand kit (brand.js) and pass
// design (tiers.js). Nothing here knows the word "DGTL".
//
// DGTL brand kit rules applied here (engine/dgtl-brand-kit, "Email /
// constrained surfaces"): solid black ground, table layout, Manrope first with
// a system fallback, bulletproof buttons in the *brand* accent (black text,
// 7px radius, trailing arrow), gold-tan kickers, 0.15em letter-spaced labels,
// 16px cards on #2a2a2a borders, 9999px pills. The tier's material color
// appears only on the pass itself (band, chip, material label, callout rail),
// so each view keeps a single gold moment: the primary button.
//
// Compliance gates (08-messaging.md): every email must identify the sender
// with a postal address and link to email preferences. A VIP onboarding offer
// is a commercial message, so it is rendered only when marketingAllowed is
// true (consent on file) and it carries a one-click unsubscribe. A render
// that fails a gate returns sendable: false. The delivery layer must refuse to
// send it; never "send anyway".
//
// Port target: platform/lib/passes/email/render.js.

import { EMAIL_COPY, SMS_COPY, fill } from "./copy.js";
import { DGTL_GEOMETRY, mix } from "../brand.js";
import { formatShortCode } from "../credentials.js";

export const EMAIL_VARIANTS = Object.keys(EMAIL_COPY);
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

export function safeUrl(value, { allowDataImages = false } = {}) {
  const url = String(value || "");
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s"'<>]*$/i.test(url)) return url;
  if (allowDataImages && /^data:image\/(png|gif|svg\+xml);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return "";
}

function firstNameOf(holder) {
  return String(holder?.firstName || String(holder?.name || "").trim().split(/\s+/)[0] || "there");
}

function theme(brandKit, design) {
  const c = brandKit.colors;
  return {
    bg: c.background,
    surface: c.surface,
    raised: c.surfaceRaised,
    line: c.line,
    text: c.text,
    muted: c.textMuted,
    dim: c.textDim,
    kicker: c.kicker,
    // tier material: the pass itself
    accent: design.accent,
    accentText: design.accentText,
    accentTint: design.accentTint,
    // brand action color: buttons
    action: design.action,
    onAction: design.onAction,
    frame: mix(design.accent, c.background, 0.55),
    r: DGTL_GEOMETRY,
    font: brandKit.fontStack,
    colorScheme: brandKit.theme === "light" ? "light" : "dark"
  };
}

// ---- building blocks ------------------------------------------------------

function row(inner, { t, padding = "0 32px 28px", align = "left", extra = "" }) {
  return `<tr><td class="px" align="${align}" style="padding:${padding};${extra}">${inner}</td></tr>`;
}

function label(text, t, color = t.dim, margin = "0 0 6px") {
  return `<p style="margin:${margin};font-family:${t.font};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${color};">${esc(text)}</p>`;
}

function header({ t, brandKit, chip, imgOpts }) {
  const logo = safeUrl(brandKit.logoUrl, imgOpts);
  const mark = logo
    ? `<img src="${esc(logo)}" height="28" alt="${esc(brandKit.name)}" style="display:block;height:28px;width:auto;border:0;outline:none;">`
    : `<span style="font-family:${t.font};font-size:20px;line-height:24px;font-weight:800;letter-spacing:1px;color:${t.text};">${esc(brandKit.logoText)}</span>`;
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="left" valign="middle">${mark}</td>
      <td align="right" valign="middle"><span style="display:inline-block;padding:6px 12px;background:${t.accentTint};border-radius:${t.r.pill}px;font-family:${t.font};font-size:11px;line-height:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${t.accentText};">${esc(chip)}</span></td>
    </tr></table>`,
    { t, padding: "28px 32px 32px" }
  );
}

function hero({ t, eyebrow, headline, body, centered }) {
  const align = centered ? "center" : "left";
  const rule = centered
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 22px;"><tr><td width="48" height="1" style="width:48px;height:1px;line-height:1px;font-size:0;background:${t.kicker};" bgcolor="${t.kicker}">&nbsp;</td></tr></table>`
    : "";
  return row(
    `${rule}<p style="margin:0 0 14px;font-family:${t.font};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${t.kicker};">${esc(eyebrow)}</p>
    <h1 class="h1" style="margin:0 0 16px;font-family:${t.font};font-size:38px;line-height:44px;font-weight:700;letter-spacing:-1px;color:${t.text};">${esc(headline)}</h1>
    <p style="margin:0;font-family:${t.font};font-size:16px;line-height:26px;color:${t.muted};">${esc(body)}</p>`,
    { t, align, padding: "0 32px 32px" }
  );
}

function fieldCell(t, name, value) {
  return `<td class="stack" width="50%" valign="top" style="padding:0 0 18px;">${label(name, t)}<p style="margin:0;font-family:${t.font};font-size:15px;line-height:22px;font-weight:700;color:${t.text};">${esc(value)}</p></td>`;
}

function entryText(pass) {
  if (pass.maxUses === 1) return "Single entry";
  if (pass.maxUses) return `${pass.maxUses} entries`;
  return "Re-entry";
}

function passCard({ t, pass, passType, holder, design, validity, qrUrl, showQr }) {
  const qr = showQr && qrUrl
    ? `<tr><td align="center" style="padding:8px 24px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:14px;border-radius:${t.r.control}px;">
          <img class="qr" src="${esc(qrUrl)}" width="200" height="200" alt="QR code for your pass" style="display:block;width:200px;height:200px;border:0;">
        </td></tr></table>
        <p style="margin:14px 0 0;font-family:${MONO};font-size:13px;line-height:18px;font-weight:700;letter-spacing:3px;color:${t.muted};">${esc(formatShortCode(pass.shortCode))}</p>
      </td></tr>`
    : "";
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${t.surface}" style="background:${t.surface};border:1px solid ${t.line};border-radius:${t.r.card}px;border-collapse:separate;overflow:hidden;">
      <tr><td height="4" bgcolor="${t.accent}" style="height:4px;line-height:4px;font-size:0;background:${t.accent};border-radius:${t.r.card}px ${t.r.card}px 0 0;">&nbsp;</td></tr>
      <tr><td style="padding:24px 24px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">${label(design.isVip ? "Member" : "Holder", t)}<p style="margin:0;font-family:${t.font};font-size:24px;line-height:30px;font-weight:800;color:${t.text};">${esc(holder.name)}</p></td>
          <td align="right" valign="top">${label(design.isVip ? "VIP" : design.materialLabel, t, t.accentText, "0")}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:18px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${fieldCell(t, "Pass", passType.name)}${fieldCell(t, "Entry", entryText(pass))}</tr>
          <tr>${fieldCell(t, "Valid from", validity.fromDate)}${fieldCell(t, validity.lifetime ? "Expires" : "Valid until", validity.untilShort)}</tr>
        </table>
      </td></tr>
      ${qr}
    </table>`,
    { t }
  );
}

// The kit's primary button, bulletproof for email: brand accent fill, black
// (on-accent) text, 7px radius, 15px 24px padding, 16px/700, trailing arrow.
function button({ t, href, text }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td bgcolor="${t.action}" style="border-radius:${t.r.control}px;background:${t.action};">
    <a href="${esc(href)}" style="display:inline-block;padding:15px 24px;font-family:${t.font};font-size:16px;line-height:18px;font-weight:700;color:${t.onAction};text-decoration:none;border-radius:${t.r.control}px;">${esc(withArrow(text))}</a>
  </td></tr></table>`;
}

// "Arrows after CTAs are a brand tic." Added once, never doubled.
export function withArrow(text) {
  const value = String(text || "").trim();
  return /→$/.test(value) ? value : `${value} →`;
}

function walletBadge({ t, walletUrl, badgeUrl }) {
  if (!walletUrl) return "";
  // Production must use Apple's official "Add to Apple Wallet" badge artwork
  // (Apple's Wallet marketing guidelines). The text fallback exists only so a
  // preview renders before the asset is uploaded; the renderer flags it.
  const inner = badgeUrl
    ? `<img src="${esc(badgeUrl)}" width="156" height="48" alt="Add to Apple Wallet" style="display:block;width:156px;height:48px;border:0;">`
    : `<span style="display:inline-block;padding:13px 22px;border:1px solid ${t.dim};border-radius:${t.r.control}px;background:#000000;font-family:${t.font};font-size:14px;line-height:18px;font-weight:700;color:#FFFFFF;">Add to Apple Wallet</span>`;
  return `<a href="${esc(walletUrl)}" style="display:inline-block;text-decoration:none;">${inner}</a>`;
}

function actions({ t, links, badgeUrl, cta, walletFirst = true }) {
  const wallet = walletBadge({ t, walletUrl: links.walletUrl, badgeUrl });
  const primary = button({ t, href: links.passPageUrl, text: cta });
  const first = walletFirst ? wallet : primary;
  const second = walletFirst ? primary : wallet;
  return (
    row(first, { t, align: "center", padding: "0 32px 14px" }) + row(second, { t, align: "center", padding: "0 32px 32px" })
  );
}

function perks({ t, heading, list }) {
  if (!list?.length) return "";
  const items = list
    .slice(0, 5)
    .map(
      (perk, index) => `<tr>
        <td width="44" valign="top" style="padding:16px 0 16px;border-top:1px solid ${t.line};font-family:${MONO};font-size:13px;line-height:22px;font-weight:700;color:${t.kicker};">${String(index + 1).padStart(2, "0")}</td>
        <td valign="top" style="padding:16px 0 16px;border-top:1px solid ${t.line};">
          <p style="margin:0;font-family:${t.font};font-size:15px;line-height:22px;font-weight:700;color:${t.text};">${esc(perk.title)}</p>
          ${perk.body ? `<p style="margin:4px 0 0;font-family:${t.font};font-size:14px;line-height:22px;color:${t.muted};">${esc(perk.body)}</p>` : ""}
        </td></tr>`
    )
    .join("");
  return row(`${label(heading, t, t.dim, "0 0 10px")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>`, { t });
}

function offerBlock({ t, heading, offer }) {
  const code = offer.code
    ? `<p style="margin:0 0 4px;"><span style="display:inline-block;padding:10px 18px;border:1px dashed ${t.kicker};border-radius:${t.r.control}px;font-family:${MONO};font-size:15px;line-height:20px;font-weight:700;letter-spacing:0.2em;color:${t.text};">${esc(offer.code)}</span></p>`
    : "";
  const fine = [offer.expiresLabel ? `Offer ends ${offer.expiresLabel}.` : "", offer.terms || ""].filter(Boolean).join(" ");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${t.raised}" style="background:${t.raised};border:1px solid ${t.frame};border-radius:${t.r.card}px;border-collapse:separate;">
      <tr><td align="center" style="padding:30px 24px;">
        ${label(heading, t, t.kicker, "0 0 12px")}
        <p style="margin:0 0 10px;font-family:${t.font};font-size:26px;line-height:32px;font-weight:800;color:${t.text};">${esc(offer.title)}</p>
        ${offer.body ? `<p style="margin:0 0 20px;font-family:${t.font};font-size:15px;line-height:24px;color:${t.muted};">${esc(offer.body)}</p>` : ""}
        ${code}
        ${fine ? `<p style="margin:14px 0 0;font-family:${t.font};font-size:12px;line-height:18px;color:${t.dim};">${esc(fine)}</p>` : ""}
      </td></tr>
    </table>`,
    { t }
  );
}

function tip({ t, text }) {
  return row(
    `<p style="margin:0;padding:14px 16px;border-left:3px solid ${t.accent};border-radius:0 ${t.r.control}px ${t.r.control}px 0;background:${t.raised};font-family:${t.font};font-size:13px;line-height:20px;color:${t.muted};">${esc(text)}</p>`,
    { t }
  );
}

function signature({ t, name, title }) {
  if (!name) return "";
  return row(
    `<p style="margin:0;font-family:${t.font};font-size:15px;line-height:22px;font-weight:700;color:${t.text};">— ${esc(name)}</p>${
      title ? `<p style="margin:2px 0 0;font-family:${t.font};font-size:13px;line-height:20px;color:${t.dim};">${esc(title)}</p>` : ""
    }`,
    { t, padding: "0 32px 32px" }
  );
}

function footer({ t, brandKit, reason, links, passId, marketing, year }) {
  const link = (href, text) => (href ? `<a href="${esc(href)}" style="color:${t.muted};text-decoration:underline;">${esc(text)}</a>` : "");
  const help = brandKit.legal.supportEmail
    ? link(`mailto:${brandKit.legal.supportEmail}`, "Help")
    : link(safeUrl(brandKit.legal.supportUrl), "Help");
  const bits = [help, link(safeUrl(links.preferencesUrl), "Email preferences"), marketing ? link(safeUrl(links.unsubscribeUrl), "Unsubscribe") : ""].filter(Boolean);
  return row(
    `<p style="margin:0 0 8px;font-family:${t.font};font-size:13px;line-height:20px;font-weight:700;color:${t.muted};">${esc(brandKit.name)}</p>
    ${brandKit.legal.postalAddress ? `<p style="margin:0 0 8px;font-family:${t.font};font-size:12px;line-height:18px;color:${t.dim};">${esc(brandKit.legal.postalAddress)}</p>` : ""}
    <p style="margin:0 0 8px;font-family:${t.font};font-size:12px;line-height:18px;color:${t.dim};">${esc(reason)}</p>
    <p style="margin:0 0 14px;font-family:${t.font};font-size:12px;line-height:18px;color:${t.dim};">${bits.join(" &nbsp;·&nbsp; ")}</p>
    <p style="margin:0 0 6px;font-family:${t.font};font-size:12px;line-height:18px;color:${t.dim};">© ${esc(year)} ${esc(brandKit.name)}. All rights reserved.</p>
    <p style="margin:0;font-family:${MONO};font-size:11px;line-height:16px;color:${t.dim};">Pass ID ${esc(passId)}</p>`,
    { t, padding: "26px 32px 28px", extra: `border-top:1px solid ${t.line};` }
  );
}

function documentShell({ t, title, preheader, rows, framed, fontCssUrl }) {
  const frame = framed ? `border:1px solid ${t.frame};border-radius:${t.r.card}px;border-collapse:separate;` : "";
  // Invisible filler after the preheader stops clients pulling body text into the inbox preview.
  const filler = "&#8199;&#847; ".repeat(40);
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="${t.colorScheme}">
<meta name="supported-color-schemes" content="${t.colorScheme}">
<title>${esc(title)}</title>
${fontCssUrl ? `<link href="${esc(fontCssUrl)}" rel="stylesheet">` : ""}
<style>
  body { margin:0; padding:0; background:${t.bg}; -webkit-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; }
  a { color:inherit; }
  @media (max-width: 620px) {
    .container { width:100% !important; }
    .px { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:30px !important; line-height:36px !important; }
    .stack { display:block !important; width:100% !important; }
    .qr { width:180px !important; height:180px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${t.bg};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${t.bg};">${esc(preheader)}${filler}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${t.bg}" style="background:${t.bg};">
  <tr><td align="center" style="padding:24px 12px 40px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;${frame}">
${rows.join("\n")}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ---- public API -----------------------------------------------------------

/**
 * variant:  one of EMAIL_VARIANTS
 * brandKit: resolveBrandKit(tenant)   design: resolvePassDesign(passType, brandKit)
 * pass:     { id, shortCode, maxUses }
 * passType: { name, perks?: [{title, body}], email?: { copy?: {} } }
 * holder:   { name, firstName? }
 * validity: describeValidity(pass, …)
 * links:    { passPageUrl, walletUrl, qrImageUrl, preferencesUrl, unsubscribeUrl }
 * assets:   { walletBadgeUrl }
 * offer:    { title, body?, code?, expiresLabel?, terms? }   (vip_onboarding)
 * sender:   { name, title }                                  (vip_onboarding)
 * marketingAllowed: consent basis on file for this holder (vip_onboarding offer)
 */
export function renderPassEmail(input) {
  const { variant, brandKit, design, pass, passType, holder, validity, links = {}, assets = {}, offer = null, sender = {}, marketingAllowed = false, allowDataImages = false, year = new Date().getUTCFullYear() } = input;
  if (!EMAIL_VARIANTS.includes(variant)) throw new Error(`Unknown email variant "${variant}".`);

  const warnings = [];
  const blockers = [];
  const imgOpts = { allowDataImages };
  const copy = { ...EMAIL_COPY[variant], ...(passType.email?.copy || {}) };
  const vars = {
    brand: brandKit.name,
    firstName: firstNameOf(holder),
    holderName: holder.name,
    passName: passType.name,
    fromDate: validity.fromDate,
    from: validity.from,
    until: validity.until,
    untilShort: validity.untilShort,
    senderName: sender.name || brandKit.sender.fromName,
    senderTitle: sender.title || ""
  };
  const c = Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, fill(value, vars)]));
  const t = theme(brandKit, design);
  const onboarding = variant === "vip_onboarding";
  const vip = onboarding || variant === "vip_lifetime";

  const safeLinks = {
    passPageUrl: safeUrl(links.passPageUrl),
    walletUrl: safeUrl(links.walletUrl),
    qrImageUrl: safeUrl(links.qrImageUrl, imgOpts),
    preferencesUrl: safeUrl(links.preferencesUrl),
    unsubscribeUrl: safeUrl(links.unsubscribeUrl)
  };
  const badgeUrl = safeUrl(assets.walletBadgeUrl, imgOpts);

  if (!safeLinks.passPageUrl) blockers.push("missing_pass_page_url");
  if (!onboarding && !safeLinks.qrImageUrl) blockers.push("missing_qr_image_url");
  if (!brandKit.legal.postalAddress) blockers.push("missing_postal_address");
  if (!safeLinks.preferencesUrl) blockers.push("missing_preferences_url");
  if (!badgeUrl) warnings.push("wallet_badge_placeholder");

  let renderOffer = null;
  if (onboarding && offer?.title) {
    if (!marketingAllowed) {
      warnings.push("offer_suppressed_no_marketing_consent");
    } else if (!safeLinks.unsubscribeUrl) {
      blockers.push("missing_unsubscribe_url");
    } else {
      renderOffer = offer;
    }
  }
  const marketing = Boolean(renderOffer);

  const rows = [header({ t, brandKit, chip: vip ? "VIP" : [design.materialLabel, passType.name].filter(Boolean).join(" · "), imgOpts })];
  rows.push(hero({ t, eyebrow: c.eyebrow, headline: c.headline, body: c.body, centered: vip }));

  if (onboarding) {
    if (renderOffer) rows.push(offerBlock({ t, heading: c.offerLabel, offer: renderOffer }));
    rows.push(row(button({ t, href: safeLinks.passPageUrl, text: c.cta }), { t, align: "center", padding: "0 32px 32px" }));
    rows.push(perks({ t, heading: c.perksLabel, list: passType.perks }));
    // The invitation previews the pass rather than printing its QR. The code
    // is revealed on the pass page ("accept") and in Wallet, which keeps the
    // moment an invitation and gives a first-view event to measure.
    rows.push(passCard({ t, pass, passType, holder, design, validity, showQr: false }));
    rows.push(row(walletBadge({ t, walletUrl: safeLinks.walletUrl, badgeUrl }), { t, align: "center", padding: "0 32px 28px" }));
    rows.push(tip({ t, text: c.tip }));
    rows.push(signature({ t, name: c.signoff, title: c.signoffTitle }));
  } else {
    rows.push(passCard({ t, pass, passType, holder, design, validity, qrUrl: safeLinks.qrImageUrl, showQr: true }));
    rows.push(actions({ t, links: safeLinks, badgeUrl, cta: c.cta }));
    rows.push(perks({ t, heading: "Included", list: passType.perks }));
    rows.push(tip({ t, text: c.tip }));
    if (c.closing) rows.push(row(`<p style="margin:0;font-family:${t.font};font-size:18px;line-height:26px;font-weight:800;color:${t.text};">${esc(c.closing)}</p>`, { t, align: "center" }));
  }
  rows.push(footer({ t, brandKit, reason: c.reason, links: safeLinks, passId: pass.id, marketing, year }));

  const html = documentShell({ t, title: c.subject, preheader: c.preheader, rows: rows.filter(Boolean), framed: vip, fontCssUrl: brandKit.fontCssUrl });

  const text = [
    c.eyebrow.toUpperCase(),
    "",
    c.headline,
    "",
    c.body,
    "",
    ...(renderOffer ? [`${c.offerLabel.toUpperCase()}: ${renderOffer.title}`, renderOffer.body || "", renderOffer.code ? `Code: ${renderOffer.code}` : "", renderOffer.expiresLabel ? `Offer ends ${renderOffer.expiresLabel}.` : "", ""] : []),
    `${passType.name} for ${holder.name}`,
    `Valid from: ${validity.fromDate}`,
    `${validity.lifetime ? "Expires" : "Valid until"}: ${validity.untilShort}`,
    ...(onboarding ? [] : [`Pass code: ${formatShortCode(pass.shortCode)}`]),
    "",
    `${c.cta.replace(/\s*→\s*$/, "")}: ${safeLinks.passPageUrl}`,
    safeLinks.walletUrl ? `Add to Apple Wallet: ${safeLinks.walletUrl}` : "",
    "",
    c.tip,
    "",
    "--",
    brandKit.name,
    brandKit.legal.postalAddress,
    c.reason,
    `© ${year} ${brandKit.name}. All rights reserved.`,
    safeLinks.preferencesUrl ? `Email preferences: ${safeLinks.preferencesUrl}` : "",
    marketing ? `Unsubscribe: ${safeLinks.unsubscribeUrl}` : "",
    `Pass ID ${pass.id}`
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");

  const headers = marketing
    ? { "List-Unsubscribe": `<${safeLinks.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};

  return { variant, subject: c.subject, preheader: c.preheader, html, text, headers, marketing, warnings, blockers, sendable: blockers.length === 0 };
}

// ---- SMS ------------------------------------------------------------------

const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split("")
);
const GSM7_EXT = new Set("^{}\\[~]|€".split(""));

export function smsSegments(body) {
  const chars = [...body];
  const gsm = chars.every((ch) => GSM7.has(ch) || GSM7_EXT.has(ch));
  if (gsm) {
    const units = chars.reduce((sum, ch) => sum + (GSM7_EXT.has(ch) ? 2 : 1), 0);
    return { encoding: "GSM-7", units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  return { encoding: "UCS-2", units: chars.length, segments: chars.length <= 70 ? 1 : Math.ceil(chars.length / 67) };
}

export function renderPassSms({ vip = false, brandKit, passType, holder, url, includeOptOut = true }) {
  const copy = { ...SMS_COPY, ...(passType.sms?.copy || {}) };
  const body =
    fill(vip ? copy.vip : copy.standard, { brand: brandKit.name, passName: passType.name, firstName: firstNameOf(holder), url }) +
    (includeOptOut ? copy.optOutSuffix : "");
  const stats = smsSegments(body);
  const warnings = [];
  if (stats.encoding !== "GSM-7") warnings.push("sms_not_gsm7");
  if (stats.segments > 1) warnings.push("sms_multi_segment");
  return { body, ...stats, warnings };
}
