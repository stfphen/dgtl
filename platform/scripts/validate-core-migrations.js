import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
const parsed = databaseUrl ? new URL(databaseUrl) : null;
if (process.env.CORE_MIGRATION_REHEARSAL_CONFIRM !== "isolated" || !parsed || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Core migration validation only runs with CORE_MIGRATION_REHEARSAL_CONFIRM=isolated against localhost.");
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "migrations");
const suffix = `${process.pid}_${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
const rehearsalDatabase = `dgtl_core_rehearsal_${suffix}`;
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = `/${parsed.pathname.slice(1) || "postgres"}`;
const targetUrl = new URL(databaseUrl);
targetUrl.pathname = `/${rehearsalDatabase}`;

async function migrationFiles() {
  return (await readdir(migrationDir)).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
}

async function apply(client, filename) {
  const sql = await readFile(path.join(migrationDir, filename), "utf8");
  await client.query("begin");
  try { await client.query(sql); await client.query("commit"); }
  catch (error) { await client.query("rollback"); throw error; }
}

async function scalar(client, sql) {
  return Number((await client.query(sql)).rows[0].count);
}

const admin = new Client({ connectionString: adminUrl.toString() });
let client;
let adminConnected = false;
try {
  await admin.connect();
  adminConnected = true;
  await admin.query(`create database "${rehearsalDatabase}"`);
  client = new Client({ connectionString: targetUrl.toString() });
  await client.connect();
  const files = await migrationFiles();
  for (const file of files.filter((name) => name < "009_")) await apply(client, file);

  await client.query("insert into teams (id,name,slug) values ('team_fixture','Fixture','fixture')");
  await client.query("insert into tenants (id,slug,domains,status,config,team_id) values ('tenant_fixture','fixture','[]','active','{}','team_fixture')");
  await client.query(`insert into leads (id,tenant_id,team_id,business,name,email,website_url,domain,notes,source_type,metadata,created_at,updated_at) values
    ('lead_fixture_1','tenant_fixture','team_fixture','Acme','Ada Buyer','ada@acme.test','https://acme.test','acme.test','Researched expansion signal','fixture','{"enrichment":{"signal":"expansion"}}',now(),now()),
    ('lead_fixture_2','tenant_fixture','team_fixture','Beta','Grace Lead','grace@beta.test','https://beta.test','beta.test','Second signal','fixture','{}',now(),now())`);
  await client.query("insert into target_accounts (id,team_id,tenant_id,name,domain,fit_rationale,source_type) values ('target_fixture','team_fixture','tenant_fixture','Target Co','target.test','Strong fit','manual')");
  await client.query("insert into account_campaigns (id,team_id,account_id,name,big_idea) values ('account_campaign_fixture','team_fixture','target_fixture','Target approach','Lead with proof')");
  await client.query("insert into outreach_campaigns (id,tenant_id,name,status) values ('outreach_campaign_fixture','tenant_fixture','Legacy campaign','active')");
  await client.query("insert into outreach_queue (id,lead_id,campaign_id,tenant_id,status,subject,body,recipient_email,sender_email,step) values ('queue_fixture','lead_fixture_1','outreach_campaign_fixture','tenant_fixture','approved','Hello','Body','ada@acme.test','sender@dgtl.test',0)");
  await client.query("insert into draft_emails (id,lead_id,tenant_id,team_id,subject,body,status) values ('draft_fixture','lead_fixture_2','tenant_fixture','team_fixture','Draft','Body','draft')");

  const before = {
    leads: await scalar(client, "select count(*) from leads"),
    targets: await scalar(client, "select count(*) from target_accounts"),
    accountCampaigns: await scalar(client, "select count(*) from account_campaigns"),
    outreachCampaigns: await scalar(client, "select count(*) from outreach_campaigns"),
    queue: await scalar(client, "select count(*) from outreach_queue"),
    drafts: await scalar(client, "select count(*) from draft_emails")
  };
  for (const file of files.filter((name) => name >= "009_")) await apply(client, file);

  const after = {
    companies: await scalar(client, "select count(*) from companies"),
    contacts: await scalar(client, "select count(*) from contacts"),
    opportunities: await scalar(client, "select count(*) from opportunities"),
    campaigns: await scalar(client, "select count(*) from campaigns"),
    messages: await scalar(client, "select count(*) from messages"),
    orphanContacts: await scalar(client, "select count(*) from contacts c left join companies co on co.id=c.company_id where c.company_id is not null and co.id is null"),
    orphanOpportunities: await scalar(client, "select count(*) from opportunities o left join companies c on c.id=o.company_id where c.id is null"),
    crossTeamRelationships: await scalar(client, "select count(*) from opportunity_contacts oc join opportunities o on o.id=oc.opportunity_id join contacts c on c.id=oc.contact_id where oc.team_id is distinct from o.team_id or oc.team_id is distinct from c.team_id")
  };
  assert.equal(after.companies, before.leads + before.targets);
  assert.equal(after.contacts, before.leads);
  assert.equal(after.opportunities, before.leads + before.accountCampaigns);
  assert.equal(after.campaigns, before.outreachCampaigns);
  assert.equal(after.messages, before.queue + before.drafts);
  assert.equal(after.orphanContacts, 0);
  assert.equal(after.orphanOpportunities, 0);
  assert.equal(after.crossTeamRelationships, 0);

  for (const file of files.filter((name) => name >= "009_")) await apply(client, file);
  const repeated = {
    companies: await scalar(client, "select count(*) from companies"),
    contacts: await scalar(client, "select count(*) from contacts"),
    opportunities: await scalar(client, "select count(*) from opportunities"),
    campaigns: await scalar(client, "select count(*) from campaigns"),
    messages: await scalar(client, "select count(*) from messages")
  };
  assert.deepEqual(repeated, { companies: after.companies, contacts: after.contacts, opportunities: after.opportunities, campaigns: after.campaigns, messages: after.messages });

  await client.query("insert into teams (id,name,slug) values ('team_attacker','Attacker','attacker')");
  let blocked = false;
  try { await client.query("insert into contacts (id,team_id,company_id,full_name) values ('contact_attack','team_attacker','company_lead_lead_fixture_1','Attack')"); }
  catch (error) { blocked = error.code === "23503" && String(error.constraint).includes("contacts_company_team_fkey"); }
  assert.equal(blocked, true, "database must reject a new cross-team contact/company relationship");

  let stage3Blocked = false;
  try {
    await client.query("insert into artifact_families (id,team_id,company_id,opportunity_id,kind,slug) values ('artifact_family_attack','team_attacker','company_lead_lead_fixture_1','opportunity_lead_lead_fixture_1','pitch','cross-team-attack')");
  } catch (error) {
    stage3Blocked = error.code === "23503" && String(error.constraint).includes("artifact_families_company_id_team_id_fkey");
  }
  assert.equal(stage3Blocked, true, "database must reject a new cross-team Artifact family relationship");

  const notValidated = (await client.query("select conname from pg_constraint where conname like '%_team_fkey' and not convalidated order by conname")).rows.map((row) => row.conname);
  console.log(JSON.stringify({ isolated: true, database: rehearsalDatabase, migrations: files, before, after, repeated, crossTeamInsertBlocked: blocked, stage3CrossTeamInsertBlocked: stage3Blocked, deferredConstraintValidation: notValidated }, null, 2));
} finally {
  if (client) await client.end().catch(() => {});
  if (adminConnected) {
    await admin.query(`drop database if exists "${rehearsalDatabase}" with (force)`).catch(() => {});
    await admin.end().catch(() => {});
  }
}
