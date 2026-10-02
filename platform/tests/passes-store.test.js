// DGTL Pass Phase 2: the store against real SQL (PGlite, every migration).
// Pass types, issue + idempotency, the door rules, the holder lookup, the
// admin list and overview, revoke, and the hosted Wallet copy columns.
// The many-scanners race needs separate connections: it runs against real
// Postgres in tests/passes.pg.test.js.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { migratedPglite } from "./support/migrated-pglite.js";
import { parseCredentialSecrets } from "../lib/passes/credentials.js";
import {
  __setPassesDbForTests,
  getPassForHolder,
  installPresetPassTypes,
  issuePass,
  listPasses,
  listPassTypes,
  lockPassForWallet,
  passesOverview,
  passLinks,
  revokePass,
  saveWalletCopy,
  verifyScan,
  withTransaction,
  withUniqueRetry
} from "../lib/passes/store.js";

const db = await migratedPglite();
__setPassesDbForTests(db);
after(() => __setPassesDbForTests(null));

await db.exec(`
  insert into teams (id, name, slug) values ('team_a', 'Venue A', 'venue-a'), ('team_b', 'Venue B', 'venue-b');
  insert into tenants (id, team_id, slug, config) values
    ('tenant_a', 'team_a', 'tenant-a', '{}'::jsonb),
    ('tenant_b', 'team_b', 'tenant-b', '{}'::jsonb);
  insert into users (id, email, name, password_hash) values ('user_door', 'door@a.test', 'Door', null);
`);

const config = {
  secrets: parseCredentialSecrets(`k1:${Buffer.alloc(32, 9).toString("base64")}`),
  activeKeyId: "k1",
  baseUrl: "https://pass.example.com"
};
const deps = { secrets: config.secrets, activeKeyId: "k1", timeZone: "America/Toronto", dayCutoffHour: 4 };
const scanDeps = { allowedHosts: ["pass.example.com"], timeZone: "America/Toronto", dayCutoffHour: 4 };
const issue = (input) => withTransaction((tx) => issuePass(tx, { teamId: "team_a", tenantId: "tenant_a", startDate: "2026-10-02", ...input }, deps));
const scan = (input) =>
  withTransaction((tx) => verifyScan(tx, { scanId: `scan_${crypto.randomUUID().replace(/-/g, "")}`, verifierId: "user_door", teamId: "team_a", inputKind: "qr", ...input }, scanDeps));

let types;

test("the five DGTL presets install once per tenant, in order, with their rules", async () => {
  assert.deepEqual(await installPresetPassTypes({ teamId: "team_a", tenantId: "tenant_a" }), { created: 5, total: 5 });
  assert.deepEqual(await installPresetPassTypes({ teamId: "team_a", tenantId: "tenant_a" }), { created: 0, total: 5 }, "idempotent");
  types = await listPassTypes({ teamId: "team_a", tenantId: "tenant_a" });
  assert.deepEqual(types.map((t) => t.slug), ["day-single", "day", "monthly", "yearly", "vip-lifetime"]);
  const vip = types.find((t) => t.slug === "vip-lifetime");
  assert.equal(vip.isVip, true);
  assert.deepEqual(vip.validity, { kind: "lifetime", count: 1 });
  assert.equal(types.find((t) => t.slug === "day-single").maxUses, 1);
  assert.equal(types.find((t) => t.slug === "day").reentryCooldownSeconds, 300);
  assert.deepEqual(await listPassTypes({ teamId: "team_b", tenantId: "tenant_a" }), [], "another team sees none of them");
});

