import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { defaultTenant, normalizeTenantConfig } from "./defaultTenant.js";
import { fundedGrowthTenant } from "./funding/tenant.js";
import { onHomeDecorTenant } from "./tenants/onHomeDecor.js";
import { polishStoneTenant } from "./tenants/polishStone.js";
import { dgtlPlatformTenant } from "./tenants/dgtlPlatform.js";
import {
  decorateLeadsWithDuplicates,
  normalizeLeadInput,
  normalizedPhone,
  normalizePipelineStatus,
  shouldSkipReliableDuplicate,
  withLegacyAliases
} from "./leadUtils.js";
import {
  campaignStatuses,
  defaultOutreachTemplates,
  outreachEventTypes,
  outreachQueueStatuses,
  suppressionReasons
} from "./outreachSequence.js";
import { validateTenantConfigOrThrow } from "./tenantValidation.js";
import { defaultTenantTelephony, normalizeTenantTelephony } from "./telephony/constants.js";

// APP_STORE_PATH lets tests point the JSON fallback store at an isolated temp
// file. Falls back to the default project data path in normal operation.
const DATA_PATH = process.env.APP_STORE_PATH || path.join(process.cwd(), "data", "app-store.json");
const DEFAULT_TEAM_ID = "team_default";

let pgPool;
let schemaReady = false;

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function getPgPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const { Pool } = await import("pg");
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pgPool;
}

let schemaPromise = null;

