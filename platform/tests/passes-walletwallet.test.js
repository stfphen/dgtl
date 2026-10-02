// DGTL Pass: Apple Wallet through WalletWallet (no Apple Developer account).
// The request we send, what we accept back, and that one pass makes one
// provider pass no matter how many times the holder taps "Add to Apple Wallet".
// A fake WalletWallet stands in for the network; no key, no request leaves.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { migratedPglite } from "./support/migrated-pglite.js";
import { resolveBrandKit } from "../lib/passes/brandKit.js";
import { parseCredentialSecrets } from "../lib/passes/credentials.js";
import { __setPassesDbForTests, installPresetPassTypes, issuePass, listPassTypes, passLinks, withTransaction } from "../lib/passes/store.js";
import { resolvePassDesign, TIER_PALETTE } from "../lib/passes/tiers.js";
import { describeValidity } from "../lib/passes/validity.js";
import {
  buildWalletWalletRequest,
  createWalletWalletPass,
  expirationDaysFor,
  revokeWalletWalletPass,
  TIER_COLOR_PRESETS,
  WalletProviderError
} from "../lib/passes/wallet/walletwallet.js";
import { getOrCreateWalletCopy, revokeWalletCopy } from "../lib/passes/wallet/index.js";

const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("signed pass")]);
const WW = { apiKey: `ww_live_${"a".repeat(32)}`, apiUrl: "https://api.walletwallet.dev", branding: "preset" };
const kit = resolveBrandKit({ brand: { name: "DGTL", primaryColor: TIER_PALETTE.gold.accent }, passes: { brandKit: { logoIncludesName: true, walletLogoText: "PASS", legal: { supportEmail: "help@venue.test" } } } });

