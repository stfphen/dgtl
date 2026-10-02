// Dev/staging seed for DGTL Pass: one team with an owner, a password door-staff
// verifier, and a Google-only issuer, so sign-in and role routing can be
// exercised end to end. Refuses to run in production. No credential is stored
// here: the password comes from PASSES_DEMO_PASSWORD (12+ characters).
//
//   DATABASE_URL=… PASSES_DEMO_PASSWORD=… npm run seed:passes-dev

import { createUser, ensureUserMembership, findUserByEmail } from "../lib/users.js";
import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("[seed:passes-dev] refusing to seed demo accounts in production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("[seed:passes-dev] DATABASE_URL is required.");
  process.exit(1);
}
const password = process.env.PASSES_DEMO_PASSWORD || "";
if (password.length < 12) {
  console.error("[seed:passes-dev] set PASSES_DEMO_PASSWORD (12+ characters).");
  process.exit(1);
}

const TEAM = { id: "team_passes_demo", name: "DGTL Pass Demo Venue", slug: "passes-demo" };
const ACCOUNTS = [
  { email: "owner@passes-demo.test", name: "Demo Owner", role: "owner", authMethod: "password" },
  { email: "door@passes-demo.test", name: "Door Staff", role: "verifier", authMethod: "password" },
  { email: "issuer@passes-demo.test", name: "Front Desk", role: "issuer", authMethod: "google" }
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`insert into teams (id, name, slug) values ($1, $2, $3) on conflict (id) do nothing`, [TEAM.id, TEAM.name, TEAM.slug]);
await client.end();

for (const account of ACCOUNTS) {
  const existing = await findUserByEmail(account.email);
  if (existing) {
    await ensureUserMembership({ userId: existing.id, teamId: TEAM.id, role: account.role });
    console.log(`[seed:passes-dev] ${account.role.padEnd(8)} ${account.email} (exists)`);
    continue;
  }
  await createUser({ ...account, password: account.authMethod === "password" ? password : undefined, teamId: TEAM.id });
  console.log(`[seed:passes-dev] ${account.role.padEnd(8)} ${account.email} (${account.authMethod})`);
}
process.exit(0);
