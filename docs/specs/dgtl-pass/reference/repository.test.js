// Integration test: platform migrations 001-014 + draft 015, then issue and
// verify through real SQL.
//
// Uses PGlite (Postgres compiled to WASM, in-process: no Docker, no server).
// It is not a dependency of this repo. Point PGLITE_PATH at an install, or the
// suite is skipped:
//
//   npm i --prefix /tmp/pglite @electric-sql/pglite
//   PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite \
//     node --test docs/specs/dgtl-pass/reference/repository.test.js
//
// PGlite is single-connection, so this proves the SQL and the transaction
// logic, not lock contention. The concurrent double-scan test belongs in
// the platform suite against real Postgres (14-test-plan.md, T-C1).

import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { credentialUrl, parseCredentialSecrets, formatShortCode } from "./credentials.js";
import { TIER_PRESETS } from "./tiers.js";
import { issuePass, revokePass, verifyScan, PassError } from "./repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

async function loadPGlite() {
  const target = process.env.PGLITE_PATH || "@electric-sql/pglite";
  try {
    const mod = target.startsWith("/") ? await import(pathToFileURL(path.join(target, "dist/index.js")).href) : await import(target);
    return mod.PGlite;
  } catch {
    return null;
  }
}

const PGlite = await loadPGlite();
const skip = PGlite ? false : "PGlite not available (set PGLITE_PATH)";

const deps = {
  secrets: parseCredentialSecrets(`k1:${Buffer.alloc(32, 3).toString("base64")}`),
  activeKeyId: "k1",
  timeZone: "America/Toronto",
  dayCutoffHour: 0,
  allowedHosts: ["pass.example.com"]
};
const BASE = "https://pass.example.com";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: deps.timeZone }).format(new Date()); // YYYY-MM-DD

let db;
let scanSeq = 0;
const scanId = () => `scan_${Date.now().toString(36)}_${(scanSeq += 1)}`;
const inTx = (fn) => db.transaction((tx) => fn(tx));

