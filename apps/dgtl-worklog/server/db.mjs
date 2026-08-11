/**
 * DGTL Worklog — database. node:sqlite (built in since Node 22.5), no deps.
 *
 * The schema is applied on every boot; every statement in schema.sql is
 * IF NOT EXISTS, so this doubles as the migration step for a fresh install.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { APP_DIR, DB_PATH } from './config.mjs';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(fs.readFileSync(path.join(APP_DIR, 'schema.sql'), 'utf8'));

/** Rows for a SELECT. */
export const all = (sql, ...params) => db.prepare(sql).all(...params);

/** First row for a SELECT, or undefined. */
export const one = (sql, ...params) => db.prepare(sql).get(...params);

/** Run a write; returns { changes, lastInsertRowid }. */
export const run = (sql, ...params) => db.prepare(sql).run(...params);

/**
 * Does a table already carry a column? PRAGMA table_info is the only way to
 * ask SQLite, and schema.sql cannot answer it: every statement in there is
 * CREATE ... IF NOT EXISTS, which leaves a table that already exists exactly
 * as it is, columns and all.
 */
export const hasColumn = (table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

/**
 * Add a column to a table that shipped without it, once. SQLite has no
 * ALTER TABLE ... ADD COLUMN IF NOT EXISTS, and this file replays on every
 * boot, so the guard is the migration: run it against a database that already
 * has the column and nothing happens.
 */
export function addColumn(table, col, definition) {
  if (hasColumn(table, col)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
  return true;
}

// Columns added to tables that already existed, in order, forever. A brand new
// table belongs in schema.sql — this list is only for widening an old one.
//
// Empty on purpose: the shifts round added a table and no columns. Filing an
// entry against a shift (time_entries.shift_id) is the column it looks like it
// wants, and it is exactly the one this app must not have — which shift a
// stretch of work falls inside is derived from its timestamps at read time, so
// storing it would freeze an answer that has to move when an entry is edited.
const COLUMN_MIGRATIONS = [];
for (const [table, col, definition] of COLUMN_MIGRATIONS) addColumn(table, col, definition);

/** Wrap a function in a transaction — rolls back if it throws. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
