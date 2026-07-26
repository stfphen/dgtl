import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import { hashPassword, normalizeEmail } from "../lib/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const setupLockName = "content_checkout_funnel_create_owner";

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function loadDotEnv() {
  if (process.env.DATABASE_URL) return;

  try {
    const raw = await readFile(path.join(rootDir, ".env"), "utf8");

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

function requireValue(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertStrongOwnerPassword(password, email, teamSlug) {
  if (password.length < 12) {
    throw new Error("OWNER_PASSWORD must be at least 12 characters.");
  }

  const lowerPassword = password.toLowerCase();
  const emailLocalPart = email.split("@")[0];
  const blockedFragments = ["password", "changeme", "admin", "owner", emailLocalPart, teamSlug].filter(
    Boolean
  );

  if (blockedFragments.some((fragment) => lowerPassword.includes(fragment.toLowerCase()))) {
    throw new Error("OWNER_PASSWORD is too easy to guess.");
  }
}

export function readOwnerConfigFromEnv() {
  const email = normalizeEmail(requireValue("OWNER_EMAIL"));
  const name = requireValue("OWNER_NAME");
  const password = requireValue("OWNER_PASSWORD");
  const teamName = requireValue("TEAM_NAME");
  const teamSlug = normalizeSlug(requireValue("TEAM_SLUG"));

  if (!email.includes("@")) {
    throw new Error("OWNER_EMAIL must be a valid email address.");
  }
  if (!teamSlug) {
    throw new Error("TEAM_SLUG must contain letters or numbers.");
  }

  assertStrongOwnerPassword(password, email, teamSlug);

  return { email, name, password, teamName, teamSlug };
}

export async function createOwnerWithClient(client, config) {
  const passwordHash = await hashPassword(config.password);
  const teamId = id("team");
  const userId = id("user");
  const membershipId = id("membership");

  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1::text))", [setupLockName]);

    const teamResult = await client.query(
      `with inserted as (
         insert into teams (id, name, slug, updated_at)
         values ($1, $2, $3, now())
         on conflict (slug) do nothing
         returning *
       )
       select *, true as created from inserted
       union all
       select *, false as created from teams
       where slug = $3 and not exists (select 1 from inserted)
       limit 1`,
      [teamId, config.teamName, config.teamSlug]
    );
    const team = teamResult.rows[0];

    const existingUser = await client.query("select * from users where email = $1 limit 1", [config.email]);
    let user = existingUser.rows[0];
    let userCreated = false;

    if (!user) {
      const userResult = await client.query(
        `insert into users (id, email, name, password_hash, updated_at)
         values ($1, $2, $3, $4, now())
         returning *`,
        [userId, config.email, config.name, passwordHash]
      );
      user = userResult.rows[0];
      userCreated = true;
    }

    const membershipResult = await client.query(
      `insert into team_memberships (id, team_id, user_id, role)
       values ($1, $2, $3, 'owner')
       on conflict (team_id, user_id) do update set role = 'owner'
       returning *`,
      [membershipId, team.id, user.id]
    );

    await client.query("commit");

    return {
      team,
      teamCreated: Boolean(team.created),
      user,
      userCreated,
      membership: membershipResult.rows[0]
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  try {
    await loadDotEnv();

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required. Set it in the environment or .env.");
    }

    const config = readOwnerConfigFromEnv();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    try {
      const result = await createOwnerWithClient(client, config);

      console.log(`[create-owner] Team ready: ${result.team.slug}`);
      console.log(`[create-owner] Owner user ready: ${result.user.email}`);
      console.log(`[create-owner] Owner membership ready: ${result.membership.role}`);
      console.log("[create-owner] Complete.");
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error(`[create-owner] Failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