test("issuing is idempotent on the request id, and a pass type from another team does not exist", async () => {
  const single = types.find((t) => t.slug === "day-single");
  const first = await issue({ passTypeId: single.id, holder: { name: "Jordan Avery", email: "Jordan@Example.com" }, issueRequestId: "issue_req_00000001" });
  const again = await withUniqueRetry(() => issue({ passTypeId: single.id, holder: { name: "Jordan Avery", email: "jordan@example.com" }, issueRequestId: "issue_req_00000001" }));
  assert.equal(first.replay, false);
  assert.equal(again.replay, true);
  assert.equal(again.pass.id, first.pass.id);
  assert.equal(again.credential, first.credential, "the replay hands back the same link");
  assert.equal(first.holder.email, "jordan@example.com", "emails are stored lowercased");
  await assert.rejects(
    withTransaction((tx) => issuePass(tx, { teamId: "team_b", tenantId: "tenant_b", passTypeId: single.id, holder: { name: "X", email: "x@b.test" }, startDate: "2026-10-02" }, deps)),
    (error) => error.code === "pass_type_not_found" && error.status === 404
  );
  await assert.rejects(issue({ passTypeId: single.id, holder: { name: "No Contact" } }), (error) => error.field === "holder.email");
  await assert.rejects(issue({ passTypeId: single.id, holder: { name: "Bad Phone", phone: "555-0100" } }), (error) => error.field === "holder.phone");
});

test("door rules: single use, replay, cooldown warning, foreign host, unknown code", async () => {
  const single = await issue({ passTypeId: types.find((t) => t.slug === "day-single").id, holder: { name: "Sam Single", email: "sam@example.com" } });
  const url = passLinks(single.pass, config).passPageUrl;
  // The window opens at 04:00 on 2026-10-02 Toronto; scan "inside" it by moving the pass.
  await db.query(`update passes set valid_from = now() - interval '1 hour', valid_until = now() + interval '1 day' where id = $1`, [single.pass.id]);

  const firstId = `scan_${"a".repeat(32)}`;
  const first = await scan({ scanId: firstId, raw: url });
  assert.equal(first.result, "valid");
  assert.equal(first.holderName, "Sam Single");
  const second = await scan({ raw: url });
  assert.equal(second.result, "used");
  assert.equal(second.admit, false);
  const replay = await scan({ scanId: firstId, raw: url });
  assert.equal(replay.replay, true);
  assert.equal(replay.result, "valid", "a replayed scan id returns the stored verdict, not a second admission");

  const day = await issue({ passTypeId: types.find((t) => t.slug === "day").id, holder: { name: "Priya Day", phone: "+14165550123" } });
  await db.query(`update passes set valid_from = now() - interval '1 hour', valid_until = now() + interval '1 day' where id = $1`, [day.pass.id]);
  const dayUrl = passLinks(day.pass, config).passPageUrl;
  assert.equal((await scan({ raw: dayUrl })).result, "valid");
  const again = await scan({ raw: dayUrl, gate: "Side door" });
  assert.equal(again.result, "recently_used");
  assert.equal(again.tone, "warn");

  const foreign = await scan({ raw: url.replace("pass.example.com", "evil.example") });
  assert.equal(foreign.result, "invalid_format");
  assert.equal(foreign.holderName, undefined);
  const unknown = await scan({ raw: "ZZZZ-ZZZZ", inputKind: "manual" });
  assert.equal(unknown.result, "not_found");
  assert.deepEqual(Object.keys(unknown).sort(), ["admit", "replay", "result", "scanId", "title", "tone"], "a miss reveals nothing");

  const { rows } = await db.query(`select count(*)::int as n, count(*) filter (where admitted)::int as admitted from pass_scans where team_id = 'team_a'`);
  // valid, used, (replay: no row), valid, recently_used, invalid_format, not_found
  assert.deepEqual(rows[0], { n: 6, admitted: 2 }, "every scan is in the ledger once; replays add nothing");
});

test("http QR codes are accepted only from the dev base URL's own host", async () => {
  const pass = await issue({ passTypeId: types.find((t) => t.slug === "vip-lifetime").id, holder: { name: "Lan Demo", email: "lan@example.com" } });
  await db.query(`update passes set valid_from = now() - interval '1 hour' where id = $1`, [pass.pass.id]);
  const lanUrl = passLinks(pass.pass, { ...config, baseUrl: "http://192.168.2.10:8090" }).passPageUrl;
  const lanDeps = { ...scanDeps, allowedHosts: ["192.168.2.10"], insecureHosts: ["192.168.2.10"] };
  const run = (raw, d) => withTransaction((tx) => verifyScan(tx, { scanId: `scan_${crypto.randomUUID().replace(/-/g, "")}`, raw, verifierId: "user_door", teamId: "team_a" }, d));
  assert.equal((await run(lanUrl, lanDeps)).result, "valid");
  assert.equal((await run(lanUrl, { ...lanDeps, insecureHosts: [] })).result, "invalid_format", "without the dev allowance, http is refused");
});

