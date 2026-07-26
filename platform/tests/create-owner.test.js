import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createOwnerWithClient, readOwnerConfigFromEnv } from "../scripts/create-owner.js";
import { verifyPassword } from "../lib/users.js";

const originalEnv = { ...process.env };

function createFakeOwnerClient() {
  const teams = [];
  const users = [];
  const memberships = [];

  return {
    teams,
    users,
    memberships,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (["begin", "commit", "rollback"].includes(normalized)) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.startsWith("select pg_advisory_xact_lock")) {
        return { rows: [], rowCount: 1 };
      }

      if (normalized.startsWith("with inserted as")) {
        const [id, name, slug] = params;
        let team = teams.find((item) => item.slug === slug);
        let created = false;

        if (!team) {
          const now = new Date().toISOString();
          team = { id, name, slug, created_at: now, updated_at: now };
          teams.push(team);
          created = true;
        }

        return { rows: [{ ...team, created }], rowCount: 1 };
      }

      if (normalized.startsWith("select * from users where email")) {
        return { rows: users.filter((user) => user.email === params[0]).slice(0, 1), rowCount: 1 };
      }

      if (normalized.startsWith("insert into users")) {
        const [id, email, name, passwordHash] = params;
        const now = new Date().toISOString();
        const user = {
          id,
          email,
          name,
          password_hash: passwordHash,
          status: "active",
          created_at: now,
          updated_at: now
        };
        users.push(user);
        return { rows: [user], rowCount: 1 };
      }

      if (normalized.startsWith("insert into team_memberships")) {
        const [, teamId, userId] = params;
        let membership = memberships.find((item) => item.team_id === teamId && item.user_id === userId);

        if (!membership) {
          membership = {
            id: params[0],
            team_id: teamId,
            user_id: userId,
            role: "owner",
            created_at: new Date().toISOString()
          };
          memberships.push(membership);
        } else {
          membership.role = "owner";
        }

        return { rows: [membership], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in fake owner client: ${sql}`);
    }
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
});

test("reads and validates owner config from environment", () => {
  process.env.OWNER_EMAIL = "OWNER@Example.COM";
  process.env.OWNER_NAME = "Owner User";
  process.env.OWNER_PASSWORD = "correct horse battery staple";
  process.env.TEAM_NAME = "DGTL MAG";
  process.env.TEAM_SLUG = "DGTL MAG";

  assert.deepEqual(readOwnerConfigFromEnv(), {
    email: "owner@example.com",
    name: "Owner User",
    password: "correct horse battery staple",
    teamName: "DGTL MAG",
    teamSlug: "dgtl-mag"
  });
});

test("refuses weak owner passwords", () => {
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.OWNER_NAME = "Owner User";
  process.env.OWNER_PASSWORD = "short";
  process.env.TEAM_NAME = "DGTL MAG";
  process.env.TEAM_SLUG = "dgtlmag";

  assert.throws(() => readOwnerConfigFromEnv(), /at least 12 characters/);

  process.env.OWNER_PASSWORD = "admin password for setup";
  assert.throws(() => readOwnerConfigFromEnv(), /too easy to guess/);
});

test("creates first owner with a password hash and is safe to rerun", async () => {
  const client = createFakeOwnerClient();
  const config = {
    email: "owner@example.com",
    name: "Owner User",
    password: "correct horse battery staple",
    teamName: "DGTL MAG",
    teamSlug: "dgtlmag"
  };

  const firstRun = await createOwnerWithClient(client, config);

  assert.equal(firstRun.teamCreated, true);
  assert.equal(firstRun.userCreated, true);
  assert.equal(client.teams.length, 1);
  assert.equal(client.users.length, 1);
  assert.equal(client.memberships.length, 1);
  assert.notEqual(client.users[0].password_hash, config.password);
  assert.equal(await verifyPassword(config.password, client.users[0].password_hash), true);
  assert.equal(firstRun.membership.role, "owner");

  client.memberships[0].role = "viewer";
  const secondRun = await createOwnerWithClient(client, config);

  assert.equal(secondRun.teamCreated, false);
  assert.equal(secondRun.userCreated, false);
  assert.equal(client.teams.length, 1);
  assert.equal(client.users.length, 1);
  assert.equal(client.memberships.length, 1);
  assert.equal(client.memberships[0].role, "owner");
});
