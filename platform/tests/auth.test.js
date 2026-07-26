import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __setAuthDbForTests,
  createAdminSession,
  deleteAdminSession,
  getAdminSessionForToken,
  hashSessionToken
} from "../lib/auth.js";
import {
  canManageContractors,
  canManageLeads,
  canManageTenants,
  canManageUsers,
  canViewDashboard
} from "../lib/permissions.js";
import { __setUsersDbForTests, createUser, updateUserStatus } from "../lib/users.js";

function createFakeAuthDb() {
  const users = [];
  const memberships = [];
  const sessions = [];
  const teams = [{ id: "team_dgtlmag", name: "DGTL MAG", slug: "dgtlmag" }];

  const db = {
    users,
    memberships,
    sessions,
    async connect() {
      return {
        query: db.query,
        release() {}
      };
    },
    async query(sql, params = []) {
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

      if (normalized.startsWith("update users")) {
        const [userId, status, teamId] = params;
        const user = users.find((item) => item.id === userId);
        if (!user) return { rows: [], rowCount: 0 };
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

      if (normalized.startsWith("insert into sessions")) {
        const [id, userId, tokenHash, expiresAt] = params;
        const row = {
          id,
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        };
        sessions.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (normalized.startsWith("select sessions.id as session_id")) {
        const session = sessions.find((item) => item.token_hash === params[0]);
        if (!session) return { rows: [], rowCount: 0 };

        const user = users.find((item) => item.id === session.user_id);
        const membership = memberships.find((item) => item.user_id === user.id);
        const team = teams.find((item) => item.id === membership?.team_id);
        return {
          rows: [
            {
              session_id: session.id,
              token_hash: session.token_hash,
              expires_at: session.expires_at,
              user_id: user.id,
              email: user.email,
              name: user.name,
              status: user.status,
              team_id: membership?.team_id || null,
              role: membership?.role || null,
              team_name: team?.name || null,
              team_slug: team?.slug || null
            }
          ],
          rowCount: 1
        };
      }

      if (normalized.startsWith("delete from sessions")) {
        const index = sessions.findIndex((item) => item.token_hash === params[0]);
        if (index >= 0) sessions.splice(index, 1);
        return { rows: [], rowCount: index >= 0 ? 1 : 0 };
      }

      throw new Error(`Unhandled SQL in fake auth DB: ${sql}`);
    }
  };

  return db;
}

afterEach(() => {
  __setUsersDbForTests(null);
  __setAuthDbForTests(null);
});

test("database login creates an opaque stored session and returns team context", async () => {
  const db = createFakeAuthDb();
  __setUsersDbForTests(db);
  __setAuthDbForTests(db);

  const user = await createUser({
    email: "Owner@Example.COM",
    name: "Owner User",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "owner"
  });

  const login = await createAdminSession("owner@example.com", "correct horse battery staple");

  assert.ok(login.token);
  assert.notEqual(db.sessions[0].token_hash, login.token);
  assert.equal(db.sessions[0].token_hash, hashSessionToken(login.token));
  assert.equal(db.sessions[0].user_id, user.id);

  const session = await getAdminSessionForToken(login.token);
  assert.equal(session.user.id, user.id);
  assert.equal(session.email, "owner@example.com");
  assert.equal(session.role, "owner");
  assert.deepEqual(session.team, {
    id: "team_dgtlmag",
    name: "DGTL MAG",
    slug: "dgtlmag"
  });
});

test("database login rejects invalid passwords and inactive users", async () => {
  const db = createFakeAuthDb();
  __setUsersDbForTests(db);
  __setAuthDbForTests(db);

  const user = await createUser({
    email: "admin@example.com",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "admin"
  });

  assert.equal(await createAdminSession("admin@example.com", "wrong password"), null);
  assert.equal(db.sessions.length, 0);

  await updateUserStatus(user.id, "disabled", "team_dgtlmag");
  assert.equal(await createAdminSession("admin@example.com", "correct horse battery staple"), null);
  assert.equal(db.sessions.length, 0);
});

test("logout invalidates the database session", async () => {
  const db = createFakeAuthDb();
  __setUsersDbForTests(db);
  __setAuthDbForTests(db);

  await createUser({
    email: "sales@example.com",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "sales"
  });

  const login = await createAdminSession("sales@example.com", "correct horse battery staple");
  assert.equal(db.sessions.length, 1);

  await deleteAdminSession(login.token);

  assert.equal(db.sessions.length, 0);
  assert.equal(await getAdminSessionForToken(login.token), null);
});

test("expired sessions are rejected and deleted", async () => {
  const db = createFakeAuthDb();
  __setUsersDbForTests(db);
  __setAuthDbForTests(db);

  await createUser({
    email: "viewer@example.com",
    password: "correct horse battery staple",
    teamId: "team_dgtlmag",
    role: "viewer"
  });

  const login = await createAdminSession("viewer@example.com", "correct horse battery staple");
  db.sessions[0].expires_at = new Date(Date.now() - 1000);

  assert.equal(await getAdminSessionForToken(login.token), null);
  assert.equal(db.sessions.length, 0);
});

test("only owner and admin sessions can manage team credentials", () => {
  assert.equal(canManageUsers({ role: "owner" }), true);
  assert.equal(canManageUsers({ role: "admin" }), true);
  assert.equal(canManageUsers({ role: "sales" }), false);
  assert.equal(canManageUsers({ role: "contractor" }), false);
  assert.equal(canManageUsers({ role: "viewer" }), false);
  assert.equal(canManageUsers(null), false);
});

test("role permissions match the admin dashboard policy", () => {
  const roles = ["owner", "admin", "sales", "contractor", "viewer"];
  const sessions = Object.fromEntries(roles.map((role) => [role, { role }]));

  assert.equal(canManageTenants(sessions.owner), true);
  assert.equal(canManageTenants(sessions.admin), true);
  assert.equal(canManageTenants(sessions.sales), false);

  assert.equal(canManageLeads(sessions.owner), true);
  assert.equal(canManageLeads(sessions.admin), true);
  assert.equal(canManageLeads(sessions.sales), true);
  assert.equal(canManageLeads(sessions.contractor), false);
  assert.equal(canManageLeads(sessions.viewer), false);

  assert.equal(canManageContractors(sessions.owner), true);
  assert.equal(canManageContractors(sessions.admin), true);
  assert.equal(canManageContractors(sessions.sales), false);
  assert.equal(canManageContractors(sessions.contractor), false);

  for (const role of roles) {
    assert.equal(canViewDashboard(sessions[role]), true);
  }
  assert.equal(canViewDashboard(null), false);
});
