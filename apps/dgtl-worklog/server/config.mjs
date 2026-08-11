/**
 * DGTL Worklog — configuration and date helpers.
 *
 * Reads .env if present (no dependency), then exposes the handful of settings
 * the rest of the server needs. Everything has a working default so a fresh
 * clone runs with `npm start` and no .env at all.
 *
 * Also home to `sayDatabase` / `guardWorkspace`, the two lines every script
 * runs before it writes — because this file resolving DB_PATH silently is what
 * let a script open production without saying so.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- .env loader (optional; real env vars always win) ---
(() => {
  const envPath = path.join(APP_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const bool = (v, dflt) => (v === undefined ? dflt : /^(1|true|yes|on)$/i.test(v));

export const HOST = process.env.HOST || '0.0.0.0';
export const PORT = Number(process.env.PORT || 8123);
export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Toronto';
export const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
export const SECURE_COOKIES = bool(process.env.SECURE_COOKIES, false);
export const TRUST_XFF = bool(process.env.TRUST_XFF, false);

export const DB_PATH = path.resolve(APP_DIR, process.env.DB_PATH || 'data/worklog.sqlite');
export const PUBLIC_DIR = path.join(APP_DIR, 'public');

// --- what a script is about to touch ------------------------------------
// The .env read above happens before any script prints a word, which is the
// whole defect: `npm run seed` in the app directory on the host resolved the
// live DB_PATH and opened production in silence. Loading .env first is right —
// a script must see the same database the server does — so the fix is that the
// answer stops being invisible, and that a script which INSERTS says no to a
// workspace somebody is already using.

/** Name the database this process resolved, before it writes anything to it. */
export const sayDatabase = () => console.log(`Database  ${DB_PATH}`);

/**
 * Print the path, then stop unless the workspace is this script's to write into.
 *
 * `findings` is what the caller found that says the workspace is in use —
 * counted at the call site, because config.mjs cannot import db.mjs (db.mjs
 * imports this file) and because what counts as "in use" is the script's own
 * question, not a shared one. An empty list runs straight through, which is why
 * a fresh checkout still seeds with no arguments and no ceremony.
 *
 * Deliberately defeatable: re-seeding a real workspace is a legitimate thing to
 * want. `--force`, or WORKLOG_FORCE=1, and the path is printed either way.
 */
export function guardWorkspace(script, findings, { force = false } = {}) {
  sayDatabase();
  if (!findings.length) return;
  if (force) {
    console.log(`⚠  ${findings.join('; ')} — running anyway, --force was given.`);
    return;
  }
  console.error(`✗ Refusing to run ${script} against a workspace that is already in use:`);
  for (const f of findings) console.error(`    · ${f}`);
  console.error('  That is the database named above. Point DB_PATH somewhere else, or —');
  console.error('  if it really is the one you meant — re-run with --force (or WORKLOG_FORCE=1).');
  process.exit(1);
}

// --- dates -------------------------------------------------------------
// Every entry is filed under a calendar date in APP_TIMEZONE so the whole team
// agrees on what "today" is, whatever the server's own locale happens to be.
// en-CA formats as YYYY-MM-DD, which is exactly the storage format.
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Calendar date (YYYY-MM-DD) of an instant, in the app timezone. */
export const localDate = (d = new Date()) => dateFmt.format(d);

/** Current instant as an ISO string — the storage format for timestamps. */
export const nowISO = () => new Date().toISOString();

/** True for a well-formed YYYY-MM-DD that is also a real calendar date. */
export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Shift a YYYY-MM-DD by whole days, staying in calendar space (no DST drift). */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day of week for a YYYY-MM-DD: 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Monday-or-Sunday-aligned start of the week containing `date`. */
export function startOfWeek(date, weekStart = 1) {
  const diff = (dayOfWeek(date) - weekStart + 7) % 7;
  return addDays(date, -diff);
}
