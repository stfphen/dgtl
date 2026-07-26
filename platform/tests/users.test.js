import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __setUsersDbForTests,
  createUser,
  findUserByEmail,
  findUserById,
  hashPassword,
  listTeamUsers,
  updateUserRole,
  updateUserStatus,
  verifyPassword
} from "../lib/users.js";

function createFakeUsersDb() {
  const users = [];
  const memberships = [];
  const calls = [];

  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (["begin", "commit", "rollback"].includes(normalized)) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.startsWith("insert into users")) {
        const [id, email, name, passwordHash] = params;
        if (users.some((user) => user.email === email)) {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          error.constraint = "users_email_key";
          throw error;
        }

        const now = new Date().toISOString();
        const row = {
          id,
          email,
          name,
          password_hash: passwordHash,
          status: "active",
          created_at: now,
          updated_at: now
        };
        users.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (normalized.startsWith("insert into team_memberships")) {
        const [id, teamId, userId, role] = params;
        const row = {
          id,
          team_id: teamId,
          user_id: userId,
          role,
          created_at: new Date().toISOString()
        };
        memberships.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (normalized.startsWith("select * from users where email")) {
        return { rows: users.filter((user) => user.email === params[0]).slice(0, 1), rowCount: 1 };
      }

      if (normalized.startsWith("select * from users where id")) {
        return { rows: users.filter((user) => user.id === params[0]).slice(0, 1), rowCount: 1 };
      }

      if (normalized.includes("from team_memberships") && normalized.includes("join users")) {
        const teamId = params[0];
        const rows = memberships
          .filter((membership) => membership.team_id === teamId)
          .map((membership) => {
            const user = users.find((item) => item.id === membership.user_id);
            return {
              ...user,
              membership_id: membership.id,
              team_id: membership.team_id,
              role: membership.role,
              membership_created_at: membership.created_at
            };
          });
        return { rows, rowCount: rows.length };
      }

      if (normalized.startsWith("update users")) {
        const [userId, status, teamId] = params;
        const user = users.find((item) => item.id === userId);
        if (!user) return { rows: [], rowCount: 0 };
        // Mirror the `exists (... team_memberships ...)` guard in updateUserStatus.
        if (normalized.includes("team_memberships")) {
          const isMember = memberships.some(
            (item) => item.user_id === userId && item.team_id === teamId
          );
          if (!isMember) return { rows: [], rowCount: 0 };
        }
        user.status = status;
        user.updated_at = new Date().toISOString();
        return { rows: [user], rowCount: 1 };
      }

      if (normalized.startsWith("update team_memberships")) {
        const [userId, teamId, role] = params;
        const membership = memberships.find((item) => item.user_id === userId && item.team_id === teamId);
        if (!membership) return { rows: [], rowCount: 0 };
        membership.role = role;
        return { rows: [membership], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in fake users DB: ${sql}`);
    },
    release() {}
  };

  return {
    calls,
    users,
    memberships,
    async connect() {
      return client;
    },
    query: client.query.bind(client)
  };
}

afterEach(() => {
  __setUsersDbForTests(null);
});

test("hashes and verifies passwords without preserving plaintext", async () => {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("creates and reads a team user with a password hash", async () => {
  const db = createFakeUsersDb();
  __setUsersDbForTests(db);

  const user = await createUser({
    email: "Owner@Example.COM",
    name: "Owner User",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "admin"
  });

  assert.equal(user.email, "owner@example.com");
  assert.equal(user.name, "Owner User");
  assert.equal(user.role, "admin");
  assert.equal(user.teamId, "team_dgtlmag");
  assert.notEqual(user.passwordHash, "correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", user.passwordHash), true);

  const byEmail = await findUserByEmail("OWNER@example.com");
  assert.equal(byEmail.id, user.id);

  const byId = await findUserById(user.id);
  assert.equal(byId.email, "owner@example.com");

  const teamUsers = await listTeamUsers("team_dgtlmag");
  assert.equal(teamUsers.length, 1);
  assert.equal(teamUsers[0].role, "admin");
  assert.equal(teamUsers[0].passwordHash, undefined);

  const disabled = await updateUserStatus(user.id, "disabled", "team_dgtlmag");
  assert.equal(disabled.status, "disabled");

  const membership = await updateUserRole(user.id, "team_dgtlmag", "viewer");
  assert.equal(membership.role, "viewer");
});

test("rejects duplicate emails clearly", async () => {
  const db = createFakeUsersDb();
  __setUsersDbForTests(db);

  await createUser({
    email: "sales@example.com",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "sales"
  });

  await assert.rejects(
    () =>
      createUser({
        email: "SALES@example.com",
        password: "another correct horse battery",
        teamId: "team_dgtlmag",
        role: "sales"
      }),
    /already exists/
  );
});

test("validates required email password role and team", async () => {
  const db = createFakeUsersDb();
  __setUsersDbForTests(db);

  await assert.rejects(
    () =>
      createUser({
        email: "",
        password: "correct horse battery staple",
        teamId: "team_dgtlmag",
        role: "admin"
      }),
    /Email is required/
  );

  await assert.rejects(
    () =>
      createUser({
        email: "viewer@example.com",
        password: "short",
        teamId: "team_dgtlmag",
        role: "viewer"
      }),
    /at least 12 characters/
  );

  await assert.rejects(
    () =>
      createUser({
        email: "viewer@example.com",
        password: "correct horse battery staple",
        teamId: "team_dgtlmag",
        role: "manager"
      }),
    /Role must be one of/
  );

  await assert.rejects(
    () =>
      createUser({
        email: "viewer@example.com",
        password: "correct horse battery staple",
        teamId: "",
        role: "viewer"
      }),
    /Team ID is required/
  );
});

test("updateUserStatus refuses to change a user outside the acting team", async () => {
  const db = createFakeUsersDb();
  __setUsersDbForTests(db);

  const victim = await createUser({
    email: "victim@teamb.com",
    password: "correct horse battery staple",
    teamId: "team_b",
    role: "sales"
  });

  // An admin acting for team_a must not be able to disable a team_b user.
  await assert.rejects(
    () => updateUserStatus(victim.id, "disabled", "team_a"),
    /not a member of this team/
  );

  const stillActive = await findUserById(victim.id);
  assert.equal(stillActive.status, "active", "victim remains active after the blocked cross-team call");

  // The user's own team can change status.
  const disabled = await updateUserStatus(victim.id, "disabled", "team_b");
  assert.equal(disabled.status, "disabled");
});
