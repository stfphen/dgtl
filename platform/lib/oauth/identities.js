// Linked sign-in identities (user_identities, migration 015) and the
// invite-only resolution rule for Google sign-in.

import crypto from "node:crypto";
import { Pool } from "pg";

let pgPool;
let testDb;

function requireDatabase() {
  if (testDb) return testDb;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for sign-in identities.");
  if (!pgPool) pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pgPool;
}

function mapUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name || "", status: row.status };
}

/**
 * Who is this Google account, if anyone we invited?
 *   1. already linked by (google, sub)            -> that user
 *   2. else an active user with this verified email
 *      and at least one team membership           -> link it, then that user
 *   3. else                                        -> null (no self-signup)
 * Inactive users and users without a membership are refused in both paths.
 */
export async function resolveGoogleUser({ sub, email }) {
  const db = requireDatabase();
  const linked = await db.query(
    `select users.* from user_identities
       join users on users.id = user_identities.user_id
      where user_identities.provider = 'google' and user_identities.subject = $1
        and users.status = 'active'
        and exists (select 1 from team_memberships m where m.user_id = users.id)
      limit 1`,
    [sub]
  );
  if (linked.rows[0]) {
    await db.query(
      `update user_identities set last_login_at = now(), email = $2 where provider = 'google' and subject = $1`,
      [sub, email]
    );
    return { user: mapUser(linked.rows[0]), linkedNow: false };
  }

  // A sub already linked to a user that's inactive or has no team stays refused;
  // it must not fall through to email matching and link a second account.
  const anyLink = await db.query(`select 1 from user_identities where provider = 'google' and subject = $1`, [sub]);
  if (anyLink.rows[0]) return null;

  const invited = await db.query(
    `select users.* from users
      where lower(users.email) = $1 and users.status = 'active'
        and exists (select 1 from team_memberships m where m.user_id = users.id)
        and not exists (select 1 from user_identities i where i.user_id = users.id and i.provider = 'google')
      limit 1`,
    [email]
  );
  if (!invited.rows[0]) return null;

  await db.query(
    `insert into user_identities (id, user_id, provider, subject, email, last_login_at)
     values ($1, $2, 'google', $3, $4, now())
     on conflict (provider, subject) do nothing`,
    [`identity_${crypto.randomUUID()}`, invited.rows[0].id, sub, email]
  );
  return { user: mapUser(invited.rows[0]), linkedNow: true };
}

export function __setIdentitiesDbForTests(db) {
  testDb = db;
}
