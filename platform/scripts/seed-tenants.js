import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

/**
 * Seed the customer-facing funnel tenants.
 *
 * Upserts DGTL Content Day (the flagship offer), DMTV (music media), and ELiXR
 * Gallery (high-ticket art) into the default team so each renders at /t/<slug>
 * and is editable in the admin Tenant Builder.
 *
 * Idempotent: upsertTenantConfig writes by deterministic tenant id, so re-running
 * refreshes the config in place rather than creating duplicates.
 */

async function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  // .env.local holds the local DATABASE_URL and takes precedence over .env, matching
  // Next.js env resolution. First value wins because we never overwrite an existing key.
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(rootDir, file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) continue;
        const key = trimmed.slice(0, separatorIndex).trim().replace(/^export\s+/, "");
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function main() {
  await loadDotEnv();

  const TEAM_ID = process.env.SEED_TEAM_ID || "team_default";
  const { upsertTenantConfig } = await import("../lib/store.js");
  const { defaultTenant } = await import("../lib/defaultTenant.js");
  const { dmtvTenant } = await import("../lib/tenants/dmtv.js");
  const { dmtvStudioTenant } = await import("../lib/tenants/dmtvStudio.js");
  const { elixrTenant } = await import("../lib/tenants/elixr.js");
  const { onHomeDecorTenant } = await import("../lib/tenants/onHomeDecor.js");
  const { polishStoneTenant } = await import("../lib/tenants/polishStone.js");
  const { fundedGrowthTenant } = await import("../lib/funding/tenant.js");
  const { dgtlGroupTenant } = await import("../lib/tenants/dgtlGroup.js");

  // DGTL Content Day is the built-in default tenant; persist it so it shows up as
  // an explicit, editable tenant row alongside the other brands. Funded Growth is
  // included so every tenant funnel lives in the database, not just in code.
  const tenants = [
    { label: "DGTL Content Day", config: defaultTenant },
    { label: "DMTV", config: dmtvTenant },
    { label: "DMTV Studio Showcase", config: dmtvStudioTenant },
    { label: "ELiXR Gallery", config: elixrTenant },
    { label: "ON Home Decor", config: onHomeDecorTenant },
    { label: "Polish Stone", config: polishStoneTenant },
    { label: "DGTL Funded Growth Studio", config: fundedGrowthTenant },
    { label: "DGTL Group Agency", config: dgtlGroupTenant }
  ];

  // --only slug[,slug…] seeds a subset. Production rows are edited through the
  // Tenant Editor, so a full re-seed would overwrite those edits; use --only to
  // add new tenants without touching existing ones.
  const onlyIndex = process.argv.indexOf("--only");
  let selected = tenants;
  if (onlyIndex !== -1) {
    const slugs = new Set((process.argv[onlyIndex + 1] || "").split(",").map((s) => s.trim()).filter(Boolean));
    selected = tenants.filter(({ config }) => slugs.has(config.slug));
    const missing = [...slugs].filter((slug) => !tenants.some(({ config }) => config.slug === slug));
    if (!slugs.size || missing.length) {
      throw new Error(`--only expects known slugs; unknown: ${missing.join(", ") || "(none given)"}. Known: ${tenants.map((t) => t.config.slug).join(", ")}`);
    }
  }

  for (const { label, config } of selected) {
    const saved = await upsertTenantConfig({ ...config, teamId: TEAM_ID, status: "active" }, { teamId: TEAM_ID });
    console.log(`[seed-tenants] upserted: ${saved.slug} (${saved.id}) — ${label} -> /t/${saved.slug}`);
  }

  console.log(`[seed-tenants] Done. ${selected.length} tenants active on team ${TEAM_ID}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`[seed-tenants] Failed: ${error.message}`);
      process.exit(1);
    });
}

export { main };
