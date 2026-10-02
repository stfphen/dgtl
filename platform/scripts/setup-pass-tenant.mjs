// DGTL Pass — prepare a tenant to issue passes (production and staging).
//
//   npm run passes:setup-tenant -- --team default --tenant dgtl-pass --create \
//     --support-email help@dgtl.ltd [--gates "Main door,VIP entrance"] \
//     [--timezone America/Toronto] [--terms-url https://…] [--name DGTL]
//
//   --team      the team that issues passes (slug or id); its owners/admins see /passes
//   --tenant    the tenant passes belong to (slug). With --create a new pass-only
//               tenant is made: DGTL brand from the gold token, no domains, draft
//               status, so it never claims a host or changes a public site.
//               Without --create the tenant must exist in that team; only its
//               `passes` block is set, nothing else in its config changes.
//
// Then installs the five DGTL pass types (idempotent). Safe to re-run.
// In production run it inside the app image:
//   docker compose run --rm --no-deps content-funnel npm run passes:setup-tenant -- …

import pg from "pg";
import { closePassesPool, installPresetPassTypes } from "../lib/passes/store.js";
import { newPassTenantConfig, withPassSettings } from "../lib/passes/tenantSetup.js";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};
const fail = (message) => {
  console.error(`\n[passes:setup-tenant] ${message}\n`);
  process.exit(1);
};

if (!process.env.DATABASE_URL) fail("DATABASE_URL is required.");
const teamRef = flag("team");
const tenantSlug = flag("tenant");
if (!teamRef || !tenantSlug) fail("Usage: -- --team <slug|id> --tenant <slug> [--create] --support-email <email>");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const team = (await client.query(`select id, name, slug from teams where id = $1 or slug = $1`, [teamRef])).rows[0];
  if (!team) fail(`No team "${teamRef}". Teams: ${(await client.query(`select slug from teams order by slug`)).rows.map((r) => r.slug).join(", ")}`);

  let row = (await client.query(`select id, team_id, slug, config from tenants where slug = $1`, [tenantSlug])).rows[0];
  if (row && row.team_id !== team.id) fail(`Tenant "${tenantSlug}" belongs to another team.`);
  if (!row && !args.includes("--create")) {
    const own = (await client.query(`select slug from tenants where team_id = $1 order by slug`, [team.id])).rows.map((r) => r.slug);
    fail(`No tenant "${tenantSlug}" in team ${team.slug}. Pass --create to make a pass-only tenant, or use one of: ${own.join(", ") || "(none)"}`);
  }

  const base = row ? row.config : newPassTenantConfig({ id: `tenant_${tenantSlug.replace(/[^a-z0-9]+/gi, "_")}`, slug: tenantSlug, teamId: team.id, name: flag("name") || "DGTL" });
  let config;
  try {
    config = withPassSettings(base, {
      supportEmail: flag("support-email"),
      gates: flag("gates")?.split(","),
      timeZone: flag("timezone"),
      dayCutoffHour: flag("day-cutoff-hour") === undefined ? undefined : Number(flag("day-cutoff-hour")),
      termsUrl: flag("terms-url"),
      supportUrl: flag("support-url"),
      dgtlLockup: !args.includes("--no-dgtl-lockup")
    });
  } catch (error) {
    fail(error.message);
  }

  if (row) {
    await client.query(`update tenants set config = $2::jsonb, updated_at = now() where id = $1`, [row.id, JSON.stringify(config)]);
  } else {
    row = (
      await client.query(
        `insert into tenants (id, team_id, slug, domains, status, config) values ($1, $2, $3, '[]'::jsonb, 'draft', $4::jsonb) returning id, team_id, slug`,
        [config.id, team.id, tenantSlug, JSON.stringify(config)]
      )
    ).rows[0];
  }
  const types = await installPresetPassTypes({ teamId: team.id, tenantId: row.id });
  console.log(`[passes:setup-tenant] team ${team.slug} · tenant ${tenantSlug} (${row.id})
  passes: ${config.passes.timeZone}, day ends ${config.passes.dayCutoffHour}:00, gates ${config.passes.gates.join(" / ")}, support ${config.passes.brandKit.legal.supportEmail}
  pass types: ${types.created} installed, ${types.total - types.created} already there`);
} finally {
  await client.end();
  await closePassesPool();
}
