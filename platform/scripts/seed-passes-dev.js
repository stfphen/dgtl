// Dev/staging seed for DGTL Pass: one team with an owner, a password door-staff
// verifier and a Google-only issuer, plus a DGTL-branded tenant with the five
// preset pass types, so sign-in, issuing and scanning work end to end.
// Refuses to run in production. No credential is stored here: the password
// comes from PASSES_DEMO_PASSWORD (12+ characters).
//
//   DATABASE_URL=… PASSES_DEMO_PASSWORD=… npm run seed:passes-dev
//
// `npm run demo:passes` runs this for you against its own demo database.

import { createUser, ensureUserMembership, findUserByEmail } from "../lib/users.js";
import { installPresetPassTypes } from "../lib/passes/store.js";
import { DGTL_TOKENS } from "../lib/passes/brandKit.js";
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
// DGTL is the default brand, configured like any tenant would be: the
// `passes` block is plain tenant config, nothing here is special-cased in code.
// primaryColor matters: without it tenant normalisation fills in the legacy
// funnel blue, and passes honour a tenant's own colour for the brand mark.
const TENANT = {
  id: "tenant_passes_demo",
  slug: "passes-demo",
  config: {
    id: "tenant_passes_demo",
    slug: "passes-demo",
    brand: { name: "DGTL", logoText: "DGTL", primaryColor: DGTL_TOKENS["--gold"] },
    passes: {
      timeZone: "America/Toronto",
      dayCutoffHour: 4,
      gates: ["Main door", "VIP entrance"],
      brandKit: {
        logoIncludesName: true,
        walletLogoText: "PASS",
        legal: { supportEmail: "help@passes-demo.test" }
      }
    }
  }
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`insert into teams (id, name, slug) values ($1, $2, $3) on conflict (id) do nothing`, [TEAM.id, TEAM.name, TEAM.slug]);
await client.query(
  `insert into tenants (id, team_id, slug, domains, status, config)
   values ($1, $2, $3, '[]'::jsonb, 'active', $4::jsonb)
   on conflict (id) do update set config = excluded.config, team_id = excluded.team_id, updated_at = now()`,
  [TENANT.id, TEAM.id, TENANT.slug, JSON.stringify({ ...TENANT.config, teamId: TEAM.id })]
);
await client.end();
console.log(`[seed:passes-dev] tenant   ${TENANT.slug} (${TENANT.config.brand.name})`);

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

const types = await installPresetPassTypes({ teamId: TEAM.id, tenantId: TENANT.id });
console.log(`[seed:passes-dev] pass types: ${types.created} created, ${types.total - types.created} already there`);
process.exit(0);