async function migrate() {
  const dir = path.join(repoRoot, "platform/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) await db.exec(await readFile(path.join(dir, file), "utf8"));
  await db.exec(await readFile(path.join(here, "../migration/015_passes.sql"), "utf8"));
}

async function seedPassType(teamId, tenantId, presetId, overrides = {}) {
  const p = { ...TIER_PRESETS[presetId], ...overrides };
  const id = `ptype_${presetId}_${tenantId}`;
  await db.query(
    `insert into pass_types (id, team_id, tenant_id, slug, name, tier, validity_kind, validity_count, max_uses, reentry_cooldown_seconds, is_vip, design, email)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)`,
    [id, teamId, tenantId, presetId, p.name, p.tier, p.validity.kind, p.validity.count ?? 1, p.usage.maxUses, p.usage.reentryCooldownSeconds, p.isVip, JSON.stringify(p.design), JSON.stringify(p.email)]
  );
  return id;
}

const scan = (raw, extra = {}) =>
  inTx((tx) => verifyScan(tx, { scanId: extra.scanId || scanId(), raw, inputKind: "qr", gate: "Main door", verifierId: "user_door", teamId: "team_venue", ...extra }, deps));

const issue = (passTypeId, extra = {}) =>
  inTx((tx) =>
    issuePass(tx, { teamId: "team_venue", tenantId: "tenant_venue", passTypeId, holder: { name: "Jordan Avery", email: "Jordan@Example.com" }, startDate: today, issuedBy: "user_admin", ...extra }, deps)
  );

test("platform migrations 001-014 + draft 015 apply, and 015 is idempotent", { skip }, async () => {
  db = new PGlite();
  await migrate();
  await db.exec(await readFile(path.join(here, "../migration/015_passes.sql"), "utf8"));
  const { rows } = await db.query(`select count(*)::int as n from information_schema.tables where table_name like 'pass%' or table_name = 'user_identities'`);
  assert.equal(rows[0].n, 7);

  await db.exec(`
    insert into teams (id, name, slug) values ('team_venue','Venue','venue'), ('team_other','Other','other');
    insert into users (id, email, name) values ('user_admin','admin@example.com','Admin'), ('user_door','door@example.com','Door'), ('user_rival','rival@example.com','Rival');
    insert into team_memberships (id, team_id, user_id, role) values ('m1','team_venue','user_admin','admin'), ('m2','team_venue','user_door','verifier'), ('m3','team_other','user_rival','verifier');
    insert into tenants (id, slug, config, team_id) values ('tenant_venue','venue','{}','team_venue'), ('tenant_other','other','{}','team_other');
  `);
  await assert.rejects(db.query(`insert into team_memberships (id, team_id, user_id, role) values ('m4','team_venue','user_rival','superuser')`), /check constraint/);
});

test("issue -> scan -> admit -> rescan is refused, and the ledger has both", { skip }, async () => {
  const typeId = await seedPassType("team_venue", "tenant_venue", "day_single");
  const { pass, credential, replay } = await issue(typeId, { issueRequestId: "form_1" });
  assert.equal(replay, false);
  assert.equal(pass.maxUses, 1, "usage snapshotted from the type");
  const url = credentialUrl(BASE, credential);

  const first = await scan(url);
  assert.equal(first.result, "valid");
  assert.equal(first.admit, true);
  assert.equal(first.holderName, "Jordan Avery");
  assert.equal(first.useCount, 1);

  const second = await scan(url);
  assert.equal(second.result, "used");
  assert.equal(second.lastUsedGate, "Main door");

  const ledger = await db.query(`select result, admitted from pass_scans where pass_id = $1 order by created_at`, [pass.id]);
  assert.deepEqual(ledger.rows.map((r) => [r.result, r.admitted]), [["valid", true], ["used", false]]);
  const row = (await db.query(`select use_count, first_used_at from passes where id = $1`, [pass.id])).rows[0];
  assert.equal(row.use_count, 1);
  assert.ok(row.first_used_at);
});

test("a replayed scan id returns the original verdict and admits nobody twice", { skip }, async () => {
  const typeId = await seedPassType("team_venue", "tenant_venue", "day_single", { name: "Replay Test" }).catch(() => "ptype_day_single_tenant_venue");
  const { pass, credential } = await issue(typeId, { holder: { name: "Replay Person", email: "replay@example.com" } });
  const id = scanId();
  const first = await scan(credentialUrl(BASE, credential), { scanId: id });
  const again = await scan(credentialUrl(BASE, credential), { scanId: id });
  assert.equal(first.result, "valid");
  assert.equal(again.result, "valid", "same verdict, not 'used'");
  assert.equal(again.replay, true);
  assert.equal((await db.query(`select use_count from passes where id = $1`, [pass.id])).rows[0].use_count, 1);
  await assert.rejects(scan(credentialUrl(BASE, credential), { scanId: id, teamId: "team_other", verifierId: "user_rival" }), (e) => e instanceof PassError && e.status === 409);
});

test("another team's verifier sees not_found; the ledger records why; nothing changes", { skip }, async () => {
  const { pass, credential } = await issue("ptype_day_single_tenant_venue", { holder: { name: "Private Person", email: "private@example.com" } });
  const res = await scan(credentialUrl(BASE, credential), { teamId: "team_other", verifierId: "user_rival" });
  assert.equal(res.result, "not_found");
  assert.equal(res.holderName, undefined, "no holder data leaks across teams");
  const ledger = (await db.query(`select pass_id, internal_reason, team_id from pass_scans where id = $1`, [res.scanId])).rows[0];
  assert.deepEqual(ledger, { pass_id: null, internal_reason: "foreign_team", team_id: "team_other" });
  assert.equal((await db.query(`select use_count from passes where id = $1`, [pass.id])).rows[0].use_count, 0);
});

test("manual short-code entry resolves only inside the verifier's team", { skip }, async () => {
  const { pass } = await issue("ptype_day_single_tenant_venue", { holder: { name: "Manual Entry", email: "manual@example.com" } });
  const typed = formatShortCode(pass.shortCode).toLowerCase();
  const rival = await scan(typed, { inputKind: "manual", teamId: "team_other", verifierId: "user_rival" });
  assert.equal(rival.result, "not_found");
  const own = await scan(typed, { inputKind: "manual" });
  assert.equal(own.result, "valid");
});

test("issuing is idempotent per request id, and holders dedupe by email", { skip }, async () => {
  const a = await issue("ptype_day_single_tenant_venue", { issueRequestId: "form_dupe", holder: { name: "Dee Dupe", email: "dee@example.com" } });
  const b = await issue("ptype_day_single_tenant_venue", { issueRequestId: "form_dupe", holder: { name: "Dee Dupe", email: "dee@example.com" } });
  assert.equal(b.replay, true);
  assert.equal(b.pass.id, a.pass.id);
  assert.equal(b.credential, a.credential, "the credential is re-derived, not stored");
  const c = await issue("ptype_day_single_tenant_venue", { holder: { name: "Dee Renamed", email: "DEE@example.com" } });
  assert.equal(c.holder.id, a.holder.id);
  assert.equal(c.holder.name, "Dee Renamed");
  assert.equal((await db.query(`select count(*)::int as n from passes where issue_request_id = 'form_dupe'`)).rows[0].n, 1);
});

test("a pass type from another tenant cannot be used to issue", { skip }, async () => {
  const foreignType = await seedPassType("team_other", "tenant_other", "monthly");
  await assert.rejects(issue(foreignType), (e) => e.code === "pass_type_not_found" && e.status === 404);
  await assert.rejects(issue("ptype_day_single_tenant_venue", { holder: { name: "No Contact" } }), (e) => e.code === "holder_contact_required");
  await assert.rejects(issue("ptype_day_single_tenant_venue", { holder: { name: "Bad Phone", phone: "416-555-0100" } }), (e) => e.code === "holder_phone_invalid");
});

test("revoked, expired, re-entry cooldown and junk input", { skip }, async () => {
  const revoked = await issue("ptype_day_single_tenant_venue", { holder: { name: "Rev Oked", email: "rev@example.com" } });
  const done = await inTx((tx) => revokePass(tx, { passId: revoked.pass.id, teamId: "team_venue", revokedBy: "user_admin", reason: "chargeback" }));
  assert.equal(done.status, "revoked");
  assert.equal(await inTx((tx) => revokePass(tx, { passId: revoked.pass.id, teamId: "team_other", revokedBy: "user_rival" })), null, "cross-team revoke is a no-op");
  assert.equal((await scan(credentialUrl(BASE, revoked.credential))).result, "revoked");

  const fixedType = await seedPassType("team_venue", "tenant_venue", "day", { validity: { kind: "fixed" }, name: "Past Event" }).catch(() => null);
  const pastTypeId = fixedType || "ptype_day_tenant_venue";
  const past = await issue(pastTypeId, { holder: { name: "Late Comer", email: "late@example.com" }, validFrom: "2026-01-01T00:00:00Z", validUntil: "2026-01-02T00:00:00Z" });
  assert.equal((await scan(credentialUrl(BASE, past.credential))).result, "expired");

  const reentryType = await seedPassType("team_venue", "tenant_venue", "monthly");
  const member = await issue(reentryType, { holder: { name: "Re Entry", email: "re@example.com" } });
  assert.equal((await scan(credentialUrl(BASE, member.credential))).result, "valid");
  const blocked = await scan(credentialUrl(BASE, member.credential), { gate: "Side door" });
  assert.equal(blocked.result, "recently_used");
  assert.equal(blocked.lastUsedGate, "Main door");
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 300);

  const junk = await scan("WIFI:S:guest;T:WPA;P:secret;;");
  assert.equal(junk.result, "invalid_format");
  const junkRow = (await db.query(`select internal_reason, pass_id from pass_scans where id = $1`, [junk.scanId])).rows[0];
  assert.deepEqual(junkRow, { internal_reason: "insecure_url", pass_id: null });
});

test("the database refuses more uses than a pass allows, even if app code is wrong", { skip }, async () => {
  const { pass } = await issue("ptype_day_single_tenant_venue", { holder: { name: "Over Use", email: "over@example.com" } });
  await assert.rejects(db.query(`update passes set use_count = 2 where id = $1`, [pass.id]), /check constraint/);
});
