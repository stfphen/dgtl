import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

export const USER_ROLES = ["owner", "admin", "sales", "contractor", "viewer"];
export const USER_STATUSES = ["active", "disabled"];

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

let pgPool;
let testDb;

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireDatabase() {
  if (testDb) return testDb;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for user management.");
  }

  if (!pgPool) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pgPool;
}

function assertEmail(email) {
  if (!email) {
    throw new Error("Email is required.");
  }
}

function assertPassword(password) {
  if (String(password || "").length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function assertRole(role) {
  if (!USER_ROLES.includes(role)) {
    throw new Error(`Role must be one of: ${USER_ROLES.join(", ")}.`);
  }
}

function assertStatus(status) {
  if (!USER_STATUSES.includes(status)) {
    throw new Error(`Status must be one of: ${USER_STATUSES.join(", ")}.`);
  }
}

function assertTeamId(teamId) {
  if (!teamId) {
    throw new Error("Team ID is required.");
  }
}

function mapUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTeamUserRow(row) {
  if (!row) return null;
  const { passwordHash, ...user } = mapUserRow(row);

  return {
    ...user,
    membershipId: row.membership_id,
    teamId: row.team_id,
    role: row.role,
    membershipCreatedAt: row.membership_created_at,
    // Telephony rep settings (optional; null when DB columns are unset).
    telephonyRole: row.telephony_role || "",
    phoneNumber: row.phone_number || "",
    providerUserId: row.provider_user_id || "",
    availabilityStatus: row.availability_status || "offline",
    canReceiveInbound: Boolean(row.can_receive_inbound),
    canMakeOutbound: Boolean(row.can_make_outbound)
  };
}

function normalizeDatabaseError(error) {
  if (error?.code === "23505" && String(error.constraint || "").includes("users_email")) {
    throw new Error("A user with this email already exists.");
  }

  throw error;
}

async function withTransaction(callback) {
  const db = requireDatabase();
  const client = typeof db.connect === "function" ? await db.connect() : db;
  const shouldRelease = client !== db && typeof client.release === "function";

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original error when rollback also fails.
    }
    normalizeDatabaseError(error);
  } finally {
    if (shouldRelease) client.release();
  }
}

export async function hashPassword(password) {
  assertPassword(password);
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createUser({ email, name = "", password, teamId, role }) {
  const normalizedEmail = normalizeEmail(email);
  assertEmail(normalizedEmail);
  assertPassword(password);
  assertTeamId(teamId);
  assertRole(role);

  const userId = id("user");
  const membershipId = id("membership");
  const passwordHash = await hashPassword(password);

  return withTransaction(async (client) => {
    const userResult = await client.query(
      `insert into users (id, email, name, password_hash, updated_at)
       values ($1, $2, $3, $4, now())
       returning *`,
      [userId, normalizedEmail, name || null, passwordHash]
    );

    await client.query(
      `insert into team_memberships (id, team_id, user_id, role)
       values ($1, $2, $3, $4)`,
      [membershipId, teamId, userId, role]
    );

    return {
      ...mapUserRow(userResult.rows[0]),
      teamId,
      role
    };
  });
}

export async function ensureUserMembership({ userId, teamId, role }) {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  assertTeamId(teamId);
  assertRole(role);

  const db = requireDatabase();
  const result = await db.query(
    `insert into team_memberships (id, team_id, user_id, role)
     values ($1, $2, $3, $4)
     on conflict (team_id, user_id) do update set role = excluded.role
     returning id, team_id, user_id, role, created_at`,
    [id("membership"), teamId, userId, role]
  );

  return result.rows[0] || null;
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  assertEmail(normalizedEmail);

  const db = requireDatabase();
  const result = await db.query("select * from users where email = $1 limit 1", [normalizedEmail]);
  return mapUserRow(result.rows[0]);
}

export async function findUserById(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const db = requireDatabase();
  const result = await db.query("select * from users where id = $1 limit 1", [userId]);
  return mapUserRow(result.rows[0]);
}

export async function listTeamUsers(teamId) {
  assertTeamId(teamId);

  const db = requireDatabase();
  const result = await db.query(
    `select
       users.*,
       team_memberships.id as membership_id,
       team_memberships.team_id,
       team_memberships.role,
       team_memberships.created_at as membership_created_at,
       team_memberships.telephony_role,
       team_memberships.phone_number,
       team_memberships.provider_user_id,
       team_memberships.availability_status,
       team_memberships.can_receive_inbound,
       team_memberships.can_make_outbound
     from team_memberships
     join users on users.id = team_memberships.user_id
     where team_memberships.team_id = $1
     order by users.created_at desc`,
    [teamId]
  );

  return result.rows.map(mapTeamUserRow);
}

export async function updateUserStatus(userId, status, teamId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  assertStatus(status);
  assertTeamId(teamId);

  const db = requireDatabase();
  // Scope the status change to the acting team: only flip a user who is a member
  // of teamId, so one team's admin cannot disable/enable another team's user.
  const result = await db.query(
    `update users
     set status = $2, updated_at = now()
     where id = $1
       and exists (
         select 1 from team_memberships
         where team_memberships.user_id = users.id
           and team_memberships.team_id = $3
       )
     returning *`,
    [userId, status, teamId]
  );

  if (!result.rows[0]) {
    throw new Error("User is not a member of this team.");
  }

  return mapUserRow(result.rows[0]);
}

export async function updateUserRole(userId, teamId, role) {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  assertTeamId(teamId);
  assertRole(role);

  const db = requireDatabase();
  const result = await db.query(
    `update team_memberships
     set role = $3
     where user_id = $1 and team_id = $2
     returning id, team_id, user_id, role, created_at`,
    [userId, teamId, role]
  );

  return result.rows[0] || null;
}

export function __setUsersDbForTests(db) {
  testDb = db;
}
