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
