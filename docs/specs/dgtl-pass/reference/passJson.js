// DGTL Pass — Apple Wallet pass.json builder (reference implementation).
//
// Builds only the pass.json *content*. Zipping, manifest hashing and PKCS#7
// signing are done by passkit-generator in the real build (07-apple-wallet.md).
// Keeping this pure means the layout of every tier is unit-tested without
// certificates.
//
// Wallet displays whatever strings we give it, so dates are pre-formatted in
// the tenant's timezone (describeValidity). Letting Wallet localize an ISO date
// in the *device's* zone would show an exclusive end instant ("Oct 30, 12:00 AM")
// instead of the business meaning ("Through Oct 29").
//
// Port target: platform/lib/passes/wallet/passJson.js.

import { walletColor } from "./brand.js";
import { formatShortCode } from "./credentials.js";

// Image slots per style, in points (@1x). Ship @2x and @3x as well.
// Sources: Apple Wallet Developer Guide, "Pass Design and Creation".
export const WALLET_IMAGE_SPECS = Object.freeze({
  common: {
    "icon.png": { width: 29, height: 29, required: true, note: "Lock screen + Mail. Square, no transparency tricks." },
    "logo.png": { width: 160, height: 50, required: false, note: "Top-left. Max size; keep it narrower if logoText is shown." }
  },
  eventTicket: { "strip.png": { width: 375, height: 98, required: false } },
  storeCard: { "strip.png": { width: 375, height: 144, required: false } },
  generic: { "thumbnail.png": { width: 90, height: 90, required: false } }
});

function field(key, label, value, extra = {}) {
  return { key, label, value: String(value ?? ""), ...extra };
}

function entryLabel(pass) {
  if (pass.maxUses === 1) return "Single entry";
  if (pass.maxUses) return `${pass.maxUses} entries`;
  return "Re-entry";
}

function layoutFor({ style, pass, passType, holder, design, validity, issuedLabel }) {
  const tierLabel = design.isVip ? "VIP" : String(design.materialLabel || passType.name).toUpperCase();

  if (style === "eventTicket") {
    return {
      headerFields: [field("valid", "VALID", validity.lifetime ? "Always" : validity.untilShort)],
      primaryFields: [field("pass", "PASS", passType.name)],
      secondaryFields: [field("holder", "HOLDER", holder.name), field("entry", "ENTRY", entryLabel(pass))],
      auxiliaryFields: [field("from", "FROM", validity.from), field("until", "UNTIL", validity.untilShort)]
    };
  }

  if (style === "storeCard") {
    return {
      headerFields: [field("tier", "TIER", tierLabel)],
      primaryFields: [field("access", "ACCESS", validity.lifetime ? "Lifetime" : passType.name)],
      secondaryFields: [field("holder", "MEMBER", holder.name), field("expires", "EXPIRES", validity.untilShort)],
      auxiliaryFields: [field("since", "MEMBER SINCE", issuedLabel)]
    };
  }

  // generic
  return {
    headerFields: [field("tier", "TIER", tierLabel)],
    primaryFields: [field("holder", "MEMBER", holder.name)],
    secondaryFields: [field("pass", "PASS", passType.name), field("until", "VALID THROUGH", validity.untilShort)],
    auxiliaryFields: [field("since", "MEMBER SINCE", issuedLabel), field("entry", "ENTRY", entryLabel(pass))]
  };
}

/**
 * pass:      { id, status, validFrom, validUntil, maxUses, shortCode }
 * passType:  { name, tier }
 * holder:    { name }
 * brandKit:  resolveBrandKit(tenant)
 * design:    resolvePassDesign(passType, brandKit)
 * validity:  describeValidity(pass, { timeZone, dayCutoffHour })
 * links:     { credentialUrl, passPageUrl }
 * wallet:    { passTypeIdentifier, teamIdentifier, webServiceURL?, authenticationToken? }
 */
export function buildPassJson({ pass, passType, holder, brandKit, design, validity, links, wallet, issuedLabel }) {
  if (!wallet?.passTypeIdentifier || !wallet?.teamIdentifier) {
    throw new Error("passTypeIdentifier and teamIdentifier are required.");
  }
  const style = design.wallet.style;
  const json = {
    formatVersion: 1,
    passTypeIdentifier: wallet.passTypeIdentifier,
    teamIdentifier: wallet.teamIdentifier,
    serialNumber: pass.id,
    organizationName: brandKit.name,
    description: `${brandKit.name} ${passType.name}`,
    logoText: brandKit.logoText,
    backgroundColor: walletColor(design.wallet.background),
    foregroundColor: walletColor(design.wallet.foreground),
    labelColor: walletColor(design.wallet.label),
    sharingProhibited: true,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: links.credentialUrl,
        messageEncoding: "iso-8859-1",
        altText: formatShortCode(pass.shortCode)
      }
    ],
    [style]: {
      ...layoutFor({ style, pass, passType, holder, design, validity, issuedLabel }),
      backFields: [
        field("support", "Help", brandKit.legal.supportEmail || brandKit.legal.supportUrl || "Contact the venue"),
        ...(brandKit.legal.termsUrl ? [field("terms", "Terms", brandKit.legal.termsUrl)] : []),
        field("view", "Your pass online", links.passPageUrl),
        field("code", "Pass code", formatShortCode(pass.shortCode)),
        field("serial", "Pass ID", pass.id)
      ]
    }
  };

  if (pass.validUntil) json.expirationDate = new Date(pass.validUntil).toISOString().replace(/\.\d{3}Z$/, "Z");
  if (style === "eventTicket") json.relevantDate = new Date(pass.validFrom).toISOString().replace(/\.\d{3}Z$/, "Z");
  if (pass.status === "revoked") json.voided = true;

  // Only advertise the update service when it is actually deployed (Phase 5b).
  // A webServiceURL with no server behind it makes Wallet retry and log errors.
  if (wallet.webServiceURL) {
    if (!/^https:\/\//.test(wallet.webServiceURL)) throw new Error("webServiceURL must be https.");
    if (!wallet.authenticationToken || wallet.authenticationToken.length < 16) {
      throw new Error("authenticationToken must be at least 16 characters.");
    }
    json.webServiceURL = wallet.webServiceURL;
    json.authenticationToken = wallet.authenticationToken;
  }
  return json;
}

export function requiredImages(style) {
  return { ...WALLET_IMAGE_SPECS.common, ...(WALLET_IMAGE_SPECS[style] || {}) };
}
