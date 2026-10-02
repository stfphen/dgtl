// DGTL Pass Phase 5: passes signed with DGTL's own Apple Pass Type ID
// certificate, so the Wallet card is the exact design (previews/wallet.html).
//
// Certificates are throwaway, shaped like Apple's (tests/support). Every pass
// is unzipped, its manifest re-hashed, and its signature verified by OpenSSL,
// an implementation independent of ours. Skips where OpenSSL is missing.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { makeAppleTestCerts, opensslAvailable, TEST_PASS_TYPE_ID, TEST_TEAM_ID } from "./support/apple-test-certs.mjs";
import { migratedPglite } from "./support/migrated-pglite.js";
import { readPassesConfig } from "../lib/passes/config.js";
import { resolveBrandKit, walletColor } from "../lib/passes/brandKit.js";
import { parseCredentialSecrets } from "../lib/passes/credentials.js";
import { __setPassesDbForTests, installPresetPassTypes, issuePass, listPassTypes, passLinks, withTransaction } from "../lib/passes/store.js";
import { resolvePassDesign, TIER_PALETTE } from "../lib/passes/tiers.js";
import { describeValidity } from "../lib/passes/validity.js";
import { buildApplePass } from "../lib/passes/wallet/apple.js";
import { getOrCreateWalletCopy } from "../lib/passes/wallet/index.js";

const skip = opensslAvailable ? false : "openssl is not installed";
const certs = opensslAvailable ? makeAppleTestCerts() : null;
after(() => certs?.cleanup());

// Read back our own ZIP (deflate or store), central directory first.
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const dataAt = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const body = buffer.subarray(dataAt, dataAt + size);
    files[name] = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  return files;
}

const kit = resolveBrandKit({ brand: { name: "DGTL", primaryColor: TIER_PALETTE.gold.accent }, passes: { brandKit: { logoIncludesName: true, walletLogoText: "PASS", legal: { supportEmail: "help@venue.test" } } } });
const settings = { timeZone: "America/Toronto", dayCutoffHour: 4 };

function view(tier, overrides = {}) {
  const names = { day: "Day Pass", monthly: "Monthly Pass", yearly: "Annual Pass", vip_lifetime: "VIP Lifetime" };
  const passType = { name: names[tier], tier, isVip: tier === "vip_lifetime" };
  const pass = {
    id: `pass_${tier}`, status: "active", shortCode: "K7M2QX9P", maxUses: null, createdAt: "2026-10-02T16:00:00Z",
    validFrom: "2026-10-02T08:00:00Z", validUntil: tier === "vip_lifetime" ? null : "2026-11-02T08:00:00Z", ...overrides
  };
  return {
    pass, passType, holder: { name: "Alex Rivera" }, kit, settings,
    design: resolvePassDesign(passType, kit),
    validity: describeValidity(pass, settings),
    passPageUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS"
  };
}

test("config: a real-shaped certificate turns DGTL-signed Wallet on, and every mismatch fails at load", { skip }, () => {
  const config = readPassesConfig({ ...certs.env, PASS_WALLET_PROVIDER: "apple" });
  assert.equal(config.wallet.provider, "apple");
  assert.equal(config.walletEnabled, true);
  assert.equal(config.wallet.apple.passTypeId, TEST_PASS_TYPE_ID);
  assert.equal(readPassesConfig(certs.env).wallet.provider, "apple", "a complete PASSKIT_* set selects apple on its own");

  const bad = [
    [{ PASSKIT_PASS_TYPE_ID: "pass.io.someone.else" }, /is for pass\.test\.dgtl/],
    [{ PASSKIT_TEAM_ID: "OTHERTEAM1" }, /belongs to team TEAM123456/],
    [{ PASSKIT_SIGNER_KEY_B64: certs.otherKeyB64 }, /does not match/],
    [{ PASSKIT_WWDR_CERT_B64: certs.otherCaB64 }, /not the issuer/],
    [{ PASSKIT_SIGNER_CERT_B64: Buffer.from("not a pem").toString("base64") }, /base64-encoded PEM/]
  ];
  for (const [override, pattern] of bad) {
    assert.throws(() => readPassesConfig({ ...certs.env, ...override }), pattern, JSON.stringify(Object.keys(override)));
  }
});