// The admin page fires ~15 list queries via Promise.all and each calls
// ensureSchema(); the old boolean-only guard let all 15 run the CREATE TABLE /
// ALTER TABLE bootstrap concurrently, which Postgres deadlocks on. Memoize the
// in-flight bootstrap so concurrent callers await a single run (reset on failure
// so a later request can retry).
async function ensureSchema() {
  const pool = await getPgPool();
  if (!pool || schemaReady) return pool;
  if (!schemaPromise) {
    schemaPromise = bootstrapSchema(pool).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  await schemaPromise;
  return pool;
}

// One-time schema bootstrap (DDL). Runs only through ensureSchema's single-flight
// guard above, so it never executes concurrently with itself.
async function bootstrapSchema(pool) {
  if (!pool || schemaReady) return pool;

  // Legacy bootstrap kept temporarily for compatibility. Add future PostgreSQL
  // schema changes as SQL files in migrations/ and apply them with npm run migrate.
  await pool.query(`
    create table if not exists tenants (
      id text primary key,
      team_id text not null default 'team_default',
      slug text unique not null,
      domains jsonb not null default '[]',
      status text not null default 'active',
      config jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists leads (
      id text primary key,
      team_id text not null default 'team_default',
      tenant_id text not null,
      campaign_id text,
      batch_id text,
      business text,
      name text,
      contact_title text,
      email text,
      phone text,
      website_url text,
      domain text,
      address text,
      city text,
      region text,
      country text,
      category text,
      notes text,
      package_id text,
      status text not null default 'new',
      enrichment_status text not null default 'not_started',
      outreach_status text not null default 'not_started',
      pipeline_status text not null default 'new',
      lead_score integer not null default 0,
      lead_score_reason text,
      pain_points text,
      recommended_offer text,
      assigned_to text,
      google_place_id text,
      google_rating numeric,
      google_review_count integer,
      source_url text,
      source_type text not null default 'form',
      metadata jsonb not null default '{}',
      last_contacted_at timestamptz,
      next_follow_up_at timestamptz,
      reply_status text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table leads add column if not exists batch_id text;
    alter table tenants add column if not exists team_id text not null default 'team_default';
    alter table leads add column if not exists team_id text not null default 'team_default';
    alter table leads add column if not exists contact_title text;
    alter table leads add column if not exists domain text;
    alter table leads add column if not exists address text;
    alter table leads add column if not exists city text;
    alter table leads add column if not exists region text;
    alter table leads add column if not exists country text;
    alter table leads add column if not exists category text;
    alter table leads add column if not exists enrichment_status text not null default 'not_started';
    alter table leads add column if not exists outreach_status text not null default 'not_started';
    alter table leads add column if not exists pipeline_status text not null default 'new';
    alter table leads add column if not exists lead_score integer not null default 0;
    alter table leads add column if not exists lead_score_reason text;
    alter table leads add column if not exists pain_points text;
    alter table leads add column if not exists recommended_offer text;
    alter table leads add column if not exists assigned_to text;
    alter table leads add column if not exists google_place_id text;
    alter table leads add column if not exists google_rating numeric;
    alter table leads add column if not exists google_review_count integer;
    alter table leads add column if not exists last_contacted_at timestamptz;
    alter table leads add column if not exists next_follow_up_at timestamptz;
    alter table leads add column if not exists reply_status text;
    alter table leads add column if not exists campaign_id text;
    alter table leads add column if not exists assigned_to_user_id text;
    alter table leads add column if not exists last_call_at timestamptz;
    alter table leads add column if not exists call_status text;
    alter table leads add column if not exists preferred_contact_method text;
    alter table leads add column if not exists do_not_call boolean not null default false;
    alter table leads add column if not exists do_not_contact boolean not null default false;
    alter table leads add column if not exists consent_source text;
    alter table leads add column if not exists last_opt_out_at timestamptz;
    alter table leads add column if not exists phone_country text;

    create table if not exists contractors (
      id text primary key,
      team_id text not null default 'team_default',
      name text not null,
      email text,
      phone text,
      service_area text,
      availability_notes text,
      weekly_capacity integer,
      rate_notes text,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists draft_emails (
      id text primary key,
      team_id text not null default 'team_default',
      lead_id text not null,
      tenant_id text not null,
      subject text not null,
      body text not null,
      status text not null default 'draft',
      created_at timestamptz not null default now()
    );

    create table if not exists prospecting_batches (
      id text primary key,
      tenant_id text not null,
      name text not null,
      query text not null,
      category text,
      city text,
      provider text not null default 'google_places',
      status text not null default 'draft',
      max_results integer not null default 20,
      enrich_hunter boolean not null default false,
      enrich_apollo boolean not null default false,
      target_roles jsonb not null default '[]',
      preview_results jsonb not null default '[]',
      counts jsonb not null default '{}',
      error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists outreach_templates (
      id text primary key,
      tenant_id text not null,
      name text not null,
      subject text not null,
      body text not null,
      category text,
      offer_type text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists outreach_campaigns (
      id text primary key,
      tenant_id text not null,
      name text not null,
      description text,
      status text not null default 'draft',
      source_filter text,
      city_filter text,
      category_filter text,
      daily_send_cap integer not null default 25,
      per_domain_daily_cap integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists outreach_queue (
      id text primary key,
      lead_id text not null,
      campaign_id text,
      template_id text,
      tenant_id text not null,
      status text not null default 'queued',
      subject text not null,
      body text not null,
      recipient_email text,
      sender_email text,
      scheduled_for timestamptz,
      sent_at timestamptz,
      failure_reason text,
      resend_message_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists outreach_suppression_list (
      id text primary key,
      tenant_id text,
      email text,
      domain text,
      reason text not null default 'manual',
      created_at timestamptz not null default now()
    );

    create table if not exists outreach_events (
      id text primary key,
      lead_id text not null,
      queue_id text,
      campaign_id text,
      type text not null,
      metadata jsonb not null default '{}',
      created_at timestamptz not null default now()
    );

    -- Migration 008: outreach drip + scheduled sends (additive).
    alter table outreach_campaigns add column if not exists follow_up_template_id text;
    alter table outreach_campaigns add column if not exists follow_up_delay_days integer not null default 3;
    alter table outreach_campaigns add column if not exists test_mode boolean not null default false;
    alter table outreach_queue add column if not exists step integer not null default 0;
    create index if not exists outreach_queue_status_scheduled_idx
      on outreach_queue (status, scheduled_for);

    create table if not exists calls (
      id text primary key,
      team_id text not null default 'team_default',
      tenant_id text not null,
      lead_id text,
      campaign_id text,
      batch_id text,
      outreach_message_id text,
      provider text not null default 'twilio',
      provider_call_id text,
      direction text not null,
      from_number text,
      to_number text,
      tenant_number text,
      assigned_user_id text,
      status text not null default 'ringing',
      outcome text,
      duration_seconds integer,
      recording_url text,
      transcript text,
      ai_summary text,
      started_at timestamptz,
      ended_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists calls_team_id_created_at_idx on calls (team_id, created_at desc);
    create index if not exists calls_lead_id_idx on calls (lead_id);
    create index if not exists calls_provider_call_id_idx on calls (provider_call_id);

    create table if not exists call_events (
      id text primary key,
      call_id text not null,
      event_type text not null,
      payload jsonb not null default '{}',
      created_at timestamptz not null default now()
    );

    create index if not exists call_events_call_id_idx on call_events (call_id, created_at desc);

    create table if not exists tasks (
      id text primary key,
      team_id text not null default 'team_default',
      tenant_id text,
      lead_id text,
      title text not null,
      priority text not null default 'normal',
      due_at timestamptz,
      assigned_to_user_id text,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists tasks_team_id_status_idx on tasks (team_id, status, due_at);
    create index if not exists tasks_lead_id_idx on tasks (lead_id);

    alter table contractors add column if not exists team_id text not null default 'team_default';
    alter table draft_emails add column if not exists team_id text not null default 'team_default';

    create table if not exists target_accounts (
      id text primary key,
      team_id text not null default 'team_default',
      tenant_id text,
      name text not null,
      domain text,
      segment text,
      tier smallint,
      fit_score smallint,
      fit_rationale text,
      firmographics jsonb not null default '{}',
      signals jsonb not null default '[]',
      buying_committee jsonb not null default '[]',
      dossier jsonb not null default '{}',
      source_type text,
      gate_status text not null default 'sourced',
      data_gaps jsonb not null default '[]',
      approved_by text,
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists target_accounts_team_id_created_at_idx on target_accounts (team_id, created_at desc);
    create index if not exists target_accounts_team_id_gate_status_idx on target_accounts (team_id, gate_status);
    create index if not exists target_accounts_team_id_domain_idx on target_accounts (team_id, domain);

    create table if not exists account_campaigns (
      id text primary key,
      team_id text not null default 'team_default',
      account_id text not null,
      name text not null,
      big_idea text,
      deliverables jsonb not null default '[]',
      budget_band text,
      budget_rationale text,
      success_metric text,
      outreach_opener text,
      status text not null default 'draft',
      approved_by text,
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists account_campaigns_team_id_account_id_idx on account_campaigns (team_id, account_id);

    create table if not exists media_assets (
      id text primary key,
      team_id text not null default 'team_default',
      tenant_id text not null default '',
      kind text not null default 'image',
      url text not null,
      storage_key text not null default '',
      mime text not null default '',
      bytes integer not null default 0,
      width integer not null default 0,
      height integer not null default 0,
      duration integer not null default 0,
      thumbnail_url text not null default '',
      title text not null default '',
      alt text not null default '',
      tags jsonb not null default '{"industry":[],"format":[]}',
      source text not null default 'upload',
      created_by text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists media_assets_team_id_created_at_idx on media_assets (team_id, created_at desc);
  `);

  const existing = await pool.query("select id from tenants where id = $1", [defaultTenant.id]);
  if (!existing.rowCount) {
    await pool.query(
      "insert into tenants (id, team_id, slug, domains, status, config) values ($1, $2, $3, $4::jsonb, $5, $6::jsonb) on conflict (id) do nothing",
      [
        defaultTenant.id,
        DEFAULT_TEAM_ID,
        defaultTenant.slug,
        JSON.stringify(defaultTenant.domains),
        defaultTenant.status,
        JSON.stringify(defaultTenant)
      ]
    );
  }

  schemaReady = true;
  return pool;
}

async function readFileStore() {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return normalizeFileStore(JSON.parse(raw));
  } catch {
    const initial = {
      tenants: [defaultTenant],
      leads: [],
      contractors: [],
      draftEmails: [],
      prospectingBatches: [],
      outreachTemplates: [],
      outreachCampaigns: [],
      outreachQueue: [],
      outreachSuppressionList: [],
      outreachEvents: [],
      calls: seedCalls(),
      callEvents: [],
      tasks: [],
      targetAccounts: [],
      accountCampaigns: [],
      mediaAssets: []
    };
    await writeFile(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function normalizeFileStore(store) {
  return {
    tenants: store.tenants || [defaultTenant],
    leads: store.leads || [],
    contractors: store.contractors || [],
    draftEmails: store.draftEmails || [],
    prospectingBatches: store.prospectingBatches || [],
    outreachTemplates: store.outreachTemplates || [],
    outreachCampaigns: store.outreachCampaigns || [],
    outreachQueue: store.outreachQueue || [],
    outreachSuppressionList: store.outreachSuppressionList || [],
    outreachEvents: store.outreachEvents || [],
    calls: store.calls || [],
    callEvents: store.callEvents || [],
    tasks: store.tasks || [],
    targetAccounts: store.targetAccounts || [],
    accountCampaigns: store.accountCampaigns || [],
    mediaAssets: store.mediaAssets || []
  };
}

// One example call so the admin Call History panel renders against the JSON
// fallback store in local dev. Only used when no app-store.json exists yet.
function seedCalls() {
  return [
    {
      id: "call_seed_demo",
      teamId: DEFAULT_TEAM_ID,
      tenantId: defaultTenant.id,
      leadId: "",
      campaignId: "",
      batchId: "",
      outreachMessageId: "",
      provider: "twilio",
      providerCallId: "CA_demo_seed",
      direction: "outbound",
      fromNumber: "+14165550100",
      toNumber: "+14165550123",
      tenantNumber: "+14165550100",
      assignedUserId: "",
      status: "completed",
      outcome: "left_voicemail",
      durationSeconds: 42,
      recordingUrl: "",
      transcript: "",
      aiSummary: "",
      startedAt: "2026-06-18T15:00:00.000Z",
      endedAt: "2026-06-18T15:00:42.000Z",
      createdAt: "2026-06-18T15:00:00.000Z",
      updatedAt: "2026-06-18T15:00:42.000Z"
    }
  ];
}

async function writeFileStore(store) {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2));
}

// Serialize file-store read-modify-write sequences that must be atomic (e.g. the
// approved->sending claim). The JSON store has no transactions, so concurrent
// requests can interleave at each await and lose updates; chaining through this
// module-level promise makes the critical section run one-at-a-time in-process.
// The app runs as a single Node process per container, so this is sufficient;
// the Postgres path uses a real atomic UPDATE instead.
let storeLockChain = Promise.resolve();
function withStoreLock(fn) {
  const run = storeLockChain.then(fn, fn);
  // Keep the chain alive regardless of fn's outcome.
  storeLockChain = run.then(() => {}, () => {});
  return run;
}

function normalizeHost(host) {
  return host.split(":")[0].toLowerCase();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function mapTenantRow(row) {
  return normalizeTenantConfig({
    ...row.config,
    id: row.id,
    teamId: row.team_id,
    slug: row.slug,
    domains: row.domains,
    status: row.status
  });
}

function normalizeTeamId(teamId) {
  return String(teamId || "").trim();
}

function requireTeamId(teamId) {
  const normalized = normalizeTeamId(teamId);
  if (!normalized) {
    throw new Error("Team context is required.");
  }
  return normalized;
}

function withTeamId(record, teamId) {
  return {
    ...record,
    teamId: record.teamId || teamId || DEFAULT_TEAM_ID
  };
}

function builtInTenants() {
  // dgtlPlatformTenant owns the canonical app host (app.dgtlmedia.io); it must
  // be resolvable by host without any DB/file seeding, exactly like the
  // default and funded-growth tenants.
  return [defaultTenant, fundedGrowthTenant, onHomeDecorTenant, polishStoneTenant, dgtlPlatformTenant].map((tenant) =>
    withTeamId(normalizeTenantConfig(tenant), tenant.teamId || DEFAULT_TEAM_ID)
  );
}

function getBuiltInTenantByIdOrSlug(identifier) {
  const target = String(identifier || "");
  return builtInTenants().find((tenant) => tenant.id === target || tenant.slug === target) || null;
}

function mergeBuiltInTenants(tenants, { teamId } = {}) {
  const merged = [...tenants];
  const existing = new Set(merged.flatMap((tenant) => [tenant.id, tenant.slug]));

  for (const tenant of builtInTenants()) {
    if (teamId && tenant.teamId !== teamId) continue;
    if (!existing.has(tenant.id) && !existing.has(tenant.slug)) merged.push(tenant);
  }

  return merged;
}

async function resolveTeamIdForTenant(tenantId, teamId) {
  if (teamId) return requireTeamId(teamId);
  const tenant = await getTenantByIdOrSlug(tenantId);
  return tenant?.teamId || DEFAULT_TEAM_ID;
}

export function getSessionTeamId(session) {
  return session?.teamId || session?.team?.id || "";
}

// Resolve the owning team for a tenant id (used by the drain to group due queue
// items per team). Falls back to the default team for built-in tenants.
export async function getTeamIdForTenant(tenantId) {
  return resolveTeamIdForTenant(tenantId);
}

/**
 * Cancel pending (queued/approved) outreach for a lead — used when the lead
 * replies, books, or opts out, so a scheduled follow-up never fires. Returns the
 * count cancelled. Team-scoped.
 */
export async function cancelPendingOutreachForLead(leadId, { teamId, reason = "lead_stopped" } = {}) {
  const queue = await listOutreachQueue({ teamId });
  const pending = queue.filter(
    (item) => item.leadId === leadId && ["queued", "approved"].includes(item.status)
  );
  for (const item of pending) {
    await updateOutreachQueueItem(item.id, { status: "skipped", failureReason: reason }, { teamId });
  }
  return pending.length;
}

export async function canAccessTenant(teamId, tenantId) {
  if (!teamId || !tenantId) return false;
  const tenant = await getTenantByIdOrSlug(tenantId, { teamId });
  return Boolean(tenant);
}

export async function requireTenantAccess(teamId, tenantId) {
  if (!(await canAccessTenant(teamId, tenantId))) {
    const error = new Error("Tenant is not available to this team.");
    error.status = 403;
    throw error;
  }
}

async function listTeamTenantIds(teamId) {
  if (!teamId) return null;
  const tenants = await listTenants({ teamId });
  return new Set(tenants.map((tenant) => tenant.id));
}

async function filterByTeamTenant(records, teamId) {
  const tenantIds = await listTeamTenantIds(teamId);
  if (!tenantIds) return records;
  return records.filter((record) => tenantIds.has(record.tenantId || record.tenant_id));
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tenant";
}

function uniqueTenantSlug(baseSlug, tenants) {
  const existing = new Set(tenants.map((tenant) => tenant.slug));
  let slug = baseSlug;
  let suffix = 2;

  while (existing.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

// Exported: the tenant-edit flow diffs/edits pure config snapshots without the
// draft/published bookkeeping fields.
export function tenantSnapshot(config) {
  const normalized = normalizeTenantConfig(config || {});
  const { draftConfig, publishedConfig, lastPublishedAt, ...snapshot } = normalized;
  return normalizeTenantConfig(snapshot);
}

function hasConfigSnapshot(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Coerce form/JSON/db truthy values (true, "true", "on", 1) to a boolean.
function coerceBool(value) {
  if (value === true) return true;
  if (typeof value === "string") return ["true", "on", "1", "yes"].includes(value.toLowerCase());
  if (typeof value === "number") return value === 1;
  return false;
}

export function getRenderableTenantConfig(tenant, mode = "published") {
  const base = normalizeTenantConfig(tenant || defaultTenant);
  const snapshot = mode === "draft" ? base.draftConfig : base.publishedConfig;
  const selected = hasConfigSnapshot(snapshot) ? snapshot : base;

  return normalizeTenantConfig({
    ...base,
    ...selected,
    draftConfig: base.draftConfig || null,
    publishedConfig: base.publishedConfig || null,
    lastPublishedAt: base.lastPublishedAt || ""
  });
}

export async function getTenantForHost(host) {
  const normalized = normalizeHost(host);
  const matchesHost = (tenant) => {
    const published = getRenderableTenantConfig(tenant, "published");
    return published.status === "active" && published.domains.map(normalizeHost).includes(normalized);
  };
  // Built-in tenants (default + funded-growth) are not persisted as DB rows, so a
  // configured subdomain (e.g. funding.dgtlmag.com -> funded-growth) must be matched
  // against them too, otherwise host routing falls back to the default tenant.
  const builtInByHost = () => builtInTenants().find(matchesHost) || null;
  const pool = await ensureSchema();

  if (pool) {
    const result = await pool.query("select * from tenants where status = 'active'");
    const tenants = result.rows.map(mapTenantRow);
    return (
      tenants.find(matchesHost) ||
      builtInByHost() ||
      tenants.find((tenant) => getRenderableTenantConfig(tenant, "published").status === "active") ||
      defaultTenant
    );
  }

  const store = await readFileStore();
  const fileTenants = store.tenants.map(normalizeTenantConfig).filter((tenant) => tenant.status === "active");
  return (
    fileTenants.find(matchesHost) ||
    builtInByHost() ||
    fileTenants[0] ||
    normalizeTenantConfig(defaultTenant)
  );
}

export async function getTenantBySlug(slug) {
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query("select * from tenants where slug = $1", [slug]);
    return result.rows[0] ? mapTenantRow(result.rows[0]) : getBuiltInTenantByIdOrSlug(slug) || defaultTenant;
  }
  const store = await readFileStore();
  return normalizeTenantConfig(store.tenants.find((tenant) => tenant.slug === slug) || getBuiltInTenantByIdOrSlug(slug) || defaultTenant);
}

export async function getTenantByIdOrSlug(identifier, { teamId } = {}) {
  const target = String(identifier || "");
  const tenants = await listTenants({ teamId });
  return tenants.find((tenant) => tenant.id === target || tenant.slug === target) || null;
}

export async function listTenants({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query("select * from tenants where team_id = $1 order by created_at desc", [teamId])
      : await pool.query("select * from tenants order by created_at desc");
    return mergeBuiltInTenants(result.rows.map(mapTenantRow), { teamId });
  }
  const store = await readFileStore();
  return mergeBuiltInTenants(store.tenants
    .map((tenant) => withTeamId(normalizeTenantConfig(tenant), tenant.teamId))
    .filter((tenant) => !teamId || tenant.teamId === teamId), { teamId });
}

export async function upsertTenantConfig(config, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId || config.teamId);
  const tenant = normalizeTenantConfig({
    ...config,
    teamId: scopedTeamId,
    id: config.id || `tenant_${config.slug || crypto.randomUUID()}`,
    slug: config.slug || config.brand?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "tenant"
  });
  const pool = await ensureSchema();

  if (pool) {
    // Match the file-store semantics: an existing tenant with the same slug in this
    // team is the same tenant, even if its row id differs (slug is globally unique,
    // so an id-keyed insert would otherwise violate tenants_slug_key).
    const existing = await pool.query(
      `select id from tenants where team_id = $1 and slug = $2 limit 1`,
      [scopedTeamId, tenant.slug]
    );
    if (existing.rowCount && existing.rows[0].id !== tenant.id) {
      tenant.id = existing.rows[0].id;
    }
    const result = await pool.query(
      `insert into tenants (id, team_id, slug, domains, status, config, updated_at)
       values ($1, $2, $3, $4::jsonb, $5, $6::jsonb, now())
       on conflict (id) do update set
         team_id = excluded.team_id,
         slug = excluded.slug,
         domains = excluded.domains,
         status = excluded.status,
         config = excluded.config,
         updated_at = now()
       where tenants.team_id = excluded.team_id
       returning id`,
      [
        tenant.id,
        scopedTeamId,
        tenant.slug,
        JSON.stringify(tenant.domains || []),
        tenant.status || "active",
        JSON.stringify(tenant)
      ]
    );
    if (!result.rowCount) {
      throw new Error("Tenant is not available to this team.");
    }
    return tenant;
  }

  const store = await readFileStore();
  const index = store.tenants.findIndex(
    (item) => (item.id === tenant.id || item.slug === tenant.slug) && (item.teamId || scopedTeamId) === scopedTeamId
  );
  if (index >= 0) {
    store.tenants[index] = tenant;
  } else {
    store.tenants.push(tenant);
  }
  await writeFileStore(store);
  return tenant;
}

export async function saveTenantDraftConfig(identifier, config, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const draft = tenantSnapshot(validateTenantConfigOrThrow(config));
  const existing = identifier ? await getTenantByIdOrSlug(identifier, { teamId: scopedTeamId }) : null;

  if (!existing) {
    const tenant = normalizeTenantConfig({
      ...draft,
      teamId: scopedTeamId,
      status: "draft",
      draftConfig: {
        ...draft,
        status: "draft"
      },
      publishedConfig: null,
      lastPublishedAt: ""
    });
    return upsertTenantConfig(tenant, { teamId: scopedTeamId });
  }

  const base = normalizeTenantConfig(existing);
  const keepPublishedTopLevel = base.status === "active" || hasConfigSnapshot(base.publishedConfig);
  const next = normalizeTenantConfig({
    ...(keepPublishedTopLevel ? base : { ...base, ...draft, status: "draft" }),
    id: base.id,
    teamId: scopedTeamId,
    draftConfig: {
      ...draft,
      id: base.id,
      status: draft.status || "draft"
    },
    publishedConfig: base.publishedConfig || null,
    lastPublishedAt: base.lastPublishedAt || ""
  });

  return upsertTenantConfig(next, { teamId: scopedTeamId });
}

export async function publishTenantConfig(identifier, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const existing = await getTenantByIdOrSlug(identifier, { teamId: scopedTeamId });
  if (!existing) {
    throw new Error("Tenant not found.");
  }

  const draft = tenantSnapshot(getRenderableTenantConfig(existing, "draft"));
  const published = validateTenantConfigOrThrow({
    ...draft,
    id: existing.id,
    status: "active"
  });
  const publishedAt = now();
  const tenant = normalizeTenantConfig({
    ...published,
    id: existing.id,
    teamId: scopedTeamId,
    status: "active",
    draftConfig: {
      ...published,
      id: existing.id,
      status: "active"
    },
    publishedConfig: {
      ...published,
      id: existing.id,
      status: "active"
    },
    lastPublishedAt: publishedAt
  });

  return upsertTenantConfig(tenant, { teamId: scopedTeamId });
}

export async function duplicateTenantConfig(identifier, overrides = {}, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const tenants = await listTenants({ teamId: scopedTeamId });
  const source = tenants.find((tenant) => tenant.id === identifier || tenant.slug === identifier);
  if (!source) {
    throw new Error("Tenant not found.");
  }

  const slug = uniqueTenantSlug(slugify(overrides.slug || `${source.slug}-copy`), tenants);
  const sourceDraft = tenantSnapshot(getRenderableTenantConfig(source, "draft"));
  const tenant = validateTenantConfigOrThrow(
    normalizeTenantConfig({
      ...sourceDraft,
      id: overrides.id || `tenant_${slug.replaceAll("-", "_")}`,
      teamId: scopedTeamId,
      slug,
      status: overrides.status || "draft",
      domains: overrides.domains || [`${slug}.local`],
      brand: {
        ...sourceDraft.brand,
        name: overrides.brandName || `${sourceDraft.brand?.name || "Tenant"} Copy`
      },
      draftConfig: null,
      publishedConfig: null,
      lastPublishedAt: ""
    })
  );

  return upsertTenantConfig({
    ...tenant,
    teamId: scopedTeamId,
    draftConfig: tenant,
    publishedConfig: null,
    lastPublishedAt: ""
  }, { teamId: scopedTeamId });
}

/* ---------------------------------------------------------------------------
 * Media library (media_assets) — team-scoped assets referenced from tenant
 * configs by mediaId. Bytes live on disk/object storage (lib/media/); the
 * store holds metadata + the public url. tenantId "" = team-wide asset,
 * visible to every tenant in the team.
 * ------------------------------------------------------------------------- */

const MEDIA_KINDS = new Set(["image", "video", "embed"]);
const MEDIA_SOURCES = new Set(["upload", "url", "embed"]);

function normalizeMediaAsset(input = {}) {
  const tags = input.tags && typeof input.tags === "object" && !Array.isArray(input.tags) ? input.tags : {};
  const asString = (value) => (typeof value === "string" ? value.trim() : "");
  const asCount = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  const timestamp = now();
  return {
    id: asString(input.id) || id("media"),
    teamId: asString(input.teamId) || DEFAULT_TEAM_ID,
    tenantId: asString(input.tenantId),
    kind: MEDIA_KINDS.has(input.kind) ? input.kind : "image",
    url: asString(input.url),
    storageKey: asString(input.storageKey),
    mime: asString(input.mime),
    bytes: asCount(input.bytes),
    width: asCount(input.width),
    height: asCount(input.height),
    duration: asCount(input.duration),
    thumbnailUrl: asString(input.thumbnailUrl),
    title: asString(input.title),
    alt: asString(input.alt),
    tags: {
      industry: Array.isArray(tags.industry) ? tags.industry.map(String).filter(Boolean) : [],
      format: Array.isArray(tags.format) ? tags.format.map(String).filter(Boolean) : []
    },
    source: MEDIA_SOURCES.has(input.source) ? input.source : "upload",
    createdBy: asString(input.createdBy),
    createdAt: asString(input.createdAt) || timestamp,
    updatedAt: asString(input.updatedAt) || timestamp
  };
}

function mapMediaAssetRow(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id || "",
    kind: row.kind,
    url: row.url,
    storageKey: row.storage_key || "",
    mime: row.mime || "",
    bytes: row.bytes || 0,
    width: row.width || 0,
    height: row.height || 0,
    duration: row.duration || 0,
    thumbnailUrl: row.thumbnail_url || "",
    title: row.title || "",
    alt: row.alt || "",
    tags: row.tags || { industry: [], format: [] },
    source: row.source || "upload",
    createdBy: row.created_by || "",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
}

/**
 * The media-slot table: every place a tenant config may reference a library
 * asset by id. Pure + exported so the render-time resolver, the delete
 * reference-check, and tests all walk the exact same slots.
 */
export function collectMediaIds(config) {
  const ids = new Set();
  const add = (value) => {
    const target = typeof value === "string" ? value.trim() : "";
    if (target) ids.add(target);
  };

  add(config?.media?.heroImageId);
  for (const item of Array.isArray(config?.portfolio?.items) ? config.portfolio.items : []) {
    add(item?.mediaId);
  }
  for (const logo of Array.isArray(config?.references?.logos) ? config.references.logos : []) {
    add(logo?.mediaId);
  }

  return [...ids];
}

/**
 * Substitute media-library references (mediaId) with their asset urls before a
 * config reaches FunnelPage. Server-only (needs the store); called from the
 * public page routes. Rules:
 * - mediaId wins when it resolves; the direct src stays as the fallback.
 * - Unresolved ids (deleted asset, cross-team) leave the existing src alone.
 * - Empty asset alt never overwrites an authored alt; it only fills blanks.
 * - id fields are stripped from the result so the client component only ever
 *   sees plain src values (MediaImage's local-vs-remote rule is untouched).
 * - Fast path: a config with no mediaIds is returned unchanged (built-ins,
 *   every pre-media-library tenant).
 */
export async function resolveTenantMediaConfig(config, { teamId } = {}) {
  const ids = collectMediaIds(config);
  if (!ids.length) return config;

  const assets = await getMediaAssetsByIds(ids, { teamId: teamId || config?.teamId || DEFAULT_TEAM_ID });
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  const resolved = { ...config };

  const heroAsset = byId.get(String(config?.media?.heroImageId || "").trim());
  if (config?.media) {
    const { heroImageId, ...media } = config.media;
    resolved.media = heroAsset
      ? {
          ...media,
          heroImage: heroAsset.url,
          heroAlt: media.heroAlt || heroAsset.alt
        }
      : media;
  }

  if (Array.isArray(config?.portfolio?.items)) {
    resolved.portfolio = {
      ...config.portfolio,
      items: config.portfolio.items.map((item) => {
        if (!item || typeof item !== "object") return item;
        const { mediaId, ...rest } = item;
        const asset = byId.get(String(mediaId || "").trim());
        if (!asset) return rest;
        return {
          ...rest,
          src: asset.url,
          alt: rest.alt || asset.alt,
          thumbnail: rest.thumbnail || asset.thumbnailUrl
        };
      })
    };
  }

  if (Array.isArray(config?.references?.logos)) {
    resolved.references = {
      ...config.references,
      logos: config.references.logos.map((logo) => {
        if (!logo || typeof logo !== "object") return logo;
        const { mediaId, ...rest } = logo;
        const asset = byId.get(String(mediaId || "").trim());
        if (!asset) return rest;
        return { ...rest, src: asset.url, alt: rest.alt || asset.alt };
      })
    };
  }

  return resolved;
}

export async function createMediaAsset(input, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId || input?.teamId);
  const asset = normalizeMediaAsset({ ...input, teamId: scopedTeamId });
  if (!asset.url) {
    throw new Error("Media asset requires a url.");
  }
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into media_assets
         (id, team_id, tenant_id, kind, url, storage_key, mime, bytes, width, height,
          duration, thumbnail_url, title, alt, tags, source, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19)`,
      [
        asset.id,
        asset.teamId,
        asset.tenantId,
        asset.kind,
        asset.url,
        asset.storageKey,
        asset.mime,
        asset.bytes,
        asset.width,
        asset.height,
        asset.duration,
        asset.thumbnailUrl,
        asset.title,
        asset.alt,
        JSON.stringify(asset.tags),
        asset.source,
        asset.createdBy,
        asset.createdAt,
        asset.updatedAt
      ]
    );
    return asset;
  }

  const store = await readFileStore();
  store.mediaAssets.push(asset);
  await writeFileStore(store);
  return asset;
}

export async function listMediaAssets({ teamId, tenantId, kind } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const pool = await ensureSchema();

  let assets;
  if (pool) {
    const result = await pool.query(
      "select * from media_assets where team_id = $1 order by created_at desc",
      [scopedTeamId]
    );
    assets = result.rows.map(mapMediaAssetRow);
  } else {
    const store = await readFileStore();
    assets = store.mediaAssets
      .map(normalizeMediaAsset)
      .filter((asset) => asset.teamId === scopedTeamId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  return assets.filter((asset) => {
    // Team-wide assets (tenantId "") show for every tenant filter.
    if (tenantId && asset.tenantId && asset.tenantId !== tenantId) return false;
    if (kind && asset.kind !== kind) return false;
    return true;
  });
}

export async function getMediaAssetsByIds(ids, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  if (!unique.length) return [];
  const pool = await ensureSchema();

  if (pool) {
    const result = await pool.query(
      "select * from media_assets where team_id = $1 and id = any($2)",
      [scopedTeamId, unique]
    );
    return result.rows.map(mapMediaAssetRow);
  }

  const store = await readFileStore();
  const wanted = new Set(unique);
  return store.mediaAssets
    .map(normalizeMediaAsset)
    .filter((asset) => asset.teamId === scopedTeamId && wanted.has(asset.id));
}

export async function getMediaAssetById(mediaId, { teamId } = {}) {
  const assets = await getMediaAssetsByIds([mediaId], { teamId });
  return assets[0] || null;
}

export async function deleteMediaAsset(mediaId, { teamId } = {}) {
  const scopedTeamId = requireTeamId(teamId);
  const target = String(mediaId || "");
  if (!target) return null;
  const pool = await ensureSchema();

  if (pool) {
    const result = await pool.query(
      "delete from media_assets where id = $1 and team_id = $2 returning *",
      [target, scopedTeamId]
    );
    return result.rows[0] ? mapMediaAssetRow(result.rows[0]) : null;
  }

  const store = await readFileStore();
  const index = store.mediaAssets.findIndex(
    (asset) => asset.id === target && (asset.teamId || DEFAULT_TEAM_ID) === scopedTeamId
  );
  if (index === -1) return null;
  const [removed] = store.mediaAssets.splice(index, 1);
  await writeFileStore(store);
  return normalizeMediaAsset(removed);
}

export async function createLead(input) {
  const teamId = await resolveTeamIdForTenant(input.tenantId || defaultTenant.id, input.teamId);
  const lead = normalizeLeadInput({
    ...input,
    teamId,
    id: input.id || id("lead"),
    tenantId: input.tenantId || defaultTenant.id,
    createdAt: input.createdAt || now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    const duplicate = shouldSkipReliableDuplicate(lead, await listLeads({ tenantId: lead.tenantId, teamId }));
    if (duplicate) return { ...duplicate.lead, skippedDuplicate: true, duplicateReasons: duplicate.reasons };

    await pool.query(
      `insert into leads
       (id, team_id, tenant_id, campaign_id, batch_id, business, name, contact_title, email, phone, website_url, domain,
        address, city, region, country, category, notes, package_id, status, enrichment_status, outreach_status,
        pipeline_status, lead_score, lead_score_reason, pain_points, recommended_offer, assigned_to, google_place_id,
        google_rating, google_review_count, source_url, source_type, metadata, last_contacted_at, next_follow_up_at,
        reply_status, created_at, updated_at,
        assigned_to_user_id, last_call_at, call_status, preferred_contact_method, do_not_call, do_not_contact,
        consent_source, last_opt_out_at, phone_country)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::jsonb,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48)`,
      [
        lead.id,
        teamId,
        lead.tenantId,
        lead.campaignId,
        lead.batchId,
        lead.businessName,
        lead.contactName,
        lead.contactTitle,
        lead.email,
        lead.phone,
        lead.websiteUrl,
        lead.domain,
        lead.address,
        lead.city,
        lead.region,
        lead.country,
        lead.category,
        lead.notes,
        lead.packageId,
        lead.status,
        lead.enrichmentStatus,
        lead.outreachStatus,
        lead.pipelineStatus,
        lead.leadScore,
        lead.leadScoreReason,
        lead.painPoints,
        lead.recommendedOffer,
        lead.assignedTo,
        lead.googlePlaceId,
        lead.googleRating || null,
        lead.googleReviewCount || null,
        lead.sourceUrl,
        lead.sourceType,
        JSON.stringify(lead.sourceMetadata || {}),
        lead.lastContactedAt || null,
        lead.nextFollowUpAt || null,
        lead.replyStatus || null,
        lead.createdAt,
        lead.updatedAt,
        lead.assignedToUserId || null,
        lead.lastCallAt || null,
        lead.callStatus || null,
        lead.preferredContactMethod || null,
        Boolean(lead.doNotCall),
        Boolean(lead.doNotContact),
        lead.consentSource || null,
        lead.lastOptOutAt || null,
        lead.phoneCountry || null
      ]
    );
    return lead;
  }

  const store = await readFileStore();
  const duplicate = shouldSkipReliableDuplicate(
    lead,
    store.leads.filter((item) => (item.teamId || teamId) === teamId && item.tenantId === lead.tenantId)
  );
  if (duplicate) return { ...duplicate.lead, skippedDuplicate: true, duplicateReasons: duplicate.reasons };
  store.leads.unshift(lead);
  await writeFileStore(store);
  return lead;
}

function mapLeadRow(row) {
  return withLegacyAliases({
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    batchId: row.batch_id,
    businessName: row.business,
    contactName: row.name,
    contactTitle: row.contact_title,
    email: row.email,
    phone: row.phone,
    website: row.website_url,
    websiteUrl: row.website_url,
    domain: row.domain,
    address: row.address,
    city: row.city,
    region: row.region,
    country: row.country,
    category: row.category,
    notes: row.notes,
    packageId: row.package_id,
    status: row.status,
    enrichmentStatus: row.enrichment_status,
    outreachStatus: row.outreach_status,
    pipelineStatus: row.pipeline_status || row.status,
    leadScore: row.lead_score,
    leadScoreReason: row.lead_score_reason,
    painPoints: row.pain_points,
    recommendedOffer: row.recommended_offer,
    assignedTo: row.assigned_to,
    googlePlaceId: row.google_place_id,
    googleRating: Number(row.google_rating || 0),
    googleReviewCount: Number(row.google_review_count || 0),
    sourceUrl: row.source_url,
    source: row.source_type,
    sourceType: row.source_type,
    sourceMetadata: row.metadata || {},
    metadata: row.metadata || {},
    lastContactedAt: row.last_contacted_at?.toISOString?.() || row.last_contacted_at || "",
    nextFollowUpAt: row.next_follow_up_at?.toISOString?.() || row.next_follow_up_at || "",
    replyStatus: row.reply_status || "",
    assignedToUserId: row.assigned_to_user_id || "",
    lastCallAt: row.last_call_at?.toISOString?.() || row.last_call_at || "",
    callStatus: row.call_status || "",
    preferredContactMethod: row.preferred_contact_method || "",
    doNotCall: Boolean(row.do_not_call),
    doNotContact: Boolean(row.do_not_contact),
    consentSource: row.consent_source || "",
    lastOptOutAt: row.last_opt_out_at?.toISOString?.() || row.last_opt_out_at || "",
    phoneCountry: row.phone_country || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export function mergeLeadMetadata(existingMetadata = {}, patch = {}) {
  const base = isPlainObject(existingMetadata) ? existingMetadata : {};
  if (!isPlainObject(patch)) return { ...base };

  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value)) {
      const existingValue = isPlainObject(base[key]) ? base[key] : {};
      merged[key] = mergeLeadMetadata(existingValue, value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export async function listLeads({ tenantId, teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const clauses = [];
    const params = [];
    if (teamId) {
      params.push(teamId);
      clauses.push(`team_id = $${params.length}`);
    }
    if (tenantId) {
      params.push(tenantId);
      clauses.push(`tenant_id = $${params.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const limit = teamId || tenantId ? "" : "limit 500";
    const result = await pool.query(`select * from leads ${where} order by created_at desc ${limit}`, params);
    return decorateLeadsWithDuplicates(result.rows.map(mapLeadRow));
  }
  const store = await readFileStore();
  const leads = store.leads
    .filter((lead) => !teamId || (lead.teamId || DEFAULT_TEAM_ID) === teamId)
    .filter((lead) => !tenantId || lead.tenantId === tenantId)
    .map((lead) => normalizeLeadInput(withTeamId(lead, lead.teamId)));
  return decorateLeadsWithDuplicates(leads);
}

export async function getLeadById(leadId, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      "select * from leads where id = $1 and ($2::text is null or team_id = $2) limit 1",
      [leadId, teamId || null]
    );
    return result.rows[0] ? mapLeadRow(result.rows[0]) : null;
  }

  const store = await readFileStore();
  const lead = store.leads.find((candidate) => candidate.id === leadId) || null;
  if (!lead) return null;
  if (teamId && (lead.teamId || DEFAULT_TEAM_ID) !== teamId) return null;
  return lead;
}