test("the holder lookup: effective status, first view stamped, unknown credential is null", async () => {
  const vip = await issue({ passTypeId: types.find((t) => t.slug === "vip-lifetime").id, holder: { name: "Alex Rivera", email: "alex@example.com" } });
  const found = await getPassForHolder(vip.credential);
  assert.equal(found.holder.name, "Alex Rivera");
  assert.equal(found.passType.isVip, true);
  assert.ok(["active", "scheduled"].includes(found.status));
  const { rows } = await db.query(`select first_viewed_at from passes where id = $1`, [vip.pass.id]);
  assert.ok(rows[0].first_viewed_at, "opening the page is the invitation's accept");
  assert.equal(await getPassForHolder("0123456789ABCDEFGHJKMNPQRS"), null);
});

test("revoke is terminal and team-scoped; the list and overview reflect it", async () => {
  const pass = await issue({ passTypeId: types.find((t) => t.slug === "monthly").id, holder: { name: "Maya Chen", email: "maya@example.com" } });
  assert.equal(await withTransaction((tx) => revokePass(tx, { passId: pass.pass.id, teamId: "team_b", revokedBy: null })), null, "another team cannot revoke it");
  const revoked = await withTransaction((tx) => revokePass(tx, { passId: pass.pass.id, teamId: "team_a", revokedBy: null, reason: "test" }));
  assert.equal(revoked.status, "revoked");
  assert.equal(await withTransaction((tx) => revokePass(tx, { passId: pass.pass.id, teamId: "team_a", revokedBy: null })), null, "already revoked");

  const list = await listPasses({ teamId: "team_a", tenantId: "tenant_a" });
  const row = list.find((p) => p.id === pass.pass.id);
  assert.equal(row.effectiveStatus, "revoked");
  assert.equal(row.holderName, "Maya Chen");
  assert.equal(row.tier, "monthly");
  assert.equal("credentialHash" in row, false, "the list never carries credentials");
  assert.deepEqual(await listPasses({ teamId: "team_b", tenantId: "tenant_a" }), []);

  const overview = await passesOverview({ teamId: "team_a", tenantId: "tenant_a", dayStart: new Date(Date.now() - 3600_000) });
  assert.equal(overview.scansToday, 8, "6 door-rule scans + 2 LAN scans");
  assert.equal(overview.admitsToday, 3);
  assert.ok(overview.recentScans.length > 0);
  assert.equal(overview.byTier.monthly, undefined, "a revoked pass is not active");
  // The tier bars and the Active KPI count the same thing: a used single entry is neither.
  const byTierTotal = Object.values(overview.byTier).reduce((sum, n) => sum + n, 0);
  assert.equal(byTierTotal, overview.active);
});

test("a hosted Wallet copy is stored once and handed back on the next tap", async () => {
  const pass = await issue({ passTypeId: types.find((t) => t.slug === "yearly").id, holder: { name: "Sam Okafor", email: "sam.o@example.com" } });
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  await withTransaction(async (tx) => {
    const locked = await lockPassForWallet(tx, pass.pass.id);
    assert.equal(locked.pkpass, null);
    await saveWalletCopy(tx, { passId: pass.pass.id, provider: "walletwallet", ref: "ww-serial-1", shareUrl: "https://api.walletwallet.dev/p/ww-serial-1", googleUrl: "https://pay.google.com/gp/v/save/x", pkpass: zip });
  });
  const again = await withTransaction((tx) => lockPassForWallet(tx, pass.pass.id));
  assert.deepEqual(again.pkpass, zip);
  assert.equal(again.pass.walletProvider, "walletwallet");
  assert.equal(again.pass.walletRef, "ww-serial-1");
  assert.equal(again.pass.walletGoogleUrl, "https://pay.google.com/gp/v/save/x");
  await assert.rejects(db.query(`update passes set wallet_provider = 'other' where id = $1`, [pass.pass.id]), /passes_wallet_provider_check/);
});
