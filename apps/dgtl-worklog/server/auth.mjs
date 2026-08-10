/**
 * DGTL Worklog — passwords and sessions.
 *
 * Passwords: scrypt from node:crypto with a per-user salt, stored as
 * `scrypt$N$r$p$salt$hash`, so the cost parameters travel with the hash and
 * can be raised later without invalidating existing logins.
 *
 * Sessions: a 32-byte random token in an HttpOnly cookie. Only its SHA-256
 * lives in the database, so a database leak does not hand over live sessions.
 */

import crypto from 'node:crypto';
import { all, one, run } from './db.mjs';
import { SESSION_DAYS } from './config.mjs';
import { nowISO } from './config.mjs';
import { HttpError, parseCookies, setCookie } from './http.mjs';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const COOKIE = 'dgtl_worklog';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  let actual;
  try {
    actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(res, userId, userAgent = '') {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  run(
    `INSERT INTO sessions (token_hash, user_id, user_agent, created_at, last_seen, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sha256(token), userId, userAgent.slice(0, 255), now.toISOString(), now.toISOString(), expires.toISOString(),
  );
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400 });
  return token;
}

export function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  setCookie(res, COOKIE, '', { expire: true });
}

/** Resolve the signed-in user, or null. Also sweeps expired sessions. */
export function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;

  const hash = sha256(token);
  const row = one(
    `SELECT u.id, u.email, u.name, u.role, u.daily_target_minutes, u.week_start, u.active,
            s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hash,
  );
  if (!row) return null;

  if (new Date(row.expires_at) < new Date() || !row.active) {
    run('DELETE FROM sessions WHERE token_hash = ?', hash);
    return null;
  }

  // Cheap touch — keeps "last seen" useful without a write on every request.
  const today = nowISO().slice(0, 10);
  run('UPDATE sessions SET last_seen = ? WHERE token_hash = ? AND last_seen < ?', nowISO(), hash, today);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    dailyTargetMinutes: row.daily_target_minutes,
    weekStart: row.week_start,
  };
}

export function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

export function requireAdmin(req) {
  const user = requireUser(req);
  if (user.role !== 'admin') throw new HttpError(403, 'Admins only');
  return user;
}

// --- login throttle ----------------------------------------------------
// Fixed 15-minute window per ip+email. Deliberately coarse: it exists to make
// online guessing pointless, not to be a precise rate limiter.
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

export function throttleLogin(ip, email) {
  const bucket = `${ip}|${String(email).toLowerCase()}`;
  const now = Date.now();
  const row = one('SELECT window_start, hits FROM login_attempts WHERE bucket = ?', bucket);

  if (!row || now - row.window_start > WINDOW_MS) {
    run(
      `INSERT INTO login_attempts (bucket, window_start, hits) VALUES (?, ?, 1)
       ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, hits = 1`,
      bucket, now,
    );
    return;
  }
  if (row.hits >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.');
  }
  run('UPDATE login_attempts SET hits = hits + 1 WHERE bucket = ?', bucket);
}

export function clearThrottle(ip, email) {
  run('DELETE FROM login_attempts WHERE bucket = ?', `${ip}|${String(email).toLowerCase()}`);
}

/**
 * Create the first admin from the environment, for hosts where you cannot get
 * a shell to run `npm run seed` (Hostinger shared hosting, most PaaS).
 *
 * Fires ONLY when the users table is completely empty, so it can never touch a
 * live workspace, reset a password, or resurrect a deactivated account. Once
 * anyone exists it is a no-op for the lifetime of the database.
 */
export function bootstrapAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || '').trim() || 'Admin';

  if (one('SELECT COUNT(*) AS n FROM users').n > 0) return null;
  if (!email || !password) return null;

  if (password.length < 10) {
    console.warn('[worklog] BOOTSTRAP_ADMIN_PASSWORD is under 10 characters — refusing to create the admin.');
    return null;
  }

  const now = nowISO();
  run(`INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
       VALUES (?, ?, 'admin', ?, 480, 1, 1, ?, ?)`,
    email, name, hashPassword(password), now, now);

  console.log(`[worklog] Created the first admin (${email}) from BOOTSTRAP_ADMIN_*.`);
  console.log('[worklog] Sign in, change the password, then remove those three variables from .env.');
  return email;
}

/** Remove expired sessions and stale throttle buckets. Called on boot. */
export function sweep() {
  run('DELETE FROM sessions WHERE expires_at < ?', nowISO());
  run('DELETE FROM login_attempts WHERE window_start < ?', Date.now() - WINDOW_MS);
  return all('SELECT COUNT(*) AS n FROM sessions')[0].n;
}