export async function updateLeadStatus(leadId, status, { teamId } = {}) {
  // Reject arbitrary status strings so neither backend can persist an invalid
  // pipeline state (Postgres would store it verbatim; the file store would
  // silently reset the lead to "new"). Both now share one validated vocabulary.
  const normalized = normalizePipelineStatus(status);
  if (!normalized) {
    const error = new Error(`Invalid pipeline status: ${status}`);
    error.status = 400;
    throw error;
  }
  return updateLead(leadId, { pipelineStatus: normalized, status: normalized }, { teamId });
}

export async function updateLead(leadId, updates, { teamId } = {}) {
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `update leads set
        name = coalesce($2, name),
        contact_title = coalesce($3, contact_title),
        notes = coalesce($4, notes),
        enrichment_status = coalesce($5, enrichment_status),
        outreach_status = coalesce($6, outreach_status),
        pipeline_status = coalesce($7, pipeline_status),
        status = coalesce($7, status),
        lead_score = coalesce($8, lead_score),
        lead_score_reason = coalesce($9, lead_score_reason),
        pain_points = coalesce($10, pain_points),
        recommended_offer = coalesce($11, recommended_offer),
        assigned_to = coalesce($12, assigned_to),
        last_contacted_at = coalesce($13, last_contacted_at),
        metadata = coalesce($14::jsonb, metadata),
        campaign_id = coalesce($15, campaign_id),
        next_follow_up_at = coalesce($16, next_follow_up_at),
        reply_status = coalesce($17, reply_status),
        email = coalesce($19, email),
        phone = coalesce($20, phone),
        website_url = coalesce($21, website_url),
        domain = coalesce($22, domain),
        assigned_to_user_id = coalesce($23, assigned_to_user_id),
        last_call_at = coalesce($24, last_call_at),
        call_status = coalesce($25, call_status),
        preferred_contact_method = coalesce($26, preferred_contact_method),
        do_not_call = coalesce($27, do_not_call),
        do_not_contact = coalesce($28, do_not_contact),
        consent_source = coalesce($29, consent_source),
        last_opt_out_at = coalesce($30, last_opt_out_at),
        phone_country = coalesce($31, phone_country),
        updated_at = now()
       where id = $1
         and ($18::text is null or team_id = $18)`,
      [
        leadId,
        updates.contactName ?? updates.name ?? null,
        updates.contactTitle ?? null,
        updates.notes ?? null,
        updates.enrichmentStatus ?? null,
        updates.outreachStatus ?? null,
        updates.pipelineStatus ?? updates.status ?? null,
        updates.leadScore === undefined ? null : Number(updates.leadScore),
        updates.leadScoreReason ?? null,
        updates.painPoints ?? null,
        updates.recommendedOffer ?? null,
        updates.assignedTo ?? null,
        updates.lastContactedAt || null,
        updates.sourceMetadata || updates.metadata ? JSON.stringify(updates.sourceMetadata || updates.metadata) : null,
        updates.campaignId ?? null,
        updates.nextFollowUpAt || null,
        updates.replyStatus ?? null,
        teamId || null,
        updates.email ?? null,
        updates.phone ?? null,
        updates.website ?? updates.websiteUrl ?? null,
        updates.domain ?? null,
        updates.assignedToUserId ?? null,
        updates.lastCallAt || null,
        updates.callStatus ?? null,
        updates.preferredContactMethod ?? null,
        updates.doNotCall === undefined ? null : Boolean(updates.doNotCall),
        updates.doNotContact === undefined ? null : Boolean(updates.doNotContact),
        updates.consentSource ?? null,
        updates.lastOptOutAt || null,
        updates.phoneCountry ?? null
      ]
    );
    return;
  }
  const store = await readFileStore();
  store.leads = store.leads.map((lead) => {
    if (lead.id !== leadId) return lead;
    if (teamId && (lead.teamId || DEFAULT_TEAM_ID) !== teamId) return lead;
    const merged = normalizeLeadInput({ ...lead, ...updates, updatedAt: now() });
    return merged;
  });
  await writeFileStore(store);
}

