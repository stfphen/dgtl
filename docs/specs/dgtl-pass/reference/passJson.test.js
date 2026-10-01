import assert from "node:assert/strict";
import test from "node:test";
import { resolveBrandKit } from "./brand.js";
import { TIER_PRESETS, resolvePassDesign } from "./tiers.js";
import { describeValidity } from "./validity.js";
import { buildPassJson, requiredImages } from "./passJson.js";

const brandKit = resolveBrandKit({ passes: { brandKit: { legal: { supportEmail: "help@example.com", termsUrl: "https://example.com/terms" } } } });
const wallet = { passTypeIdentifier: "pass.io.example.passes", teamIdentifier: "ABCDE12345" };
const links = { credentialUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS", passPageUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS" };

function build(presetId, passOverrides = {}, walletOverrides = {}) {
  const preset = TIER_PRESETS[presetId];
  const passType = { name: preset.name, tier: preset.tier, isVip: preset.isVip, design: preset.design };
  const pass = {
    id: "pass_7f3c",
    status: "active",
    validFrom: "2026-10-03T04:00:00Z",
    validUntil: preset.validity.kind === "lifetime" ? null : "2026-10-04T04:00:00Z",
    maxUses: preset.usage.maxUses,
    shortCode: "K7M2QX9P",
    ...passOverrides
  };
  const design = resolvePassDesign(passType, brandKit);
  const validity = describeValidity(pass, { timeZone: "America/Toronto" });
  return buildPassJson({
    pass,
    passType,
    holder: { name: "Alex Rivera", email: "alex@example.com" },
    brandKit,
    design,
    validity,
    links,
    wallet: { ...wallet, ...walletOverrides },
    issuedLabel: "Sep 30, 2026"
  });
}

test("each tier renders in its Wallet style with identity fields set", () => {
  const expected = { day_single: "eventTicket", day: "eventTicket", monthly: "generic", yearly: "generic", vip_lifetime: "storeCard" };
  for (const [presetId, style] of Object.entries(expected)) {
    const json = build(presetId);
    assert.equal(json.formatVersion, 1);
    assert.equal(json.serialNumber, "pass_7f3c");
    assert.equal(json.passTypeIdentifier, wallet.passTypeIdentifier);
    assert.equal(json.teamIdentifier, wallet.teamIdentifier);
    assert.ok(json[style], `${presetId} uses ${style}`);
    assert.match(json.backgroundColor, /^rgb\(\d+, \d+, \d+\)$/);
    assert.equal(json.barcodes[0].format, "PKBarcodeFormatQR");
    assert.equal(json.barcodes[0].message, links.credentialUrl);
    assert.equal(json.barcodes[0].altText, "K7M2-QX9P");
    assert.equal(json.sharingProhibited, true);
  }
});

test("expiry and void flags follow the pass", () => {
  assert.equal(build("day").expirationDate, "2026-10-04T04:00:00Z");
  assert.equal(build("day").relevantDate, "2026-10-03T04:00:00Z");
  assert.equal(build("vip_lifetime").expirationDate, undefined);
  assert.equal(build("vip_lifetime").storeCard.secondaryFields.find((f) => f.key === "expires").value, "Never");
  assert.equal(build("monthly", { status: "revoked" }).voided, true);
  assert.equal(build("monthly").voided, undefined);
});

test("the web service is only advertised when fully configured", () => {
  assert.equal(build("monthly").webServiceURL, undefined);
  const withService = build("monthly", {}, { webServiceURL: "https://pass.example.com/api/wallet", authenticationToken: "A".repeat(32) });
  assert.equal(withService.webServiceURL, "https://pass.example.com/api/wallet");
  assert.throws(() => build("monthly", {}, { webServiceURL: "https://pass.example.com/api/wallet", authenticationToken: "short" }), /16 characters/);
  assert.throws(() => build("monthly", {}, { webServiceURL: "http://pass.example.com/api/wallet", authenticationToken: "A".repeat(32) }), /https/);
  assert.throws(() => build("monthly", {}, { teamIdentifier: "" }), /required/);
});

test("pass.json carries the holder's name but no contact details", () => {
  const serialized = JSON.stringify(build("yearly"));
  assert.ok(serialized.includes("Alex Rivera"));
  assert.ok(!serialized.includes("alex@example.com"));
});

test("image requirements per style", () => {
  assert.ok(requiredImages("eventTicket")["strip.png"]);
  assert.equal(requiredImages("storeCard")["strip.png"].height, 144);
  assert.ok(requiredImages("generic")["thumbnail.png"]);
  assert.equal(requiredImages("generic")["icon.png"].required, true);
});