test("every tier signs into a valid .pkpass: manifest hashes match and OpenSSL verifies the signature", { skip }, async () => {
  const apple = readPassesConfig(certs.env).wallet.apple;
  for (const tier of ["day", "monthly", "yearly", "vip_lifetime"]) {
    const v = view(tier);
    const files = unzip(await buildApplePass(v, apple));
    const manifest = JSON.parse(files["manifest.json"]);
    assert.deepEqual(Object.keys(manifest).sort(), Object.keys(files).filter((name) => !["manifest.json", "signature"].includes(name)).sort(), `${tier}: the manifest lists every file`);
    for (const [name, hash] of Object.entries(manifest)) {
      assert.equal(createHash("sha1").update(files[name]).digest("hex"), hash, `${tier}: ${name} hash`);
    }
    const verified = certs.verify(files.signature, files["manifest.json"]);
    assert.ok(verified.ok, `${tier}: ${verified.output}`);

    const json = JSON.parse(files["pass.json"]);
    assert.equal(json.passTypeIdentifier, TEST_PASS_TYPE_ID);
    assert.equal(json.teamIdentifier, TEST_TEAM_ID);
    assert.equal(json.barcodes[0].message, v.passPageUrl, "the barcode is our pass link: the door still asks the server");
    assert.equal(json.backgroundColor, walletColor(v.design.face), `${tier}: the tier's own card face`);
    assert.equal(json.labelColor, walletColor(v.design.accent), `${tier}: labels in the tier accent`);
    assert.equal(json.logoText, "PASS", "the DGTL⚡ PASS lockup");
    assert.ok(json[tier === "day" ? "eventTicket" : "storeCard"], `${tier}: style`);
    assert.equal(JSON.stringify(json).includes("@example.com"), false);
  }
});

test("artwork comes in Apple's sizes at @1x, @2x and @3x", { skip }, async () => {
  const apple = readPassesConfig(certs.env).wallet.apple;
  const sizes = async (files, name) => {
    const meta = await sharp(files[name]).metadata();
    return [meta.width, meta.height];
  };
  const day = unzip(await buildApplePass(view("day"), apple));
  assert.deepEqual(await sizes(day, "strip.png"), [375, 98]);
  assert.deepEqual(await sizes(day, "strip@3x.png"), [1125, 294]);
  const vip = unzip(await buildApplePass(view("vip_lifetime"), apple));
  assert.deepEqual(await sizes(vip, "strip.png"), [375, 144]);
  assert.deepEqual(await sizes(vip, "strip@2x.png"), [750, 288]);
  assert.deepEqual(await sizes(vip, "icon.png"), [29, 29], "icon.png is required: a pass without it will not install");
  assert.deepEqual(await sizes(vip, "icon@3x.png"), [87, 87]);
  const [logoWidth, logoHeight] = await sizes(vip, "logo@3x.png");
  assert.ok(logoWidth <= 480 && logoHeight <= 150 && logoHeight > 100, `logo fits 160×50 pt: ${logoWidth}×${logoHeight}`);
});

test("a tampered pass fails verification", { skip }, async () => {
  const apple = readPassesConfig(certs.env).wallet.apple;
  const files = unzip(await buildApplePass(view("monthly"), apple));
  const forged = Buffer.from(String(files["manifest.json"]).replace(/"pass\.json":"[0-9a-f]+"/, '"pass.json":"0000000000000000000000000000000000000000"'));
  assert.equal(certs.verify(files.signature, forged).ok, false, "a changed manifest breaks the signature");
});

test("the pass page's Wallet route signs on demand and records the first add", { skip }, async () => {
  const db = await migratedPglite();
  __setPassesDbForTests(db);
  try {
    await db.exec(`
      insert into teams (id, name, slug) values ('team_s', 'Signed Venue', 'signed-venue');
      insert into tenants (id, team_id, slug, config) values ('tenant_s', 'team_s', 'tenant-s', '{}'::jsonb);
    `);
    await installPresetPassTypes({ teamId: "team_s", tenantId: "tenant_s" });
    const type = (await listPassTypes({ teamId: "team_s", tenantId: "tenant_s" })).find((t) => t.tier === "yearly");
    const secrets = parseCredentialSecrets(`k1:${Buffer.alloc(32, 6).toString("base64")}`);
    const { pass } = await withTransaction((tx) =>
      issuePass(tx, { teamId: "team_s", tenantId: "tenant_s", passTypeId: type.id, holder: { name: "Sam Okafor", email: "sam@example.com" }, startDate: "2026-10-02" }, { secrets, activeKeyId: "k1", ...settings })
    );
    const config = readPassesConfig(certs.env);
    const v = { ...view("yearly"), pass, passType: type, config, passPageUrl: passLinks(pass, { secrets, baseUrl: "https://pass.example.com" }).passPageUrl };
    const copy = await getOrCreateWalletCopy(v, { fetchImpl: () => assert.fail("no network for a DGTL-signed pass") });
    assert.equal(copy.googleUrl, null);
    assert.ok(certs.verify(unzip(copy.pkpass).signature, unzip(copy.pkpass)["manifest.json"]).ok);
    const { rows } = await db.query(`select wallet_provider, wallet_issued_at, wallet_pkpass from passes where id = $1`, [pass.id]);
    assert.equal(rows[0].wallet_provider, "apple");
    assert.ok(rows[0].wallet_issued_at);
    assert.equal(rows[0].wallet_pkpass, null, "nothing to store: rebuilt from the pass row each time");
  } finally {
    __setPassesDbForTests(null);
  }
});