export async function updateLeadResearch(leadId, { notes, metadata, status } = {}, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const current = await getLeadById(leadId, { teamId });
    if (!current) return null;

    const updatedAt = now();
    const mergedMetadata = mergeLeadMetadata(current.metadata, metadata);
    const result = await pool.query(
      `update leads
       set notes = $2,
           status = $3,
           metadata = $4::jsonb,
           updated_at = $5
       where id = $1
         and ($6::text is null or team_id = $6)
       returning *`,
      [
        leadId,
        notes === undefined ? current.notes : notes ?? "",
        status === undefined ? current.status : status ?? current.status,
        JSON.stringify(mergedMetadata),
        updatedAt,
        teamId || null
      ]
    );
    return result.rows[0] ? mapLeadRow(result.rows[0]) : current;
  }

  const store = await readFileStore();
  const index = store.leads.findIndex((lead) => lead.id === leadId);
  if (index < 0) return null;
  if (teamId && (store.leads[index].teamId || DEFAULT_TEAM_ID) !== teamId) return null;

  const current = store.leads[index];
  const nextLead = {
    ...current,
    notes: notes === undefined ? current.notes : notes ?? "",
    status: status === undefined ? current.status : status ?? current.status,
    metadata: mergeLeadMetadata(current.metadata, metadata),
    createdAt: current.createdAt,
    updatedAt: now()
  };

  store.leads[index] = nextLead;
  await writeFileStore(store);
  return nextLead;
}

function normalizeBatch(input = {}) {
  return {
    id: input.id || id("batch"),
    tenantId: input.tenantId || defaultTenant.id,
    name: input.name || `${input.category || input.query || "Prospecting"} - ${input.city || "Batch"}`,
    query: input.query || [input.category, input.city].filter(Boolean).join(" in "),
    category: input.category || "",
    city: input.city || "",
    provider: input.provider || "google_places",
    status: input.status || "draft",
    maxResults: Number(input.maxResults || 20),
    enrichHunter: Boolean(input.enrichHunter),
    enrichApollo: Boolean(input.enrichApollo),
    targetRoles: input.targetRoles || [
      "owner",
      "founder",
      "marketing",
      "manager",
      "general manager",
      "director",
      "operations",
      "business development"
    ],
    previewResults: input.previewResults || [],
    counts: input.counts || {
      found: 0,
      imported: 0,
      skippedDuplicates: 0,
      enriched: 0,
      failed: 0
    },
    error: input.error || "",
    createdAt: input.createdAt || now(),
    updatedAt: input.updatedAt || now()
  };
}

