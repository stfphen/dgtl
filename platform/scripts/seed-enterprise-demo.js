import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

/**
 * Seed the Enterprise Prospecting (account-based) demo with mock target accounts.
 *
 * Idempotent: deterministic ids, skipped if they already exist — safe to re-run.
 * Mock data only (fictional companies); no scraping, no live provider calls.
 * Accounts land at gate_status="sourced" with a computed fit score, ready to walk
 * through Gate 1 -> research -> scope -> Gate 2 in the admin "Accounts" tab.
 *
 *   npm run seed:enterprise-demo
 */

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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function demoId(domain) {
  return `account_demo_${String(domain).replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

async function main() {
  await loadDotEnv();
  const { createTargetAccount, getTargetAccountById } = await import("../lib/store.js");
  const { mockAccountSearch, scoreAccountFit } = await import("../lib/enterpriseProspecting/index.js");

  const teamId = process.env.TEAM_ID || "team_default";
  const accounts = mockAccountSearch({ limit: 50 });
  let created = 0;
  let skipped = 0;

  for (const a of accounts) {
    const id = demoId(a.domain);
    const existing = await getTargetAccountById(id, { teamId });
    if (existing) {
      skipped += 1;
      console.log(`[seed-enterprise-demo] skip (exists): ${id} — ${a.name}`);
      continue;
    }
    const fit = scoreAccountFit(a);
    await createTargetAccount({
      id,
      teamId,
      name: a.name,
      domain: a.domain,
      segment: a.segment,
      tier: fit.tier,
      fitScore: fit.fitScore,
      fitRationale: fit.rationale,
      firmographics: a.firmographics,
      signals: a.signals,
      buyingCommittee: a.buyingCommittee,
      sourceType: a.sourceType || "open_db",
      gateStatus: "sourced"
    });
    created += 1;
    console.log(`[seed-enterprise-demo] created: ${id} — ${a.name} (fit ${fit.fitScore}, tier ${fit.tier ?? "—"})`);
  }

  console.log(`[seed-enterprise-demo] Done. ${created} created, ${skipped} skipped on team ${teamId}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`[seed-enterprise-demo] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { demoId };
