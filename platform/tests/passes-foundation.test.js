// DGTL Pass Phase 1 foundation: migration 015 on top of every platform
// migration, password-less Google staff accounts, and the identity rules that
// make Google sign-in invite-only. Real SQL via PGlite (tests/support).

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations, migratedPglite, migrationFiles } from "./support/migrated-pglite.js";
import { __setUsersDbForTests, createUser, USER_ROLES } from "../lib/users.js";
import { __setAuthDbForTests, createAdminSession, createSessionForUser, getAdminSessionForToken } from "../lib/auth.js";
import { __setIdentitiesDbForTests, resolveGoogleUser } from "../lib/oauth/identities.js";

const db = await migratedPglite();
__setUsersDbForTests(db);
__setAuthDbForTests(db);
__setIdentitiesDbForTests(db);
after(() => {
  __setUsersDbForTests(null);
  __setAuthDbForTests(null);
  __setIdentitiesDbForTests(null);
});

await db.exec(`
  insert into teams (id, name, slug) values ('team_venue', 'Venue', 'venue') on conflict do nothing;
`);

test("migration 015 is the last file and every migration re-runs cleanly on top of itself", async () => {
  const files = await migrationFiles();
  assert.equal(files.at(-1), "015_passes.sql");
  await applyMigrations(db); // second pass over 001-015: each must be idempotent
  const { rows } = await db.query(
    `select table_name from information_schema.tables
      where table_name in ('pass_types','pass_holders','passes','pass_deliveries','pass_scans','pass_wallet_registrations','user_identities')
      order by table_name`
  );
  assert.equal(rows.length, 7);
});

test("the platform migration matches the spec's draft byte for byte, apart from its header", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const body = (text) => text.slice(text.indexOf("-- Stored pass status"));
  const live = await readFile(path.join(root, "platform/migrations/015_passes.sql"), "utf8");
  const draft = await readFile(path.join(root, "docs/specs/dgtl-pass/migration/015_passes.sql"), "utf8");
  assert.equal(body(live), body(draft));
});

test("the role constraint admits issuer and verifier, and nothing invented", async () => {
  assert.ok(USER_ROLES.includes("issuer") && USER_ROLES.includes("verifier"));
  const staff = await createUser({ email: "door@venue.test", name: "Door", password: "correct horse battery", teamId: "team_venue", role: "verifier" });
  assert.equal(staff.role, "verifier");
  await assert.rejects(
    db.query(`insert into team_memberships (id, team_id, user_id, role) values ('m_bad', 'team_venue', $1, 'superuser')`, [staff.id]),
    /check constraint/
  );
});

test("a Google-only staff account is created without a password and can never use one", async () => {
  const user = await createUser({ email: "issuer@venue.test", name: "Issuer", teamId: "team_venue", role: "issuer", authMethod: "google" });
  const { rows } = await db.query(`select password_hash from users where id = $1`, [user.id]);
  assert.equal(rows[0].password_hash, null);
  for (const attempt of ["", "anything at all", "null"]) {
    assert.equal(await createAdminSession("issuer@venue.test", attempt), null, `password "${attempt}" must not work`);
  }
  await assert.rejects(createUser({ email: "x@venue.test", teamId: "team_venue", role: "viewer" }), /password/i, "password accounts still need one");
  await assert.rejects(createUser({ email: "y@venue.test", teamId: "team_venue", role: "viewer", authMethod: "magic" }), /Sign-in method/);
});

test("Google sign-in is invite-only: an unknown email gets nothing", async () => {
  assert.equal(await resolveGoogleUser({ sub: "g-stranger", email: "stranger@example.com" }), null);
  const { rows } = await db.query(`select count(*)::int as n from user_identities`);
  assert.equal(rows[0].n, 0, "no identity row for a refused sign-in");
});

test("an invited email links on first sign-in, then matches by sub even if the email changes", async () => {
  const first = await resolveGoogleUser({ sub: "g-issuer-1", email: "issuer@venue.test" });
  assert.equal(first.linkedNow, true);
  assert.equal(first.user.email, "issuer@venue.test");
  const again = await resolveGoogleUser({ sub: "g-issuer-1", email: "renamed@gmail.example" });
  assert.equal(again.linkedNow, false);
  assert.equal(again.user.id, first.user.id, "matched by sub, not by the new email");
});

test("a second Google account cannot claim an already-linked user, and email reuse cannot hijack a link", async () => {
  assert.equal(await resolveGoogleUser({ sub: "g-attacker", email: "issuer@venue.test" }), null, "user already linked to another sub");
});

test("disabled users and users without a team are refused, linked or not", async () => {
  await createUser({ email: "gone@venue.test", teamId: "team_venue", role: "verifier", authMethod: "google" });
  const linked = await resolveGoogleUser({ sub: "g-gone", email: "gone@venue.test" });
  assert.ok(linked);
  await db.query(`update users set status = 'disabled' where email = 'gone@venue.test'`);
  assert.equal(await resolveGoogleUser({ sub: "g-gone", email: "gone@venue.test" }), null, "linked but disabled");

  await db.query(`insert into users (id, email, name) values ('user_orphan', 'orphan@venue.test', 'Orphan')`);
  assert.equal(await resolveGoogleUser({ sub: "g-orphan", email: "orphan@venue.test" }), null, "no team membership");
});

test("a Google session carries the membership role, so pass-only staff are recognisable", async () => {
  const { user } = await resolveGoogleUser({ sub: "g-issuer-1", email: "issuer@venue.test" });
  const created = await createSessionForUser(user);
  const session = await getAdminSessionForToken(created.token);
  assert.equal(session.role, "issuer");
  assert.equal(session.teamId, "team_venue");
});