function mapBatchRow(row) {
  return normalizeBatch({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    query: row.query,
    category: row.category,
    city: row.city,
    provider: row.provider,
    status: row.status,
    maxResults: row.max_results,
    enrichHunter: row.enrich_hunter,
    enrichApollo: row.enrich_apollo,
    targetRoles: row.target_roles || [],
    previewResults: row.preview_results || [],
    counts: row.counts || {},
    error: row.error,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export async function createProspectingBatch(input) {
  if (input.teamId) await requireTenantAccess(input.teamId, input.tenantId || defaultTenant.id);
  const batch = normalizeBatch(input);
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into prospecting_batches
       (id, tenant_id, name, query, category, city, provider, status, max_results,
        enrich_hunter, enrich_apollo, target_roles, preview_results, counts, error, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)`,
      [
        batch.id,
        batch.tenantId,
        batch.name,
        batch.query,
        batch.category,
        batch.city,
        batch.provider,
        batch.status,
        batch.maxResults,
        batch.enrichHunter,
        batch.enrichApollo,
        JSON.stringify(batch.targetRoles),
        JSON.stringify(batch.previewResults),
        JSON.stringify(batch.counts),
        batch.error,
        batch.createdAt,
        batch.updatedAt
      ]
    );
    return batch;
  }

  const store = await readFileStore();
  store.prospectingBatches.unshift(batch);
  await writeFileStore(store);
  return batch;
}

export async function listProspectingBatches({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select prospecting_batches.*
           from prospecting_batches
           join tenants on tenants.id = prospecting_batches.tenant_id
           where tenants.team_id = $1
           order by prospecting_batches.created_at desc
           limit 100`,
          [teamId]
        )
      : await pool.query("select * from prospecting_batches order by created_at desc limit 100");
    return result.rows.map(mapBatchRow);
  }
  const store = await readFileStore();
  return filterByTeamTenant(store.prospectingBatches.map(normalizeBatch), teamId);
}

export async function getProspectingBatch(batchId, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select prospecting_batches.*
           from prospecting_batches
           join tenants on tenants.id = prospecting_batches.tenant_id
           where prospecting_batches.id = $1 and tenants.team_id = $2`,
          [batchId, teamId]
        )
      : await pool.query("select * from prospecting_batches where id = $1", [batchId]);
    return result.rows[0] ? mapBatchRow(result.rows[0]) : null;
  }
  const store = await readFileStore();
  const batch = store.prospectingBatches.find((item) => item.id === batchId);
  if (!batch) return null;
  const normalized = normalizeBatch(batch);
  const allowed = await filterByTeamTenant([normalized], teamId);
  return allowed[0] || null;
}

export async function updateProspectingBatch(batchId, updates, { teamId } = {}) {
  const pool = await ensureSchema();
  const normalizedUpdates = {
    ...updates,
    updatedAt: now()
  };

  if (pool) {
    await pool.query(
      `update prospecting_batches set
        status = coalesce($2, status),
        preview_results = coalesce($3::jsonb, preview_results),
        counts = coalesce($4::jsonb, counts),
        error = coalesce($5, error),
        updated_at = now()
       where id = $1
         and ($6::text is null or exists (
           select 1 from tenants
           where tenants.id = prospecting_batches.tenant_id
             and tenants.team_id = $6
         ))`,
      [
        batchId,
        normalizedUpdates.status || null,
        normalizedUpdates.previewResults ? JSON.stringify(normalizedUpdates.previewResults) : null,
        normalizedUpdates.counts ? JSON.stringify(normalizedUpdates.counts) : null,
        normalizedUpdates.error === undefined ? null : normalizedUpdates.error,
        teamId || null
      ]
    );
    return getProspectingBatch(batchId, { teamId });
  }

  const store = await readFileStore();
  const allowedTenantIds = await listTeamTenantIds(teamId);
  store.prospectingBatches = store.prospectingBatches.map((batch) =>
    batch.id === batchId && (!allowedTenantIds || allowedTenantIds.has(batch.tenantId))
      ? normalizeBatch({ ...batch, ...normalizedUpdates })
      : batch
  );
  await writeFileStore(store);
  return getProspectingBatch(batchId, { teamId });
}

export async function listContractors({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query("select * from contractors where team_id = $1 order by created_at desc", [teamId])
      : await pool.query("select * from contractors order by created_at desc");
    return result.rows;
  }
  const store = await readFileStore();
  return store.contractors
    .map((contractor) => withTeamId(contractor, contractor.teamId))
    .filter((contractor) => !teamId || contractor.teamId === teamId);
}

export async function createContractor(input) {
  const teamId = requireTeamId(input.teamId);
  const contractor = {
    id: id("contractor"),
    teamId,
    name: input.name,
    email: input.email || "",
    phone: input.phone || "",
    serviceArea: input.serviceArea || "",
    availabilityNotes: input.availabilityNotes || "",
    weeklyCapacity: Number(input.weeklyCapacity || 0),
    rateNotes: input.rateNotes || "",
    active: true,
    createdAt: now()
  };
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `insert into contractors
       (id, team_id, name, email, phone, service_area, availability_notes, weekly_capacity, rate_notes, active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        contractor.id,
        teamId,
        contractor.name,
        contractor.email,
        contractor.phone,
        contractor.serviceArea,
        contractor.availabilityNotes,
        contractor.weeklyCapacity,
        contractor.rateNotes,
        contractor.active
      ]
    );
    return contractor;
  }
  const store = await readFileStore();
  store.contractors.unshift(contractor);
  await writeFileStore(store);
  return contractor;
}

export async function createDraftEmail(input) {
  const teamId = await resolveTeamIdForTenant(input.tenantId, input.teamId);
  const draft = {
    id: id("draft"),
    teamId,
    leadId: input.leadId,
    tenantId: input.tenantId,
    subject: input.subject,
    body: input.body,
    status: "draft",
    createdAt: now()
  };
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      "insert into draft_emails (id, team_id, lead_id, tenant_id, subject, body, status) values ($1,$2,$3,$4,$5,$6,$7)",
      [draft.id, teamId, draft.leadId, draft.tenantId, draft.subject, draft.body, draft.status]
    );
    return draft;
  }
  const store = await readFileStore();
  store.draftEmails.unshift(draft);
  await writeFileStore(store);
  return draft;
}

export async function listDraftEmails({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query("select * from draft_emails where team_id = $1 order by created_at desc limit 500", [teamId])
      : await pool.query("select * from draft_emails order by created_at desc limit 500");
    return result.rows;
  }
  const store = await readFileStore();
  return store.draftEmails
    .map((draft) => withTeamId(draft, draft.teamId))
    .filter((draft) => !teamId || draft.teamId === teamId);
}

function normalizeTemplate(input = {}) {
  return {
    id: input.id || id("template"),
    tenantId: input.tenantId || input.tenant_id || "",
    name: input.name || "Untitled Template",
    subject: input.subject || "",
    body: input.body || "",
    category: input.category || "",
    offerType: input.offerType || input.offer_type || "",
    isActive: input.isActive ?? input.is_active ?? true,
    system: Boolean(input.system),
    createdAt: input.createdAt || input.created_at?.toISOString?.() || input.created_at || now(),
    updatedAt: input.updatedAt || input.updated_at?.toISOString?.() || input.updated_at || now()
  };
}

function withDefaultTemplates(templates = []) {
  const existing = new Set(templates.map((template) => template.id));
  return [
    ...templates,
    ...defaultOutreachTemplates.filter((template) => !existing.has(template.id)).map(normalizeTemplate)
  ];
}

export async function listOutreachTemplates({ includeDefaults = true, teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_templates.*
           from outreach_templates
           join tenants on tenants.id = outreach_templates.tenant_id
           where tenants.team_id = $1
           order by outreach_templates.updated_at desc`,
          [teamId]
        )
      : await pool.query("select * from outreach_templates order by updated_at desc");
    const templates = result.rows.map(normalizeTemplate);
    return includeDefaults ? withDefaultTemplates(templates) : templates;
  }
  const store = await readFileStore();
  const templates = await filterByTeamTenant(store.outreachTemplates.map(normalizeTemplate), teamId);
  return includeDefaults ? withDefaultTemplates(templates) : templates;
}

export async function createOutreachTemplate(input) {
  if (input.teamId) await requireTenantAccess(input.teamId, input.tenantId);
  const template = normalizeTemplate({
    ...input,
    id: input.id || id("template"),
    createdAt: now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into outreach_templates
       (id, tenant_id, name, subject, body, category, offer_type, is_active, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        template.id,
        template.tenantId,
        template.name,
        template.subject,
        template.body,
        template.category,
        template.offerType,
        template.isActive,
        template.createdAt,
        template.updatedAt
      ]
    );
    return template;
  }

  const store = await readFileStore();
  store.outreachTemplates.unshift(template);
  await writeFileStore(store);
  return template;
}

export async function updateOutreachTemplate(templateId, updates, { teamId } = {}) {
  const pool = await ensureSchema();
  const updatedAt = now();

  if (pool) {
    await pool.query(
      `update outreach_templates set
        name = coalesce($2, name),
        subject = coalesce($3, subject),
        body = coalesce($4, body),
        category = coalesce($5, category),
       offer_type = coalesce($6, offer_type),
       is_active = coalesce($7, is_active),
       updated_at = $8
       where id = $1
         and ($9::text is null or exists (
           select 1 from tenants
           where tenants.id = outreach_templates.tenant_id
             and tenants.team_id = $9
         ))`,
      [
        templateId,
        updates.name ?? null,
        updates.subject ?? null,
        updates.body ?? null,
        updates.category ?? null,
        updates.offerType ?? null,
        updates.isActive === undefined ? null : Boolean(updates.isActive),
        updatedAt,
        teamId || null
      ]
    );
    return (await listOutreachTemplates({ includeDefaults: false, teamId })).find((item) => item.id === templateId) || null;
  }

  const store = await readFileStore();
  const allowedTenantIds = await listTeamTenantIds(teamId);
  store.outreachTemplates = store.outreachTemplates.map((template) =>
    template.id === templateId && (!allowedTenantIds || allowedTenantIds.has(template.tenantId))
      ? normalizeTemplate({ ...template, ...updates, updatedAt })
      : template
  );
  await writeFileStore(store);
  return store.outreachTemplates.find((item) => item.id === templateId) || null;
}

function normalizeCampaign(input = {}) {
  const status = campaignStatuses.includes(input.status) ? input.status : "draft";
  return {
    id: input.id || id("campaign"),
    tenantId: input.tenantId || input.tenant_id || defaultTenant.id,
    name: input.name || "Untitled Campaign",
    description: input.description || "",
    status,
    sourceFilter: input.sourceFilter || input.source_filter || "",
    cityFilter: input.cityFilter || input.city_filter || "",
    categoryFilter: input.categoryFilter || input.category_filter || "",
    dailySendCap: Number(input.dailySendCap ?? input.daily_send_cap ?? 25),
    perDomainDailyCap: Number(input.perDomainDailyCap ?? input.per_domain_daily_cap ?? 1),
    followUpTemplateId: input.followUpTemplateId || input.follow_up_template_id || "",
    followUpDelayDays: Number(input.followUpDelayDays ?? input.follow_up_delay_days ?? 3),
    testMode: coerceBool(input.testMode ?? input.test_mode),
    createdAt: input.createdAt || input.created_at?.toISOString?.() || input.created_at || now(),
    updatedAt: input.updatedAt || input.updated_at?.toISOString?.() || input.updated_at || now()
  };
}

export async function listOutreachCampaigns({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_campaigns.*
           from outreach_campaigns
           join tenants on tenants.id = outreach_campaigns.tenant_id
           where tenants.team_id = $1
           order by outreach_campaigns.updated_at desc`,
          [teamId]
        )
      : await pool.query("select * from outreach_campaigns order by updated_at desc");
    return result.rows.map(normalizeCampaign);
  }
  const store = await readFileStore();
  return filterByTeamTenant(store.outreachCampaigns.map(normalizeCampaign), teamId);
}

export async function createOutreachCampaign(input) {
  if (input.teamId) await requireTenantAccess(input.teamId, input.tenantId || defaultTenant.id);
  const campaign = normalizeCampaign({
    ...input,
    id: input.id || id("campaign"),
    createdAt: now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into outreach_campaigns
       (id, tenant_id, name, description, status, source_filter, city_filter, category_filter,
        daily_send_cap, per_domain_daily_cap, follow_up_template_id, follow_up_delay_days, test_mode,
        created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        campaign.id,
        campaign.tenantId,
        campaign.name,
        campaign.description,
        campaign.status,
        campaign.sourceFilter,
        campaign.cityFilter,
        campaign.categoryFilter,
        campaign.dailySendCap,
        campaign.perDomainDailyCap,
        campaign.followUpTemplateId || null,
        campaign.followUpDelayDays,
        campaign.testMode,
        campaign.createdAt,
        campaign.updatedAt
      ]
    );
    return campaign;
  }

  const store = await readFileStore();
  store.outreachCampaigns.unshift(campaign);
  await writeFileStore(store);
  return campaign;
}

