import crypto from "node:crypto";
import { Pool } from "pg";
import { findUserByEmail, verifyPassword } from "./users.js";

export const ADMIN_COOKIE_NAME = "content_funnel_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

// A valid cost-12 bcrypt hash used only to equalize login timing: on the
// user-miss / inactive path we still run one bcrypt.compare so an attacker can't
// distinguish "no such account" from "wrong password" by response latency.
const DUMMY_PASSWORD_HASH = "$2b$12$m3hF4F3RxLitKRr73Rct7ekTi7T0kB1g/vtN.6iZ0LWpof9pOCq4.";

let pgPool;
let testDb;

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requireDatabase() {
  if (testDb) return testDb;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database-backed sessions.");
  }

  if (!pgPool) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pgPool;
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function mapSessionRow(row) {
  if (!row) return null;

  return {
    id: row.session_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    userId: row.user_id,
    email: row.email,
    teamId: row.team_id || null,
    role: row.role || null,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      status: row.status
    },
    team: row.team_id
      ? {
          id: row.team_id,
          name: row.team_name,
          slug: row.team_slug
        }
      : null
  };
}

export async function createAdminSession(email, password) {
  try {
    const user = await findUserByEmail(email);
    if (!user || user.status !== "active") {
      await verifyPassword(password, DUMMY_PASSWORD_HASH); // equalize timing
      return null;
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) return null;

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const db = requireDatabase();

    await db.query(
      `insert into sessions (id, user_id, token_hash, expires_at)
       values ($1, $2, $3, $4)`,
      [id("session"), user.id, tokenHash, expiresAt]
    );

    return { token, expiresAt, user };
  } catch {
    return null;
  }
}

export async function getAdminSessionForToken(token) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  try {
    const db = requireDatabase();
    const result = await db.query(
      `select
         sessions.id as session_id,
         sessions.token_hash,
         sessions.expires_at,
         users.id as user_id,
         users.email,
         users.name,
         users.status,
         team_memberships.team_id,
         team_memberships.role,
         teams.name as team_name,
         teams.slug as team_slug
       from sessions
       join users on users.id = sessions.user_id
       left join team_memberships on team_memberships.user_id = users.id
       left join teams on teams.id = team_memberships.team_id
       where sessions.token_hash = $1
       order by team_memberships.created_at asc nulls last
       limit 1`,
      [tokenHash]
    );

    const session = mapSessionRow(result.rows[0]);
    if (!session) return null;

    if (session.user.status !== "active" || new Date(session.expiresAt).getTime() <= Date.now()) {
      await deleteAdminSession(token);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return getAdminSessionForToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function deleteAdminSession(token) {
  if (!token) return;

  try {
    const db = requireDatabase();
    await db.query("delete from sessions where token_hash = $1", [hashSessionToken(token)]);
  } catch {
    // Logout should still clear the browser cookie if the database is unavailable.
  }
}

export function adminCookie(token) {
  return {
    name: ADMIN_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000
    }
  };
}

export function clearAdminCookie() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    }
  };
}

export async function validateAdminCredentials(email, password) {
  try {
    const user = await findUserByEmail(email);
    if (!user || user.status !== "active") {
      await verifyPassword(password, DUMMY_PASSWORD_HASH); // equalize timing
      return false;
    }
    return verifyPassword(password, user.passwordHash);
  } catch {
    return false;
  }
}

export function __setAuthDbForTests(db) {
  testDb = db;
}
