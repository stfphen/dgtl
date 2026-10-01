// A real Postgres for tests, in-process: PGlite (Postgres compiled to WASM) with
// every platform migration applied, in order, exactly as `npm run migrate` would.
// Its query(text, params) -> { rows } matches pg, so it plugs straight into the
// __set*DbForTests hooks. One connection only: lock contention needs real
// Postgres (the Phase 3 double-scan test runs in the release gate's service).

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

export async function migrationFiles() {
  return (await readdir(migrationsDir)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
}

export async function applyMigrations(db) {
  for (const file of await migrationFiles()) {
    await db.exec(await readFile(path.join(migrationsDir, file), "utf8"));
  }
}

export async function migratedPglite() {
  const db = new PGlite();
  await applyMigrations(db);
  return db;
}