export async function updateOutreachCampaign(campaignId, updates, { teamId } = {}) {
  const pool = await ensureSchema();
  const updatedAt = now();

  if (pool) {
    await pool.query(
      `update outreach_campaigns set
        name = coalesce($2, name),
        description = coalesce($3, description),
        status = coalesce($4, status),
        source_filter = coalesce($5, source_filter),
        city_filter = coalesce($6, city_filter),
        category_filter = coalesce($7, category_filter),
        daily_send_cap = coalesce($8, daily_send_cap),
        per_domain_daily_cap = coalesce($9, per_domain_daily_cap),
        follow_up_template_id = coalesce($10, follow_up_template_id),
        follow_up_delay_days = coalesce($11, follow_up_delay_days),
        test_mode = coalesce($12, test_mode),
        updated_at = $13
       where id = $1
         and ($14::text is null or exists (
           select 1 from tenants
           where tenants.id = outreach_campaigns.tenant_id
             and tenants.team_id = $14
         ))`,
      [
        campaignId,
        updates.name ?? null,
        updates.description ?? null,
        updates.status ?? null,
        updates.sourceFilter ?? null,
        updates.cityFilter ?? null,
        updates.categoryFilter ?? null,
        updates.dailySendCap === undefined ? null : Number(updates.dailySendCap),
        updates.perDomainDailyCap === undefined ? null : Number(updates.perDomainDailyCap),
        updates.followUpTemplateId === undefined ? null : (updates.followUpTemplateId || null),
        updates.followUpDelayDays === undefined ? null : Number(updates.followUpDelayDays),
        updates.testMode === undefined ? null : coerceBool(updates.testMode),
        updatedAt,
        teamId || null
      ]
    );
    return (await listOutreachCampaigns({ teamId })).find((item) => item.id === campaignId) || null;
  }

  const store = await readFileStore();
  const allowedTenantIds = await listTeamTenantIds(teamId);
  store.outreachCampaigns = store.outreachCampaigns.map((campaign) =>
    campaign.id === campaignId && (!allowedTenantIds || allowedTenantIds.has(campaign.tenantId))
      ? normalizeCampaign({ ...campaign, ...updates, updatedAt })
      : campaign
  );
  await writeFileStore(store);
  return store.outreachCampaigns.find((item) => item.id === campaignId) || null;
}

function normalizeQueueItem(input = {}) {
  const status = outreachQueueStatuses.includes(input.status) ? input.status : "queued";
  return {
    id: input.id || id("queue"),
    leadId: input.leadId || input.lead_id || "",
    campaignId: input.campaignId || input.campaign_id || "",
    templateId: input.templateId || input.template_id || "",
    tenantId: input.tenantId || input.tenant_id || defaultTenant.id,
    status,
    step: Number(input.step ?? 0) || 0,
    subject: input.subject || "",
    body: input.body || "",
    recipientEmail: input.recipientEmail || input.recipient_email || "",
    senderEmail: input.senderEmail || input.sender_email || "",
    scheduledFor: input.scheduledFor || input.scheduled_for?.toISOString?.() || input.scheduled_for || now(),
    sentAt: input.sentAt || input.sent_at?.toISOString?.() || input.sent_at || "",
    failureReason: input.failureReason || input.failure_reason || "",
    resendMessageId: input.resendMessageId || input.resend_message_id || "",
    createdAt: input.createdAt || input.created_at?.toISOString?.() || input.created_at || now(),
    updatedAt: input.updatedAt || input.updated_at?.toISOString?.() || input.updated_at || now()
  };
}

export async function listOutreachQueue({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_queue.*
           from outreach_queue
           join tenants on tenants.id = outreach_queue.tenant_id
           where tenants.team_id = $1
           order by outreach_queue.created_at desc
           limit 1000`,
          [teamId]
        )
      : await pool.query("select * from outreach_queue order by created_at desc limit 1000");
    return result.rows.map(normalizeQueueItem);
  }
  const store = await readFileStore();
  return filterByTeamTenant(store.outreachQueue.map(normalizeQueueItem), teamId);
}

export async function getOutreachQueueItem(queueId, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_queue.*
           from outreach_queue
           join tenants on tenants.id = outreach_queue.tenant_id
           where outreach_queue.id = $1 and tenants.team_id = $2`,
          [queueId, teamId]
        )
      : await pool.query("select * from outreach_queue where id = $1", [queueId]);
    return result.rows[0] ? normalizeQueueItem(result.rows[0]) : null;
  }
  const store = await readFileStore();
  const item = store.outreachQueue.find((queueItem) => queueItem.id === queueId);
  if (!item) return null;
  const allowed = await filterByTeamTenant([normalizeQueueItem(item)], teamId);
  return allowed[0] || null;
}

/**
 * Atomically claim a queue item by flipping fromStatus -> toStatus. Returns the
 * claimed (normalized) item, or null if it was not in fromStatus (already
 * claimed/sent by a concurrent sender). This is the compare-and-set that closes
 * the double-send race: only one caller can win the transition.
 */
export async function claimOutreachQueueItem(
  queueId,
  { teamId, fromStatus = "approved", toStatus = "sending" } = {}
) {
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      `update outreach_queue set status = $2, updated_at = now()
       where id = $1 and status = $3
         and ($4::text is null or exists (
           select 1 from tenants
           where tenants.id = outreach_queue.tenant_id
             and tenants.team_id = $4
         ))
       returning *`,
      [queueId, toStatus, fromStatus, teamId || null]
    );
    return result.rows[0] ? normalizeQueueItem(result.rows[0]) : null;
  }

  return withStoreLock(async () => {
    const store = await readFileStore();
    const allowedTenantIds = await listTeamTenantIds(teamId);
    const index = store.outreachQueue.findIndex((item) => item.id === queueId);
    if (index < 0) return null;
    const current = normalizeQueueItem(store.outreachQueue[index]);
    if (current.status !== fromStatus) return null;
    if (allowedTenantIds && !allowedTenantIds.has(current.tenantId)) return null;
    const claimed = normalizeQueueItem({ ...current, status: toStatus, updatedAt: now() });
    store.outreachQueue[index] = claimed;
    await writeFileStore(store);
    return claimed;
  });
}

/**
 * List approved queue items whose scheduledFor has passed (the drain's work
 * list). Ordered oldest-first so scheduled sends fire in order; capped so one
 * busy team can't starve others.
 */
export async function listDueQueueItems({ now = new Date(), teamId, limit = 200, status = "approved" } = {}) {
  const cutoff = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const pool = await ensureSchema();
  if (pool) {
    const params = [status, cutoff];
    let where = "outreach_queue.status = $1 and outreach_queue.scheduled_for is not null and outreach_queue.scheduled_for <= $2";
    let join = "";
    if (teamId) {
      params.push(teamId);
      join = "join tenants on tenants.id = outreach_queue.tenant_id";
      where += ` and tenants.team_id = $${params.length}`;
    }
    params.push(limit);
    const result = await pool.query(
      `select outreach_queue.* from outreach_queue ${join}
       where ${where}
       order by outreach_queue.scheduled_for asc
       limit $${params.length}`,
      params
    );
    return result.rows.map(normalizeQueueItem);
  }

  const store = await readFileStore();
  const cutoffMs = new Date(cutoff).getTime();
  const scoped = await filterByTeamTenant(store.outreachQueue.map(normalizeQueueItem), teamId);
  return scoped
    .filter((item) => item.status === status && item.scheduledFor && new Date(item.scheduledFor).getTime() <= cutoffMs)
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
    .slice(0, limit);
}

export async function createOutreachQueueItem(input) {
  if (input.teamId) await requireTenantAccess(input.teamId, input.tenantId || defaultTenant.id);
  const item = normalizeQueueItem({
    ...input,
    id: input.id || id("queue"),
    createdAt: now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into outreach_queue
       (id, lead_id, campaign_id, template_id, tenant_id, status, subject, body, recipient_email, sender_email,
        scheduled_for, sent_at, failure_reason, resend_message_id, step, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        item.id,
        item.leadId,
        item.campaignId || null,
        item.templateId || null,
        item.tenantId,
        item.status,
        item.subject,
        item.body,
        item.recipientEmail,
        item.senderEmail,
        item.scheduledFor || null,
        item.sentAt || null,
        item.failureReason,
        item.resendMessageId,
        item.step || 0,
        item.createdAt,
        item.updatedAt
      ]
    );
    return item;
  }

  const store = await readFileStore();
  store.outreachQueue.unshift(item);
  await writeFileStore(store);
  return item;
}

export async function createOutreachQueueItems(items = []) {
  const created = [];
  for (const item of items) {
    created.push(await createOutreachQueueItem(item));
  }
  return created;
}

export async function updateOutreachQueueItem(queueId, updates, { teamId } = {}) {
  const pool = await ensureSchema();
  const updatedAt = now();

  if (pool) {
    await pool.query(
      `update outreach_queue set
        status = coalesce($2, status),
        scheduled_for = coalesce($3, scheduled_for),
        sent_at = coalesce($4, sent_at),
        failure_reason = coalesce($5, failure_reason),
        resend_message_id = coalesce($6, resend_message_id),
        updated_at = $7
       where id = $1
         and ($8::text is null or exists (
           select 1 from tenants
           where tenants.id = outreach_queue.tenant_id
             and tenants.team_id = $8
         ))`,
      [
        queueId,
        updates.status ?? null,
        updates.scheduledFor || null,
        updates.sentAt || null,
        updates.failureReason ?? null,
        updates.resendMessageId ?? null,
        updatedAt,
        teamId || null
      ]
    );
    return getOutreachQueueItem(queueId, { teamId });
  }

  const store = await readFileStore();
  const allowedTenantIds = await listTeamTenantIds(teamId);
  store.outreachQueue = store.outreachQueue.map((item) =>
    item.id === queueId && (!allowedTenantIds || allowedTenantIds.has(item.tenantId))
      ? normalizeQueueItem({ ...item, ...updates, updatedAt })
      : item
  );
  await writeFileStore(store);
  return getOutreachQueueItem(queueId, { teamId });
}

function normalizeSuppression(input = {}) {
  const reason = suppressionReasons.includes(input.reason) ? input.reason : "manual";
  return {
    id: input.id || id("suppress"),
    tenantId: input.tenantId || input.tenant_id || "",
    email: String(input.email || "").trim().toLowerCase(),
    domain: String(input.domain || "").trim().toLowerCase(),
    reason,
    createdAt: input.createdAt || input.created_at?.toISOString?.() || input.created_at || now()
  };
}

