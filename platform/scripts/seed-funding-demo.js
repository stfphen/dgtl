import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

/**
 * Seed the funded-growth demo tenant with sample funding-scan leads.
 *
 * Idempotent: each lead has a deterministic id and is skipped if it already
 * exists, so the script is safe to re-run. Mock data only — no PII, no live
 * funder calls. Leads are crafted to exercise every match state
 * (strong / weak / disqualified-needs-info) across several funding lanes.
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

function demoLeads(tenantId) {
  const base = { tenantId, sourceType: "funding_scan", packageId: "funding-fit-scan", country: "Canada" };
  return [
    {
      ...base,
      id: "lead_funding_demo_export",
      businessName: "Steel Ridge Manufacturing",
      contactName: "Dana Park",
      email: "dana@steelridgemfg.example",
      city: "Hamilton",
      region: "Ontario",
      category: "Manufacturing",
      notes: "Wants to enter the US market with export marketing assets.",
      sourceMetadata: {
        fundingScan: {
          industry: "Manufacturing",
          location: "Hamilton, Ontario",
          revenueRange: "500k_1m",
          employeeCount: "18",
          currentlyExporting: "no",
          interestedInExporting: "yes",
          availableProjectBudget: "50k_100k",
          digitalNeeds: "Website modernization for international buyers",
          ecommerceNeeds: "Dealer portal",
          crmAutomationNeeds: "Sales pipeline automation",
          mainGrowthGoal: "Build export marketing assets for US market entry"
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_ecommerce",
      businessName: "Maple & Co Apparel",
      contactName: "Riley Chen",
      email: "riley@mapleco.example",
      city: "Toronto",
      region: "Ontario",
      category: "Retail",
      notes: "Shopify store wants conversion and paid acquisition help.",
      sourceMetadata: {
        fundingScan: {
          industry: "Retail ecommerce",
          location: "Toronto, Ontario",
          revenueRange: "100k_500k",
          employeeCount: "8",
          currentlyExporting: "no",
          interestedInExporting: "no",
          availableProjectBudget: "15k_50k",
          digitalNeeds: "Website analytics and digital modernization",
          ecommerceNeeds: "Shopify conversion improvements and paid ads",
          crmAutomationNeeds: "Basic customer follow-up automation",
          mainGrowthGoal: "Increase online sales"
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_workforce",
      businessName: "Northwind Trades Group",
      contactName: "Sam Okoro",
      email: "sam@northwindtrades.example",
      city: "London",
      region: "Ontario",
      category: "Construction",
      notes: "Growing crew, needs onboarding and training enablement.",
      sourceMetadata: {
        fundingScan: {
          industry: "Construction",
          location: "London, Ontario",
          revenueRange: "1m_5m",
          employeeCount: "24",
          currentlyExporting: "no",
          interestedInExporting: "no",
          availableProjectBudget: "15k_50k",
          digitalNeeds: "Team training and onboarding content system",
          ecommerceNeeds: "none",
          crmAutomationNeeds: "Field staff enablement and upskilling",
          mainGrowthGoal: "Hire and train new crew with enablement content"
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_cleantech",
      businessName: "Evergreen Energy Retrofits",
      contactName: "Jordan Vasquez",
      email: "jordan@evergreenretrofit.example",
      city: "Ottawa",
      region: "Ontario",
      category: "Clean tech",
      notes: "Clean energy retrofit firm scaling commercialization.",
      sourceMetadata: {
        fundingScan: {
          industry: "Clean tech",
          location: "Ottawa, Ontario",
          revenueRange: "500k_1m",
          employeeCount: "12",
          currentlyExporting: "no",
          interestedInExporting: "yes",
          availableProjectBudget: "50k_100k",
          digitalNeeds: "Commercialization readiness content",
          ecommerceNeeds: "none",
          crmAutomationNeeds: "Lead nurture automation",
          mainGrowthGoal: "Commercialize clean energy retrofit services and sustainability offering"
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_weak",
      businessName: "Corner Cafe Collective",
      contactName: "Pat Lee",
      email: "pat@cornercafe.example",
      city: "Barrie",
      region: "Ontario",
      category: "Hospitality",
      notes: "Small cafe, unsure what it needs.",
      sourceMetadata: {
        fundingScan: {
          industry: "Hospitality",
          location: "Barrie, Ontario",
          revenueRange: "under_100k",
          employeeCount: "3",
          currentlyExporting: "no",
          interestedInExporting: "no",
          availableProjectBudget: "under_5k",
          digitalNeeds: "Maybe a new website someday",
          ecommerceNeeds: "none",
          crmAutomationNeeds: "",
          mainGrowthGoal: "Get a few more customers"
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_needsinfo",
      businessName: "Unnamed Prospect (intake incomplete)",
      contactName: "",
      email: "prospect@incomplete.example",
      city: "",
      region: "",
      category: "",
      notes: "Submitted scan with almost no detail.",
      sourceMetadata: {
        fundingScan: {
          industry: "",
          location: "",
          revenueRange: "pre_revenue",
          employeeCount: "",
          currentlyExporting: "",
          interestedInExporting: "",
          availableProjectBudget: "under_5k",
          digitalNeeds: "",
          ecommerceNeeds: "none",
          crmAutomationNeeds: "",
          mainGrowthGoal: ""
        }
      }
    },
    {
      ...base,
      id: "lead_funding_demo_procurement",
      businessName: "Civic Systems Integrators",
      contactName: "Morgan Reyes",
      email: "morgan@civicsystems.example",
      city: "Toronto",
      region: "Ontario",
      category: "Professional services",
      notes: "B2B firm wants to sell to government and win RFPs.",
      sourceMetadata: {
        fundingScan: {
          industry: "Professional services",
          location: "Toronto, Ontario",
          revenueRange: "1m_5m",
          employeeCount: "30",
          currentlyExporting: "no",
          interestedInExporting: "no",
          availableProjectBudget: "50k_100k",
          digitalNeeds: "Supplier profile and capability statement",
          ecommerceNeeds: "none",
          crmAutomationNeeds: "Government procurement pipeline",
          mainGrowthGoal: "Become procurement ready and respond to government RFPs"
        }
      }
    }
  ];
}

async function main() {
  await loadDotEnv();
  const { createLead, getLeadById } = await import("../lib/store.js");
  const { fundedGrowthTenant } = await import("../lib/funding/index.js");

  const leads = demoLeads(fundedGrowthTenant.id);
  let created = 0;
  let skipped = 0;

  for (const lead of leads) {
    const existing = await getLeadById(lead.id);
    if (existing) {
      skipped += 1;
      console.log(`[seed-funding-demo] skip (exists): ${lead.id} — ${lead.businessName}`);
      continue;
    }
    await createLead(lead);
    created += 1;
    console.log(`[seed-funding-demo] created: ${lead.id} — ${lead.businessName}`);
  }

  console.log(
    `[seed-funding-demo] Done. ${created} created, ${skipped} skipped on tenant ${fundedGrowthTenant.slug}.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`[seed-funding-demo] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { demoLeads };
