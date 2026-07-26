import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const migrationsDir = path.join(rootDir, "migrations");
const migrationLockName = "content_checkout_funnel_migrations";

async function loadDotEnv() {
  if (process.env.DATABASE_URL) return;

  try {
    const envPath = path.join(rootDir, ".env");
    const raw = await readFile(envPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim().replace(/^export\s+/, "");
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function listMigrationFiles() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query("select filename from schema_migrations");
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const fullPath = path.join(migrationsDir, filename);
  const sql = await readFile(fullPath, "utf8");

  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  await loadDotEnv();

  if (!process.env.DATABASE_URL) {
    console.error("[migrate] DATABASE_URL is required. Set it in the environment or .env.");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    console.log("[migrate] Connected to PostgreSQL.");
    await client.query("select pg_advisory_lock(hashtext($1::text))", [migrationLockName]);
    console.log("[migrate] Acquired migration lock.");

    await ensureMigrationsTable(client);

    const files = await listMigrationFiles();
    if (!files.length) {
      console.log("[migrate] No SQL migration files found.");
      return;
    }

    const applied = await getAppliedMigrations(client);
    const pending = files.filter((filename) => !applied.has(filename));

    if (!pending.length) {
      console.log("[migrate] Database is up to date.");
      return;
    }

    for (const filename of pending) {
      console.log(`[migrate] Applying ${filename}...`);
      await applyMigration(client, filename);
      console.log(`[migrate] Applied ${filename}.`);
    }

    console.log(`[migrate] Applied ${pending.length} migration(s).`);
  } catch (error) {
    console.error(`[migrate] Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try {
        await client.query("select pg_advisory_unlock(hashtext($1::text))", [migrationLockName]);
      } catch {
        // Connection failures during migration can also make unlock unavailable.
      }
      client.release();
    }
    await pool.end();
  }
}

main();