export async function listOutreachSuppressions({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_suppression_list.*
           from outreach_suppression_list
           left join tenants on tenants.id = outreach_suppression_list.tenant_id
           where outreach_suppression_list.tenant_id is null
              or tenants.team_id = $1
           order by outreach_suppression_list.created_at desc`,
          [teamId]
        )
      : await pool.query("select * from outreach_suppression_list order by created_at desc");
    return result.rows.map(normalizeSuppression);
  }
  const store = await readFileStore();
  const suppressions = store.outreachSuppressionList.map(normalizeSuppression);
  const tenantIds = await listTeamTenantIds(teamId);
  if (!tenantIds) return suppressions;
  return suppressions.filter((item) => !item.tenantId || tenantIds.has(item.tenantId));
}

export async function createOutreachSuppression(input) {
  if (input.teamId && input.tenantId) await requireTenantAccess(input.teamId, input.tenantId);
  const suppression = normalizeSuppression({
    ...input,
    id: input.id || id("suppress"),
    createdAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into outreach_suppression_list (id, tenant_id, email, domain, reason, created_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        suppression.id,
        suppression.tenantId || null,
        suppression.email || null,
        suppression.domain || null,
        suppression.reason,
        suppression.createdAt
      ]
    );
    return suppression;
  }

  const store = await readFileStore();
  const duplicate = store.outreachSuppressionList.find((item) =>
    (suppression.email && item.email === suppression.email) ||
    (suppression.domain && item.domain === suppression.domain)
  );
  if (duplicate) return normalizeSuppression(duplicate);
  store.outreachSuppressionList.unshift(suppression);
  await writeFileStore(store);
  return suppression;
}

function normalizeEvent(input = {}) {
  const type = outreachEventTypes.includes(input.type) ? input.type : "drafted";
  return {
    id: input.id || id("event"),
    leadId: input.leadId || input.lead_id || "",
    queueId: input.queueId || input.queue_id || "",
    campaignId: input.campaignId || input.campaign_id || "",
    type,
    metadata: input.metadata || {},
    createdAt: input.createdAt || input.created_at?.toISOString?.() || input.created_at || now()
  };
}

export async function listOutreachEvents({ teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = teamId
      ? await pool.query(
          `select outreach_events.*
           from outreach_events
           join leads on leads.id = outreach_events.lead_id
           where leads.team_id = $1
           order by outreach_events.created_at desc
           limit 1000`,
          [teamId]
        )
      : await pool.query("select * from outreach_events order by created_at desc limit 1000");
    return result.rows.map(normalizeEvent);
  }
  const store = await readFileStore();
  const events = store.outreachEvents.map(normalizeEvent);
  if (!teamId) return events;
  const leads = await listLeads({ teamId });
  const leadIds = new Set(leads.map((lead) => lead.id));
  return events.filter((event) => leadIds.has(event.leadId));
}

export async function createOutreachEvent(input) {
  if (input.teamId && input.leadId) {
    const leads = await listLeads({ teamId: input.teamId });
    if (!leads.some((lead) => lead.id === input.leadId)) {
      throw new Error("Lead is not available to this team.");
    }
  }
  const event = normalizeEvent({
    ...input,
    id: input.id || id("event"),
    createdAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into outreach_events (id, lead_id, queue_id, campaign_id, type, metadata, created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [
        event.id,
        event.leadId,
        event.queueId || null,
        event.campaignId || null,
        event.type,
        JSON.stringify(event.metadata || {}),
        event.createdAt
      ]
    );
    return event;
  }

  const store = await readFileStore();
  store.outreachEvents.unshift(event);
  await writeFileStore(store);
  return event;
}

// ---------------------------------------------------------------------------
// Telephony: calls, call events, and tenant phone-number lookup.
// Config (setup) lives on the tenant; activity lives here in calls/call_events.
// ---------------------------------------------------------------------------

function normalizeCall(input = {}) {
  return {
    id: input.id,
    teamId: input.teamId || DEFAULT_TEAM_ID,
    tenantId: input.tenantId || "",
    leadId: input.leadId || "",
    campaignId: input.campaignId || "",
    batchId: input.batchId || "",
    outreachMessageId: input.outreachMessageId || "",
    provider: input.provider || "twilio",
    providerCallId: input.providerCallId || "",
    direction: input.direction || "outbound",
    fromNumber: input.fromNumber || "",
    toNumber: input.toNumber || "",
    tenantNumber: input.tenantNumber || "",
    assignedUserId: input.assignedUserId || "",
    status: input.status || "ringing",
    outcome: input.outcome || "",
    durationSeconds: input.durationSeconds === undefined || input.durationSeconds === null
      ? null
      : Number(input.durationSeconds),
    recordingUrl: input.recordingUrl || "",
    transcript: input.transcript || "",
    aiSummary: input.aiSummary || "",
    startedAt: input.startedAt || "",
    endedAt: input.endedAt || "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

function mapCallRow(row) {
  return normalizeCall({
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id,
    leadId: row.lead_id || "",
    campaignId: row.campaign_id || "",
    batchId: row.batch_id || "",
    outreachMessageId: row.outreach_message_id || "",
    provider: row.provider,
    providerCallId: row.provider_call_id || "",
    direction: row.direction,
    fromNumber: row.from_number || "",
    toNumber: row.to_number || "",
    tenantNumber: row.tenant_number || "",
    assignedUserId: row.assigned_user_id || "",
    status: row.status,
    outcome: row.outcome || "",
    durationSeconds: row.duration_seconds,
    recordingUrl: row.recording_url || "",
    transcript: row.transcript || "",
    aiSummary: row.ai_summary || "",
    startedAt: row.started_at?.toISOString?.() || row.started_at || "",
    endedAt: row.ended_at?.toISOString?.() || row.ended_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export async function getCalls({ teamId, tenantId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const clauses = [];
    const params = [];
    if (teamId) {
      params.push(teamId);
      clauses.push(`team_id = $${params.length}`);
    }
    if (tenantId) {
      params.push(tenantId);
      clauses.push(`tenant_id = $${params.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(`select * from calls ${where} order by created_at desc limit 1000`, params);
    return result.rows.map(mapCallRow);
  }
  const store = await readFileStore();
  return store.calls
    .map(normalizeCall)
    .filter((call) => !teamId || (call.teamId || DEFAULT_TEAM_ID) === teamId)
    .filter((call) => !tenantId || call.tenantId === tenantId);
}

export async function getCallsForLead(leadId) {
  if (!leadId) return [];
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      "select * from calls where lead_id = $1 order by created_at desc limit 500",
      [leadId]
    );
    return result.rows.map(mapCallRow);
  }
  const store = await readFileStore();
  return store.calls.map(normalizeCall).filter((call) => call.leadId === leadId);
}

export async function getCallById(callId) {
  if (!callId) return null;
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query("select * from calls where id = $1 limit 1", [callId]);
    return result.rows[0] ? mapCallRow(result.rows[0]) : null;
  }
  const store = await readFileStore();
  return store.calls.map(normalizeCall).find((call) => call.id === callId) || null;
}

export async function getCallByProviderId(providerCallId) {
  if (!providerCallId) return null;
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      "select * from calls where provider_call_id = $1 order by created_at desc limit 1",
      [providerCallId]
    );
    return result.rows[0] ? mapCallRow(result.rows[0]) : null;
  }
  const store = await readFileStore();
  return store.calls.map(normalizeCall).find((call) => call.providerCallId === providerCallId) || null;
}

export async function createCall(input) {
  const call = normalizeCall({
    ...input,
    id: input.id || id("call"),
    createdAt: input.createdAt || now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into calls
       (id, team_id, tenant_id, lead_id, campaign_id, batch_id, outreach_message_id, provider, provider_call_id,
        direction, from_number, to_number, tenant_number, assigned_user_id, status, outcome, duration_seconds,
        recording_url, transcript, ai_summary, started_at, ended_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        call.id,
        call.teamId,
        call.tenantId,
        call.leadId || null,
        call.campaignId || null,
        call.batchId || null,
        call.outreachMessageId || null,
        call.provider,
        call.providerCallId || null,
        call.direction,
        call.fromNumber || null,
        call.toNumber || null,
        call.tenantNumber || null,
        call.assignedUserId || null,
        call.status,
        call.outcome || null,
        call.durationSeconds,
        call.recordingUrl || null,
        call.transcript || null,
        call.aiSummary || null,
        call.startedAt || null,
        call.endedAt || null,
        call.createdAt,
        call.updatedAt
      ]
    );
    return call;
  }

  const store = await readFileStore();
  store.calls.unshift(call);
  await writeFileStore(store);
  return call;
}

export async function updateCall(callId, updates = {}) {
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `update calls set
        status = coalesce($2, status),
        outcome = coalesce($3, outcome),
        duration_seconds = coalesce($4, duration_seconds),
        recording_url = coalesce($5, recording_url),
        transcript = coalesce($6, transcript),
        ai_summary = coalesce($7, ai_summary),
        provider_call_id = coalesce($8, provider_call_id),
        assigned_user_id = coalesce($9, assigned_user_id),
        started_at = coalesce($10, started_at),
        ended_at = coalesce($11, ended_at),
        lead_id = coalesce($12, lead_id),
        updated_at = now()
       where id = $1
       returning *`,
      [
        callId,
        updates.status ?? null,
        updates.outcome ?? null,
        updates.durationSeconds === undefined || updates.durationSeconds === null
          ? null
          : Number(updates.durationSeconds),
        updates.recordingUrl ?? null,
        updates.transcript ?? null,
        updates.aiSummary ?? null,
        updates.providerCallId ?? null,
        updates.assignedUserId ?? null,
        updates.startedAt || null,
        updates.endedAt || null,
        updates.leadId ?? null
      ]
    );
    return getCallById(callId);
  }

  const store = await readFileStore();
  let updated = null;
  store.calls = store.calls.map((call) => {
    if (call.id !== callId) return call;
    updated = normalizeCall({ ...normalizeCall(call), ...updates, id: call.id, createdAt: call.createdAt, updatedAt: now() });
    return updated;
  });
  await writeFileStore(store);
  return updated;
}

export async function addCallEvent(callId, eventType, payload = {}) {
  const event = {
    id: id("callevent"),
    callId,
    eventType,
    payload: payload && typeof payload === "object" ? payload : {},
    createdAt: now()
  };
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `insert into call_events (id, call_id, event_type, payload, created_at)
       values ($1,$2,$3,$4::jsonb,$5)`,
      [event.id, event.callId, event.eventType, JSON.stringify(event.payload), event.createdAt]
    );
    return event;
  }
  const store = await readFileStore();
  store.callEvents.unshift(event);
  await writeFileStore(store);
  return event;
}

export async function deleteCall(callId) {
  if (!callId) return false;
  const pool = await ensureSchema();
  if (pool) {
    await pool.query("delete from call_events where call_id = $1", [callId]);
    const result = await pool.query("delete from calls where id = $1", [callId]);
    return (result.rowCount || 0) > 0;
  }
  const store = await readFileStore();
  const before = store.calls.length;
  store.calls = store.calls.filter((call) => call.id !== callId);
  store.callEvents = (store.callEvents || []).filter((event) => event.callId !== callId);
  await writeFileStore(store);
  return store.calls.length < before;
}

export async function getCallEventsForCall(callId) {
  if (!callId) return [];
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      "select * from call_events where call_id = $1 order by created_at desc limit 500",
      [callId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      callId: row.call_id,
      eventType: row.event_type,
      payload: row.payload || {},
      createdAt: row.created_at?.toISOString?.() || row.created_at
    }));
  }
  const store = await readFileStore();
  return store.callEvents.filter((event) => event.callId === callId);
}

// Resolve which tenant owns an inbound E.164 number (the dialed "To"). Matches
// against tenant.telephony.phoneNumber, comparing on digits only.
export async function getTenantByPhoneNumber(e164) {
  const target = normalizedPhone(e164);
  if (!target) return null;
  const tenants = await listTenants();
  return (
    tenants.find((tenant) => {
      const number = tenant?.telephony?.phoneNumber;
      return number && normalizedPhone(number) === target;
    }) || null
  );
}

// Return the SETUP telephony config for a tenant (safe defaults if unset).
export async function getTenantTelephony(tenantId) {
  if (!tenantId) return defaultTenantTelephony();
  const tenant = await getTenantByIdOrSlug(tenantId);
  return normalizeTenantTelephony(tenant?.telephony);
}

// ---------------------------------------------------------------------------
// Tasks: minimal follow-up to-dos (introduced for missed-call callbacks). Not a
// full task manager — just enough to surface "needs callback" work.
// ---------------------------------------------------------------------------

