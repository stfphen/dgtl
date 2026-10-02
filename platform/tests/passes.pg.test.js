// T-C1..T-C3 (docs/specs/dgtl-pass/14-test-plan.md): the races that only real
// Postgres can show, because each call needs its own connection and the row
// lock is what serialises them. PGlite has one connection, so these run only
// when PASSES_PG_TEST_URL points at a Postgres the test may create databases on:
//
//   PASSES_PG_TEST_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres node --test tests/passes.pg.test.js
//
// The release gate sets it against its Postgres 16 service. The test creates a
// throwaway database, runs every migration, and drops it afterwards.

import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrationFiles } from "./support/migrated-pglite.js";

const adminUrl = process.env.PASSES_PG_TEST_URL;
const skip = adminUrl ? false : "set PASSES_PG_TEST_URL to run the real-Postgres race tests";
const dbName = `passes_race_${process.pid}_${Date.now()}`;
let store;
let deps;
let scanDeps;
let typeId;
let links;

before(async () => {
  if (skip) return;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  process.env.DATABASE_URL = url.toString();

  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const file of await migrationFiles()) await client.query(await readFile(path.join(migrationsDir, file), "utf8"));
  await client.query(`
    insert into teams (id, name, slug) values ('team_race', 'Race Venue', 'race-venue');
    insert into tenants (id, team_id, slug, config) values ('tenant_race', 'team_race', 'tenant-race', '{}'::jsonb);
    insert into users (id, email, name) values ('user_door', 'door@race.test', 'Door');
  `);
  await client.end();

  store = await import("../lib/passes/store.js");
  const { parseCredentialSecrets } = await import("../lib/passes/credentials.js");
  const secrets = parseCredentialSecrets(`k1:${Buffer.alloc(32, 3).toString("base64")}`);
  deps = { secrets, activeKeyId: "k1", timeZone: "America/Toronto", dayCutoffHour: 0 };
  scanDeps = { allowedHosts: ["pass.race.test"], timeZone: "America/Toronto", dayCutoffHour: 0 };
  links = (pass) => store.passLinks(pass, { secrets, baseUrl: "https://pass.race.test" });
  await store.installPresetPassTypes({ teamId: "team_race", tenantId: "tenant_race" });
  typeId = (await store.listPassTypes({ teamId: "team_race", tenantId: "tenant_race" })).find((t) => t.slug === "day-single").id;
});

after(async () => {
  if (skip) return;
  // Close the store's pool before dropping its database.
  await store?.closePassesPool();
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.end();
});

const scanId = () => `scan_${crypto.randomUUID().replace(/-/g, "")}`;
const issue = (holder, issueRequestId) =>
  store.withUniqueRetry(() =>
    store.withTransaction((tx) => store.issuePass(tx, { teamId: "team_race", tenantId: "tenant_race", passTypeId: typeId, holder, validFrom: undefined, startDate: new Date().toISOString().slice(0, 10), issueRequestId }, deps))
  );
const verify = (raw, id = scanId()) =>
  store.withUniqueRetry(() => store.withTransaction((tx) => store.verifyScan(tx, { scanId: id, raw, verifierId: "user_door", teamId: "team_race", inputKind: "qr" }, scanDeps)));

test("T-C1: 20 scanners on one single-use pass at the same instant admit exactly once", { skip }, async () => {
  const { pass } = await issue({ name: "Race One", email: "one@race.test" });
  const url = links(pass).passPageUrl;
  const results = await Promise.all(Array.from({ length: 20 }, () => verify(url)));
  assert.equal(results.filter((r) => r.admit).length, 1);
  assert.equal(results.filter((r) => r.result === "used").length, 19);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const row = (await client.query(`select use_count from passes where id = $1`, [pass.id])).rows[0];
  const ledger = (await client.query(`select count(*)::int as n from pass_scans where pass_id = $1`, [pass.id])).rows[0];
  await client.end();
  assert.equal(row.use_count, 1);
  assert.equal(ledger.n, 20);
});

test("T-C2: 10 submits of the same scan id record one scan and return one verdict", { skip }, async () => {
  const { pass } = await issue({ name: "Race Two", email: "two@race.test" });
  const id = scanId();
  const results = await Promise.all(Array.from({ length: 10 }, () => verify(links(pass).passPageUrl, id)));
  assert.equal(new Set(results.map((r) => r.result)).size, 1);
  assert.equal(results[0].result, "valid");
  assert.equal(results.filter((r) => !r.replay).length, 1, "one original, nine replays");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const ledger = (await client.query(`select count(*)::int as n from pass_scans where id = $1`, [id])).rows[0];
  await client.end();
  assert.equal(ledger.n, 1);
});

test("T-C3: 10 simultaneous issues with one request id create one pass", { skip }, async () => {
  const requestId = `issue_${crypto.randomUUID().replace(/-/g, "")}`;
  const results = await Promise.all(Array.from({ length: 10 }, () => issue({ name: "Race Three", email: "three@race.test" }, requestId)));
  assert.equal(new Set(results.map((r) => r.pass.id)).size, 1);
  assert.equal(new Set(results.map((r) => r.credential)).size, 1);
});
