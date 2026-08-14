import { Pool } from "pg";
import { ImportService } from "../lib/stage2/importService.js";
import { OutreachService } from "../lib/stage2/outreachService.js";
import { PostgresStage2Repository } from "../lib/stage2/repository.js";
import { createTestTransport } from "../lib/stage2/testTransport.js";

const databaseUrl = process.env.DATABASE_URL || "";
const parsed = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.STAGE2_REHEARSAL_CONFIRM !== "isolated" || !parsed || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Rehearsal is write-producing and only runs with STAGE2_REHEARSAL_CONFIRM=isolated against localhost.");
}

const suffix = Date.now().toString(36);
const teamId = `team_stage2_rehearsal_${suffix}`;
const tenantId = `tenant_stage2_rehearsal_${suffix}`;
const actor = { id: `user_stage2_rehearsal_${suffix}`, role: "owner" };
const sheet = [
  "Company,Domain,Contact Name,Job Title,Email,Company Research,Why DGTL Fits,Recent Signals,Recommended Approach Angle,Relevant Product/Service,Priority,Source",
  'North Star Foods,northstar.example,Ada Buyer,VP Growth,ada@northstar.example,"Three new locations","Needs a consistent acquisition system","New Toronto location","Lead with a sourced location-by-location audit",Digital presence audit,High,DGTL acceptance fixture',
  'Signal Works,signal.example,Grace Lead,Founder,grace@signal.example,"New product launch","Creator distribution fits the launch","Launch announced this month","Connect the launch signal to creator distribution",Influence activation,Medium,DGTL acceptance fixture'
].join("\n");

const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query("insert into teams (id,name,slug) values ($1,$2,$3)", [teamId, "Stage 2 Rehearsal", `stage2-${suffix}`]);
  await pool.query("insert into tenants (id,slug,domains,status,config,team_id) values ($1,$2,'[]'::jsonb,'active','{}'::jsonb,$3)", [tenantId, `stage2-${suffix}`, teamId]);
  const repository = new PostgresStage2Repository(pool);
  const imports = new ImportService({ teamId, actor, repository });
  let batch = await imports.upload({ filename: "representative-dgtl-prospects.csv", content: sheet, tenantId, provenance: { fixture: true, purpose: "Stage 2 acceptance" } });
  for (const row of batch.rows) batch = await imports.reviewRow(batch.id, row.id, "create_new");
  batch = await imports.apply(batch.id);

  const opportunities = await repository.listOpportunities(teamId);
  const outreach = new OutreachService({ teamId, actor, repository, transport: createTestTransport() });
  const campaign = await outreach.createCampaign({ name: "Stage 2 acceptance campaign", tenantId, sendingIdentity: { email: "test@dgtl.invalid" }, personalizationConfig: { instructions: "Use sourced signals and the reviewed approach angle." } });
  await outreach.addCohort(campaign.id, opportunities.map((opportunity) => ({ opportunityId: opportunity.id, contactId: opportunity.primaryContactId, importBatchId: batch.id })));
  const drafts = await outreach.draftMessages(campaign.id, { subject: "An idea for {{company}}", body: "Hi {{first_name}},\n\nI noticed {{recent_signal}}\n\n{{approach_angle}} The first step is {{offer}}." });
  for (const draft of drafts) await outreach.approveMessage(draft.id);
  await outreach.approveCampaign(campaign.id);
  for (const draft of drafts) await outreach.queueMessage(draft.id);
  const firstDrain = await outreach.processOutbox({ workerId: "acceptance_worker_1" });
  const secondDrain = await outreach.processOutbox({ workerId: "acceptance_worker_2" });
  const sent = await repository.listMessages(teamId, { campaignId: campaign.id });
  await outreach.recordProviderEvent({ provider: "test", providerEventId: `event_${suffix}`, providerMessageId: sent[0].externalMessageId, eventType: "delivered" });
  const counts = await pool.query(`select
    (select count(*)::int from companies where team_id=$1) companies,
    (select count(*)::int from contacts where team_id=$1) contacts,
    (select count(*)::int from opportunities where team_id=$1) opportunities,
    (select count(*)::int from research_records where team_id=$1) research,
    (select count(*)::int from campaigns where team_id=$1) campaigns,
    (select count(*)::int from messages where team_id=$1) messages,
    (select count(*)::int from activities where team_id=$1) activities,
    (select count(*)::int from message_delivery_attempts where team_id=$1) attempts`, [teamId]);
  console.log(JSON.stringify({
    isolated: true, teamId, importBatchId: batch.id, appliedRows: batch.appliedRows,
    firstDrain, secondDrain, duplicateDeliveryPrevented: secondDrain.length === 0,
    provider: "test", externalNetworkCalls: 0, counts: counts.rows[0]
  }, null, 2));
} finally {
  await pool.end();
}