function normalizeTask(input = {}) {
  return {
    id: input.id,
    teamId: input.teamId || DEFAULT_TEAM_ID,
    tenantId: input.tenantId || "",
    leadId: input.leadId || "",
    title: input.title || "Follow up",
    priority: input.priority || "normal",
    dueAt: input.dueAt || "",
    assignedToUserId: input.assignedToUserId || "",
    status: input.status || "open",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

function mapTaskRow(row) {
  return normalizeTask({
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id || "",
    leadId: row.lead_id || "",
    title: row.title,
    priority: row.priority,
    dueAt: row.due_at?.toISOString?.() || row.due_at || "",
    assignedToUserId: row.assigned_to_user_id || "",
    status: row.status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export async function listTasks({ teamId, status } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const clauses = [];
    const params = [];
    if (teamId) {
      params.push(teamId);
      clauses.push(`team_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(
      `select * from tasks ${where} order by due_at asc nulls last, created_at desc limit 500`,
      params
    );
    return result.rows.map(mapTaskRow);
  }
  const store = await readFileStore();
  return store.tasks
    .map(normalizeTask)
    .filter((task) => !teamId || (task.teamId || DEFAULT_TEAM_ID) === teamId)
    .filter((task) => !status || task.status === status);
}

export async function createTask(input) {
  const task = normalizeTask({
    ...input,
    id: input.id || id("task"),
    createdAt: input.createdAt || now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into tasks
       (id, team_id, tenant_id, lead_id, title, priority, due_at, assigned_to_user_id, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        task.id,
        task.teamId,
        task.tenantId || null,
        task.leadId || null,
        task.title,
        task.priority,
        task.dueAt || null,
        task.assignedToUserId || null,
        task.status,
        task.createdAt,
        task.updatedAt
      ]
    );
    return task;
  }

  const store = await readFileStore();
  store.tasks.unshift(task);
  await writeFileStore(store);
  return task;
}

export async function updateTask(taskId, updates = {}) {
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `update tasks set
        status = coalesce($2, status),
        title = coalesce($3, title),
        priority = coalesce($4, priority),
        due_at = coalesce($5, due_at),
        assigned_to_user_id = coalesce($6, assigned_to_user_id),
        updated_at = now()
       where id = $1`,
      [
        taskId,
        updates.status ?? null,
        updates.title ?? null,
        updates.priority ?? null,
        updates.dueAt || null,
        updates.assignedToUserId ?? null
      ]
    );
    return;
  }
  const store = await readFileStore();
  store.tasks = store.tasks.map((task) =>
    task.id === taskId ? normalizeTask({ ...normalizeTask(task), ...updates, id: task.id, updatedAt: now() }) : task
  );
  await writeFileStore(store);
}

// ---------------------------------------------------------------------------
// Enterprise Prospecting (account-based / ABM). Directly team-scoped tables.
// target_accounts = a company we're pursuing (NOT a person).
// account_campaigns = a scoped high-ticket creative concept for an account.
// See docs/specs/enterprise-prospecting-module-spec.md and brain note 2C.
// ---------------------------------------------------------------------------

function normalizeTargetAccount(input = {}) {
  return {
    id: input.id,
    teamId: input.teamId || DEFAULT_TEAM_ID,
    tenantId: input.tenantId || "",
    name: input.name || "Untitled Account",
    domain: input.domain || "",
    segment: input.segment || "",
    tier: input.tier === undefined || input.tier === null ? null : Number(input.tier),
    fitScore: input.fitScore === undefined || input.fitScore === null ? null : Number(input.fitScore),
    fitRationale: input.fitRationale || "",
    firmographics: input.firmographics || {},
    signals: Array.isArray(input.signals) ? input.signals : [],
    buyingCommittee: Array.isArray(input.buyingCommittee) ? input.buyingCommittee : [],
    dossier: input.dossier || {},
    sourceType: input.sourceType || "manual",
    gateStatus: input.gateStatus || "sourced",
    dataGaps: Array.isArray(input.dataGaps) ? input.dataGaps : [],
    approvedBy: input.approvedBy || "",
    approvedAt: input.approvedAt || "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

function mapTargetAccountRow(row) {
  return normalizeTargetAccount({
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id || "",
    name: row.name,
    domain: row.domain || "",
    segment: row.segment || "",
    tier: row.tier,
    fitScore: row.fit_score,
    fitRationale: row.fit_rationale || "",
    firmographics: row.firmographics || {},
    signals: row.signals || [],
    buyingCommittee: row.buying_committee || [],
    dossier: row.dossier || {},
    sourceType: row.source_type || "manual",
    gateStatus: row.gate_status || "sourced",
    dataGaps: row.data_gaps || [],
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at?.toISOString?.() || row.approved_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export async function listTargetAccounts({ teamId, gateStatus, segment } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const clauses = [];
    const params = [];
    if (teamId) {
      params.push(teamId);
      clauses.push(`team_id = $${params.length}`);
    }
    if (gateStatus) {
      params.push(gateStatus);
      clauses.push(`gate_status = $${params.length}`);
    }
    if (segment) {
      params.push(segment);
      clauses.push(`segment = $${params.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(
      `select * from target_accounts ${where} order by created_at desc limit 500`,
      params
    );
    return result.rows.map(mapTargetAccountRow);
  }
  const store = await readFileStore();
  return store.targetAccounts
    .map(normalizeTargetAccount)
    .filter((acct) => !teamId || (acct.teamId || DEFAULT_TEAM_ID) === teamId)
    .filter((acct) => !gateStatus || acct.gateStatus === gateStatus)
    .filter((acct) => !segment || acct.segment === segment);
}

export async function getTargetAccountById(accountId, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const result = await pool.query(
      `select * from target_accounts where id = $1 and ($2::text is null or team_id = $2) limit 1`,
      [accountId, teamId || null]
    );
    return result.rows[0] ? mapTargetAccountRow(result.rows[0]) : null;
  }
  const store = await readFileStore();
  const acct = store.targetAccounts.map(normalizeTargetAccount).find((a) => a.id === accountId);
  if (!acct) return null;
  if (teamId && (acct.teamId || DEFAULT_TEAM_ID) !== teamId) return null;
  return acct;
}

export async function createTargetAccount(input) {
  const teamId = requireTeamId(input.teamId);
  const account = normalizeTargetAccount({
    ...input,
    teamId,
    id: input.id || id("account"),
    createdAt: input.createdAt || now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into target_accounts
       (id, team_id, tenant_id, name, domain, segment, tier, fit_score, fit_rationale,
        firmographics, signals, buying_committee, dossier, source_type, gate_status, data_gaps,
        approved_by, approved_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16::jsonb,$17,$18,$19,$20)`,
      [
        account.id,
        account.teamId,
        account.tenantId || null,
        account.name,
        account.domain || null,
        account.segment || null,
        account.tier,
        account.fitScore,
        account.fitRationale || null,
        JSON.stringify(account.firmographics || {}),
        JSON.stringify(account.signals || []),
        JSON.stringify(account.buyingCommittee || []),
        JSON.stringify(account.dossier || {}),
        account.sourceType,
        account.gateStatus,
        JSON.stringify(account.dataGaps || []),
        account.approvedBy || null,
        account.approvedAt || null,
        account.createdAt,
        account.updatedAt
      ]
    );
    return account;
  }

  const store = await readFileStore();
  store.targetAccounts.unshift(account);
  await writeFileStore(store);
  return account;
}

export async function updateTargetAccount(accountId, updates = {}, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `update target_accounts set
        name = coalesce($2, name),
        domain = coalesce($3, domain),
        segment = coalesce($4, segment),
        tier = coalesce($5, tier),
        fit_score = coalesce($6, fit_score),
        fit_rationale = coalesce($7, fit_rationale),
        firmographics = coalesce($8::jsonb, firmographics),
        signals = coalesce($9::jsonb, signals),
        buying_committee = coalesce($10::jsonb, buying_committee),
        dossier = coalesce($11::jsonb, dossier),
        gate_status = coalesce($12, gate_status),
        data_gaps = coalesce($13::jsonb, data_gaps),
        approved_by = coalesce($14, approved_by),
        approved_at = coalesce($15, approved_at),
        updated_at = now()
       where id = $1
         and ($16::text is null or team_id = $16)`,
      [
        accountId,
        updates.name ?? null,
        updates.domain ?? null,
        updates.segment ?? null,
        updates.tier ?? null,
        updates.fitScore ?? null,
        updates.fitRationale ?? null,
        updates.firmographics ? JSON.stringify(updates.firmographics) : null,
        updates.signals ? JSON.stringify(updates.signals) : null,
        updates.buyingCommittee ? JSON.stringify(updates.buyingCommittee) : null,
        updates.dossier ? JSON.stringify(updates.dossier) : null,
        updates.gateStatus ?? null,
        updates.dataGaps ? JSON.stringify(updates.dataGaps) : null,
        updates.approvedBy ?? null,
        updates.approvedAt ?? null,
        teamId || null
      ]
    );
    return getTargetAccountById(accountId, { teamId });
  }

  const store = await readFileStore();
  store.targetAccounts = store.targetAccounts.map((acct) => {
    if (acct.id !== accountId) return acct;
    if (teamId && (acct.teamId || DEFAULT_TEAM_ID) !== teamId) return acct;
    return normalizeTargetAccount({
      ...normalizeTargetAccount(acct),
      ...updates,
      id: acct.id,
      teamId: acct.teamId,
      createdAt: acct.createdAt,
      updatedAt: now()
    });
  });
  await writeFileStore(store);
  return getTargetAccountById(accountId, { teamId });
}

function normalizeAccountCampaign(input = {}) {
  return {
    id: input.id,
    teamId: input.teamId || DEFAULT_TEAM_ID,
    accountId: input.accountId || "",
    name: input.name || "Untitled Campaign",
    bigIdea: input.bigIdea || "",
    deliverables: Array.isArray(input.deliverables) ? input.deliverables : [],
    budgetBand: input.budgetBand || "",
    budgetRationale: input.budgetRationale || "",
    successMetric: input.successMetric || "",
    outreachOpener: input.outreachOpener || "",
    status: input.status || "draft",
    approvedBy: input.approvedBy || "",
    approvedAt: input.approvedAt || "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

function mapAccountCampaignRow(row) {
  return normalizeAccountCampaign({
    id: row.id,
    teamId: row.team_id,
    accountId: row.account_id,
    name: row.name,
    bigIdea: row.big_idea || "",
    deliverables: row.deliverables || [],
    budgetBand: row.budget_band || "",
    budgetRationale: row.budget_rationale || "",
    successMetric: row.success_metric || "",
    outreachOpener: row.outreach_opener || "",
    status: row.status || "draft",
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at?.toISOString?.() || row.approved_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at
  });
}

export async function listAccountCampaigns({ teamId, accountId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    const clauses = [];
    const params = [];
    if (teamId) {
      params.push(teamId);
      clauses.push(`team_id = $${params.length}`);
    }
    if (accountId) {
      params.push(accountId);
      clauses.push(`account_id = $${params.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(
      `select * from account_campaigns ${where} order by created_at desc limit 500`,
      params
    );
    return result.rows.map(mapAccountCampaignRow);
  }
  const store = await readFileStore();
  return store.accountCampaigns
    .map(normalizeAccountCampaign)
    .filter((c) => !teamId || (c.teamId || DEFAULT_TEAM_ID) === teamId)
    .filter((c) => !accountId || c.accountId === accountId);
}

export async function createAccountCampaign(input) {
  const teamId = requireTeamId(input.teamId);
  const campaign = normalizeAccountCampaign({
    ...input,
    teamId,
    id: input.id || id("campaign"),
    createdAt: input.createdAt || now(),
    updatedAt: now()
  });
  const pool = await ensureSchema();

  if (pool) {
    await pool.query(
      `insert into account_campaigns
       (id, team_id, account_id, name, big_idea, deliverables, budget_band, budget_rationale,
        success_metric, outreach_opener, status, approved_by, approved_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        campaign.id,
        campaign.teamId,
        campaign.accountId,
        campaign.name,
        campaign.bigIdea || null,
        JSON.stringify(campaign.deliverables || []),
        campaign.budgetBand || null,
        campaign.budgetRationale || null,
        campaign.successMetric || null,
        campaign.outreachOpener || null,
        campaign.status,
        campaign.approvedBy || null,
        campaign.approvedAt || null,
        campaign.createdAt,
        campaign.updatedAt
      ]
    );
    return campaign;
  }

  const store = await readFileStore();
  store.accountCampaigns.unshift(campaign);
  await writeFileStore(store);
  return campaign;
}

export async function updateAccountCampaign(campaignId, updates = {}, { teamId } = {}) {
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `update account_campaigns set
        name = coalesce($2, name),
        big_idea = coalesce($3, big_idea),
        deliverables = coalesce($4::jsonb, deliverables),
        budget_band = coalesce($5, budget_band),
        budget_rationale = coalesce($6, budget_rationale),
        success_metric = coalesce($7, success_metric),
        outreach_opener = coalesce($8, outreach_opener),
        status = coalesce($9, status),
        approved_by = coalesce($10, approved_by),
        approved_at = coalesce($11, approved_at),
        updated_at = now()
       where id = $1
         and ($12::text is null or team_id = $12)`,
      [
        campaignId,
        updates.name ?? null,
        updates.bigIdea ?? null,
        updates.deliverables ? JSON.stringify(updates.deliverables) : null,
        updates.budgetBand ?? null,
        updates.budgetRationale ?? null,
        updates.successMetric ?? null,
        updates.outreachOpener ?? null,
        updates.status ?? null,
        updates.approvedBy ?? null,
        updates.approvedAt ?? null,
        teamId || null
      ]
    );
    return;
  }
  const store = await readFileStore();
  store.accountCampaigns = store.accountCampaigns.map((c) => {
    if (c.id !== campaignId) return c;
    if (teamId && (c.teamId || DEFAULT_TEAM_ID) !== teamId) return c;
    return normalizeAccountCampaign({
      ...normalizeAccountCampaign(c),
      ...updates,
      id: c.id,
      teamId: c.teamId,
      createdAt: c.createdAt,
      updatedAt: now()
    });
  });
  await writeFileStore(store);
}
