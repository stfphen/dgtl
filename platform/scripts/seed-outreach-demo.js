import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

/**
 * Seed a ready-to-send batch-email demo: an intro + follow-up template, a
 * campaign with drip + test mode (dry-run) on, a few leads with emails, and
 * APPROVED queue items — some immediate, one future-scheduled so the drain has
 * work. Idempotent (deterministic ids, skip if present). No real email is sent:
 * the campaign is in test mode, so the send path runs against the mock provider.
 *
 * Demo flow after seeding:
 *   npm run seed:outreach-demo
 *   OUTREACH_DRY_RUN=true npm run dev   # or leave dry-run to the campaign testMode
 *   # In /admin Outreach: Send Approved (dry-run) — statuses/metrics update.
 *   # Or fire the scheduled batch:
 *   curl -XPOST -H "Authorization: Bearer $OUTREACH_CRON_TOKEN" \
 *     http://localhost:8088/api/cron/outreach/drain
 */

async function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const raw = await readFile(path.join(rootDir, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i <= 0) continue;
      const key = trimmed.slice(0, i).trim().replace(/^export\s+/, "");
      let value = trimmed.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const DEMO_LEADS = [
  { id: "lead_outreach_demo_1", businessName: "Bloom Dental Studio", contactName: "Priya Anand", email: "priya@bloomdental.example", city: "Toronto", category: "Dental" },
  { id: "lead_outreach_demo_2", businessName: "North Coast Roofing", contactName: "Marcus Lee", email: "marcus@northcoastroof.example", city: "Barrie", category: "Home Services" },
  { id: "lead_outreach_demo_3", businessName: "Verde Med Spa", contactName: "Sofia Reyes", email: "sofia@verdemedspa.example", city: "Mississauga", category: "Med Spa" },
  { id: "lead_outreach_demo_4", businessName: "Anchor Legal Group", contactName: "Daniel Cho", email: "daniel@anchorlegal.example", city: "Ottawa", category: "Legal" }
];

async function main() {
  await loadDotEnv();
  const store = await import("../lib/store.js");
  const { renderOutreachTemplate } = await import("../lib/outreachSequence.js");
  const { buildUnsubscribeUrl } = await import("../lib/outreach/unsubscribe.js");
  const { defaultTenant } = await import("../lib/defaultTenant.js");

  const teamId = "team_default";
  const tenantId = defaultTenant.id;
  const tenant = (await store.getTenantByIdOrSlug(tenantId)) || defaultTenant;

  // 1) Templates (intro + follow-up).
  const templates = await store.listOutreachTemplates({ teamId });
  const introId = "template_outreach_demo_intro";
  const followId = "template_outreach_demo_follow";
  if (!templates.some((t) => t.id === introId)) {
    await store.createOutreachTemplate({
      id: introId, teamId, tenantId, name: "Demo Intro", offerType: "content_day", isActive: true,
      subject: "Quick idea for {{businessName}}",
      body: "Hi {{contactName}},\n\nWe help {{category}} teams in {{city}} turn one shoot day into a month of content.\n\nWorth a quick look?\n\n{{unsubscribeFooter}}"
    });
    console.log(`[seed-outreach-demo] created template ${introId}`);
  }
  if (!templates.some((t) => t.id === followId)) {
    await store.createOutreachTemplate({
      id: followId, teamId, tenantId, name: "Demo Follow-up", offerType: "follow_up", isActive: true,
      subject: "Following up — {{businessName}}",
      body: "Hi {{contactName}},\n\nJust circling back on the content idea for {{businessName}}.\n\n{{unsubscribeFooter}}"
    });
    console.log(`[seed-outreach-demo] created template ${followId}`);
  }

  // 2) Campaign with drip + test mode (dry-run) so the demo never emails anyone.
  const campaignId = "campaign_outreach_demo";
  const campaigns = await store.listOutreachCampaigns({ teamId });
  if (!campaigns.some((c) => c.id === campaignId)) {
    await store.createOutreachCampaign({
      id: campaignId, teamId, tenantId, name: "Batch Email Demo", status: "active",
      dailySendCap: 25, perDomainDailyCap: 5,
      followUpTemplateId: followId, followUpDelayDays: 3, testMode: true
    });
    console.log(`[seed-outreach-demo] created campaign ${campaignId} (testMode on)`);
  }

  // 3) Leads with emails.
  for (const lead of DEMO_LEADS) {
    if (await store.getLeadById(lead.id)) continue;
    await store.createLead({ ...lead, tenantId, teamId, source: "manual" });
    console.log(`[seed-outreach-demo] created lead ${lead.id}`);
  }

  // 4) Approved queue items (3 immediate, 1 future-scheduled) with rendered
  //    bodies incl. a real signed unsubscribe link.
  const intro = (await store.listOutreachTemplates({ teamId })).find((t) => t.id === introId);
  const senderEmail = process.env.RESEND_FROM || "hello@dgtlmag.com";
  const existingQueue = await store.listOutreachQueue({ teamId });
  const nowIso = new Date().toISOString();
  const futureIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  let queued = 0;
  for (let i = 0; i < DEMO_LEADS.length; i += 1) {
    const leadSeed = DEMO_LEADS[i];
    const queueId = `queue_outreach_demo_${i + 1}`;
    if (existingQueue.some((q) => q.id === queueId)) continue;
    const lead = await store.getLeadById(leadSeed.id, { teamId });
    const unsubscribeUrl = buildUnsubscribeUrl({ email: lead.email, tenantId, teamId });
    const rendered = renderOutreachTemplate(intro, { lead, tenant, senderName: "The DGTL Team", unsubscribeUrl });
    await store.createOutreachQueueItem({
      id: queueId, teamId, leadId: lead.id, tenantId, campaignId, templateId: introId,
      status: "approved", step: 0,
      subject: rendered.subject, body: rendered.body,
      recipientEmail: lead.email, senderEmail,
      // Last lead is future-scheduled so the drain has something to pick up.
      scheduledFor: i === DEMO_LEADS.length - 1 ? futureIso : nowIso
    });
    queued += 1;
    console.log(`[seed-outreach-demo] queued approved item ${queueId}${i === DEMO_LEADS.length - 1 ? " (future-scheduled)" : ""}`);
  }

  console.log(`[seed-outreach-demo] Done. ${queued} approved items on tenant ${tenant.slug || tenantId}. Campaign is in test mode (dry-run).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`[seed-outreach-demo] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { DEMO_LEADS };