function fakeWalletWallet({ status = 200, body } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const payload = body ?? { serialNumber: `ww-${calls.length}`, applePass: ZIP.toString("base64"), shareUrl: `https://api.walletwallet.dev/p/ww-${calls.length}`, googleSaveUrl: "https://pay.google.com/gp/v/save/jwt" };
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

const sample = (tier, overrides = {}) => {
  const passType = { name: { day: "Day Pass", monthly: "Monthly Pass", yearly: "Annual Pass", vip_lifetime: "VIP Lifetime" }[tier], tier, isVip: tier === "vip_lifetime" };
  const pass = { shortCode: "K7M2QX9P", validFrom: "2026-10-02T08:00:00Z", validUntil: tier === "vip_lifetime" ? null : "2026-10-03T08:00:00Z", ...overrides };
  const design = resolvePassDesign(passType, kit);
  return { pass, passType, holder: { name: "Alex Rivera" }, design, validity: describeValidity(pass, { timeZone: "America/Toronto", dayCutoffHour: 4 }), kit, passPageUrl: "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS", now: "2026-10-02T20:00:00Z" };
};

test("the request carries OUR pass link as the barcode, so the door still checks the server", () => {
  const request = buildWalletWalletRequest(sample("vip_lifetime"));
  assert.equal(request.barcodeValue, "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS");
  assert.equal(request.barcodeFormat, "QR");
  assert.equal(request.barcodeAltText, "K7M2-QX9P");
  assert.equal(request.organizationName, "DGTL");
  assert.equal(request.logoText, "DGTL PASS", "free plan: no logo image, so the lockup is spelled out");
  assert.deepEqual(request.secondaryFields, [{ label: "Member", value: "Alex Rivera" }, { label: "Expires", value: "Never" }]);
  assert.equal(request.sharingProhibited, true);
  assert.equal(request.expirationDays, 3650, "lifetime is the provider's maximum");
  assert.ok(request.backFields.some((f) => f.label === "Help" && f.value === "help@venue.test"));
  assert.equal("color" in request, false, "custom colours are a Pro feature: not sent on the free plan");
  assert.equal(JSON.stringify(request).includes("@example.com"), false, "no holder email or phone leaves");
});

test("tiers stay apart on the free plan's presets, and never borrow the scanner's green or red", () => {
  const presets = ["day", "monthly", "yearly", "vip_lifetime"].map((tier) => buildWalletWalletRequest(sample(tier)).colorPreset);
  assert.deepEqual(presets, ["blue", "orange", "purple", "dark"]);
  assert.equal(new Set(presets).size, 4);
  assert.equal(Object.values(TIER_COLOR_PRESETS).some((preset) => ["green", "red"].includes(preset)), false);
});

test("Pro branding sends the tier's exact card face", () => {
  const request = buildWalletWalletRequest({ ...sample("monthly"), branding: "full" });
  assert.equal(request.color, TIER_PALETTE.bronze.face);
});

test("expiry rounds up to whole days, so Wallet never greys a pass that still works", () => {
  assert.equal(expirationDaysFor("2026-10-03T08:00:00Z", "2026-10-02T20:00:00Z"), 1);
  assert.equal(expirationDaysFor("2026-11-02T08:00:00Z", "2026-10-02T08:00:00Z"), 31);
  assert.equal(expirationDaysFor("2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"), 1, "never below the provider's minimum");
  assert.equal(expirationDaysFor(null, "2026-10-02T00:00:00Z"), 3650);
});

test("create: bearer auth, a real .pkpass back, and refusals become typed errors", async () => {
  const ok = fakeWalletWallet();
  const created = await createWalletWalletPass(WW, { barcodeValue: "x" }, ok.fetchImpl);
  assert.equal(ok.calls[0].url, "https://api.walletwallet.dev/api/passes");
  assert.equal(ok.calls[0].method, "POST");
  assert.equal(ok.calls[0].headers.Authorization, `Bearer ${WW.apiKey}`);
  assert.deepEqual(created.pkpass, ZIP);
  assert.equal(created.ref, "ww-1");
  assert.equal(created.googleUrl, "https://pay.google.com/gp/v/save/jwt");

  const notZip = fakeWalletWallet({ body: { serialNumber: "s", applePass: Buffer.from("<html>").toString("base64") } });
  await assert.rejects(createWalletWalletPass(WW, {}, notZip.fetchImpl), /no signed pass/);
  const quota = fakeWalletWallet({ status: 429, body: { error: "Monthly pass limit reached" } });
  await assert.rejects(createWalletWalletPass(WW, {}, quota.fetchImpl), (error) => error instanceof WalletProviderError && error.status === 429 && /limit reached/.test(error.message));
  await assert.rejects(createWalletWalletPass(WW, {}, async () => { throw new TypeError("fetch failed"); }), (error) => error.status === 504);
  const badGoogle = fakeWalletWallet({ body: { serialNumber: "s", applePass: ZIP.toString("base64"), googleSaveUrl: "https://evil.example/save" } });
  assert.equal((await createWalletWalletPass(WW, {}, badGoogle.fetchImpl)).googleUrl, null, "only Google's own save link is passed on");
});

test("revoke: DELETE by serial; a pass the provider no longer has counts as revoked", async () => {
  const ok = fakeWalletWallet({ body: { deleted: true } });
  await revokeWalletWalletPass(WW, "ww/1", ok.fetchImpl);
  assert.equal(ok.calls[0].method, "DELETE");
  assert.equal(ok.calls[0].url, "https://api.walletwallet.dev/api/passes/ww%2F1");
  const gone = fakeWalletWallet({ status: 404, body: { error: "Pass not found" } });
  assert.deepEqual(await revokeWalletWalletPass(WW, "ww-9", gone.fetchImpl), { deleted: true, alreadyGone: true });
});

// ---- with the database: one pass, one provider pass ----
const db = await migratedPglite();
__setPassesDbForTests(db);
after(() => __setPassesDbForTests(null));
await db.exec(`
  insert into teams (id, name, slug) values ('team_w', 'Wallet Venue', 'wallet-venue');
  insert into tenants (id, team_id, slug, config) values ('tenant_w', 'team_w', 'tenant-w', '{}'::jsonb);
`);

test("two taps on Add to Apple Wallet create one provider pass; revoke greys it out", async () => {
  await installPresetPassTypes({ teamId: "team_w", tenantId: "tenant_w" });
  const vipType = (await listPassTypes({ teamId: "team_w", tenantId: "tenant_w" })).find((t) => t.tier === "vip_lifetime");
  const secrets = parseCredentialSecrets(`k1:${Buffer.alloc(32, 4).toString("base64")}`);
  const issued = await withTransaction((tx) =>
    issuePass(tx, { teamId: "team_w", tenantId: "tenant_w", passTypeId: vipType.id, holder: { name: "Alex Rivera", email: "alex@example.com" }, startDate: "2026-10-02" }, { secrets, activeKeyId: "k1", timeZone: "America/Toronto", dayCutoffHour: 4 })
  );
  const config = { wallet: { provider: "walletwallet", walletwallet: WW } };
  const view = { ...sample("vip_lifetime"), pass: issued.pass, passType: vipType, config, passPageUrl: passLinks(issued.pass, { secrets, baseUrl: "https://pass.example.com" }).passPageUrl };
  const fake = fakeWalletWallet();

  const first = await getOrCreateWalletCopy(view, { fetchImpl: fake.fetchImpl });
  const second = await getOrCreateWalletCopy(view, { fetchImpl: fake.fetchImpl });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.deepEqual(second.pkpass, ZIP);
  assert.equal(fake.calls.length, 1, "the second tap is served from the stored copy: no second (billed) pass");
  assert.equal(fake.calls[0].body.barcodeValue, view.passPageUrl);

  const stored = (await db.query(`select * from passes where id = $1`, [issued.pass.id])).rows[0];
  const revoked = await revokeWalletCopy({ id: issued.pass.id, walletProvider: stored.wallet_provider, walletRef: stored.wallet_ref }, config, { fetchImpl: fake.fetchImpl });
  assert.deepEqual(revoked, { revoked: true });
  assert.equal(fake.calls[1].method, "DELETE");
  assert.equal(fake.calls[1].url, "https://api.walletwallet.dev/api/passes/ww-1");

  const failing = await revokeWalletCopy({ id: issued.pass.id, walletProvider: "walletwallet", walletRef: "ww-1" }, config, { fetchImpl: async () => { throw new TypeError("down"); } });
  assert.match(failing.error, /unreachable/);
  const { rows } = await db.query(`select wallet_error from passes where id = $1`, [issued.pass.id]);
  assert.match(rows[0].wallet_error, /unreachable/, "a provider failure is recorded on the pass, never thrown at the admin");
  assert.deepEqual(await revokeWalletCopy({ id: "p", walletProvider: null, walletRef: null }, config), { skipped: "no_wallet_copy" });
});
