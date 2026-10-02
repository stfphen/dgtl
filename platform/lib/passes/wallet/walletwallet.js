// DGTL Pass — Apple Wallet through WalletWallet (https://www.walletwallet.dev).
//
// WalletWallet signs each .pkpass with its own Pass Type ID certificate, so no
// Apple Developer account is needed. One POST returns the signed pass, a "Save
// to Google Wallet" link and a hosted install page; DELETE revokes it on both
// wallets. The pass's barcode is OUR pass link, so the door still verifies
// against our database: a Wallet copy can never admit on its own.
//
// Plans (checked 2026-10-01): Free is 1,000 creates + updates a month, with a
// colour preset and text only. Pro ($39/month) adds the logo, strip art and
// exact tier colours, sent here when WALLETWALLET_BRANDING=full: the same
// layout and artwork as a DGTL-signed pass (wallet/passJson.js, wallet/images.js).
//
// Data: the holder's name and the pass link go to WalletWallet, a processor.
// Say so in the privacy notice before real holders get passes this way.

import { formatShortCode } from "../credentials.js";
import { walletLayout } from "./passJson.js";

export class WalletProviderError extends Error {
  constructor(message, status = 502, httpStatus = null) {
    super(message);
    this.name = "WalletProviderError";
    this.status = status;
    // The provider's own status, so callers can tell "your plan can't do that"
    // (4xx) from "the provider is down".
    this.httpStatus = httpStatus;
  }
}

// Free plan presets: dark, blue, green, red, purple, orange. Green and red are
// avoided because they read as the scanner's admit/deny. Silver has no grey
// preset, so purple keeps the four tiers apart; Pro sends the exact faces.
export const TIER_COLOR_PRESETS = Object.freeze({
  day: "blue",
  monthly: "orange",
  yearly: "purple",
  vip_lifetime: "dark",
  custom: "dark"
});

const DAY_MS = 86_400_000;
const MAX_EXPIRATION_DAYS = 3650;

// WalletWallet takes a day count, not a date. Round up so Wallet never greys a
// pass that is still valid; the door decides from the server either way.
export function expirationDaysFor(validUntil, now) {
  if (!validUntil) return MAX_EXPIRATION_DAYS;
  const days = Math.ceil((new Date(validUntil).getTime() - new Date(now).getTime()) / DAY_MS);
  return Math.min(Math.max(days, 1), MAX_EXPIRATION_DAYS);
}

const field = (label, value) => ({ label: String(label), value: String(value ?? "") });

const plainField = ({ label, value }) => field(label, value);

/**
 * The create request for one pass. Pure: no network, no secrets.
 * design: resolvePassDesign(...) · validity: describeValidity(...) · kit: resolveBrandKit(...)
 * images: walletWalletImages(design), for branding "full" (Pro).
 */
export function buildWalletWalletRequest({ pass, passType, holder, design, validity, kit, passPageUrl, now, branding = "preset", images = null, issuedLabel = "" }) {
  const tierLabel = design.isVip ? "VIP" : design.materialLabel || passType.name;
  const code = formatShortCode(pass.shortCode);
  const back = [
    field("Your pass", passPageUrl),
    field("Pass code", code),
    kit.legal?.supportEmail ? field("Help", kit.legal.supportEmail) : null,
    kit.legal?.termsUrl ? field("Terms", kit.legal.termsUrl) : null,
    field("At the door", "Staff scan this code. It is checked live, so a screenshot or a revoked pass will not get in.")
  ].filter(Boolean);

  const request = {
    barcodeValue: passPageUrl,
    barcodeFormat: "QR",
    barcodeAltText: code,
    organizationName: kit.name.slice(0, 64),
    description: `${kit.name} ${passType.name}`.slice(0, 120),
    // Free plan: no logo image, so the lockup is spelled out ("DGTL PASS").
    logoText: [kit.name, kit.walletLogoText].filter(Boolean).join(" ").slice(0, 40),
    headerFields: [field(design.isVip ? "Access" : "Tier", tierLabel)],
    primaryFields: [field("Pass", passType.name)],
    secondaryFields: [
      field(design.isVip ? "Member" : "Holder", holder.name),
      field(validity.lifetime ? "Expires" : "Valid until", validity.untilShort)
    ],
    backFields: back,
    colorPreset: TIER_COLOR_PRESETS[passType.tier] || "dark",
    expirationDays: expirationDaysFor(pass.validUntil, now),
    sharingProhibited: true
  };

  if (branding === "full") {
    // Pro: the DGTL-signed card's own layout (a strip makes WalletWallet use
    // the storeCard style), the tier's card face, the brand-kit strip art, the
    // spark icon and the wordmark beside "PASS".
    const layout = walletLayout({ style: "storeCard", pass, passType, holder, design, validity, issuedLabel });
    request.headerFields = layout.headerFields.map(plainField);
    request.primaryFields = layout.primaryFields.map(plainField);
    request.secondaryFields = [...layout.secondaryFields, ...layout.auxiliaryFields].map(plainField);
    request.color = design.wallet.background;
    delete request.colorPreset;
    if (images) {
      request.stripURL = images.stripURL;
      request.iconURL = images.iconURL;
      request.logoURL = images.logoURL;
      request.logoText = kit.walletLogoText || "";
    }
  }
  return request;
}

async function call(config, method, path, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${config.apiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    throw new WalletProviderError(`WalletWallet is unreachable (${error?.name || "network error"}).`, 504);
  }
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const reason = typeof data?.error === "string" ? data.error.slice(0, 200) : `HTTP ${response.status}`;
    // 429 = the plan's monthly pass allowance is used up.
    throw new WalletProviderError(`WalletWallet refused the request: ${reason}`, response.status === 429 ? 429 : 502, response.status);
  }
  return data;
}

/** Create the signed pass. Returns { ref, shareUrl, googleUrl, pkpass }. */
export async function createWalletWalletPass(config, request, fetchImpl = fetch) {
  const data = await call(config, "POST", "/api/passes", request, fetchImpl);
  const pkpass = typeof data.applePass === "string" ? Buffer.from(data.applePass, "base64") : null;
  // A .pkpass is a ZIP archive: refuse anything else rather than hand Safari junk.
  if (!pkpass || pkpass.length < 4 || pkpass.readUInt32LE(0) !== 0x04034b50) {
    throw new WalletProviderError("WalletWallet returned no signed pass.");
  }
  if (!data.serialNumber) throw new WalletProviderError("WalletWallet returned no serial number.");
  return {
    ref: String(data.serialNumber),
    shareUrl: /^https:\/\//.test(data.shareUrl || "") ? data.shareUrl : null,
    googleUrl: /^https:\/\/pay\.google\.com\//.test(data.googleSaveUrl || "") ? data.googleSaveUrl : null,
    pkpass
  };
}

/** Revoke on both wallets. A pass that is already gone counts as revoked. */
export async function revokeWalletWalletPass(config, ref, fetchImpl = fetch) {
  try {
    return await call(config, "DELETE", `/api/passes/${encodeURIComponent(ref)}`, null, fetchImpl);
  } catch (error) {
    if (/HTTP 404|not found/i.test(error.message)) return { deleted: true, alreadyGone: true };
    throw error;
  }
}
