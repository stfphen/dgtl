-- 009: DGTL Core commercial domain, Phase 1.
--
-- This migration is additive and idempotent. Existing lead, target-account,
-- outreach, telephony, and task tables remain authoritative for their current
-- workflows while the platform moves to the canonical Core graph. The
-- deterministic backfill never merges or deletes legacy rows.

create table if not exists import_batches (
  id text primary key,
  team_id text not null,
  tenant_id text,
  source_filename text,
  source_checksum text,
  status text not null default 'staging',
  column_mapping jsonb not null default '{}',
  row_counts jsonb not null default '{}',
  approved_by text,
  approved_at timestamptz,
  reverted_by text,
  reverted_at timestamptz,
  metadata jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists import_rows (
  id text primary key,
  team_id text not null,
  import_batch_id text not null references import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}',
  normalized_data jsonb not null default '{}',
  duplicate_candidates jsonb not null default '[]',
  validation_errors jsonb not null default '[]',
  before_state jsonb not null default '{}',
  applied_changes jsonb not null default '{}',
  status text not null default 'staged',
  imported_entity_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create table if not exists companies (
  id text primary key,
  team_id text not null,
  tenant_id text,
  legal_name text,
  display_name text not null,
  normalized_domain text,
  website_url text,
  industry text,
  category text,
  address_line text,
  city text,
  region text,
  country text,
  source text,
  owner_user_id text,
  relationship_status text not null default 'prospect',
  research_summary text,
  legacy_source_type text,
  legacy_source_id text,
  import_batch_id text references import_batches(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists contacts (
  id text primary key,
  team_id text not null,
  tenant_id text,
  company_id text references companies(id) on delete set null,
  first_name text,
  last_name text,
  full_name text,
  title text,
  role text,
  email text,
  normalized_email text,
  phone text,
  linkedin_url text,
  social_urls jsonb not null default '{}',
  source text,
  deliverability_state text not null default 'unknown',
  consent_state text not null default 'unknown',
  suppression_state text not null default 'active',
  owner_user_id text,
  legacy_source_type text,
  legacy_source_id text,
  import_batch_id text references import_batches(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists opportunities (
  id text primary key,
  team_id text not null,
  tenant_id text,
  company_id text not null references companies(id) on delete restrict,
  primary_contact_id text references contacts(id) on delete set null,
  name text not null,
  stage text not null default 'new',
  estimated_value numeric(14,2),
  currency text not null default 'CAD',
  owner_user_id text,
  qualification jsonb not null default '{}',
  approach_angle text,
  offer text,
  entry_offer text,
  next_action text,
  next_action_at timestamptz,
  source text,
  status text not null default 'open',
  legacy_source_type text,
  legacy_source_id text,
  import_batch_id text references import_batches(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists opportunity_contacts (
  opportunity_id text not null references opportunities(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, contact_id)
);

create unique index if not exists opportunity_contacts_one_primary_idx
  on opportunity_contacts (opportunity_id) where is_primary;

create table if not exists research_records (
  id text primary key,
  team_id text not null,
  tenant_id text,
  company_id text references companies(id) on delete cascade,
  opportunity_id text references opportunities(id) on delete cascade,
  source_url text,
  source_type text not null,
  content text not null,
  signal_category text,
  structured_data jsonb not null default '{}',
  captured_at timestamptz not null default now(),
  author_type text,
  author_id text,
  confidence text,
  verification_status text not null default 'unverified',
  legacy_source_type text,
  legacy_source_id text,
  import_batch_id text references import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_id is not null or opportunity_id is not null),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists campaigns (
  id text primary key,
  team_id text not null,
  tenant_id text,
  opportunity_id text references opportunities(id) on delete set null,
  name text not null,
  kind text not null default 'outreach',
  status text not null default 'draft',
  owner_user_id text,
  source text,
  legacy_source_type text,
  legacy_source_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists messages (
  id text primary key,
  team_id text not null,
  tenant_id text,
  opportunity_id text references opportunities(id) on delete set null,
  campaign_id text references campaigns(id) on delete set null,
  contact_id text references contacts(id) on delete set null,
  channel text not null default 'email',
  direction text not null default 'outbound',
  subject text,
  body text,
  status text not null default 'draft',
  provider text,
  external_message_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  legacy_source_type text,
  legacy_source_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

create table if not exists generation_jobs (
  id text primary key,
  team_id text not null,
  tenant_id text,
  company_id text references companies(id) on delete set null,
  opportunity_id text references opportunities(id) on delete set null,
  requested_tool text not null,
  requested_skill text,
  brief jsonb not null default '{}',
  status text not null default 'queued',
  created_by text,
  started_at timestamptz,
  completed_at timestamptz,
  error_metadata jsonb not null default '{}',
  result_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_id is not null or opportunity_id is not null)
);

create table if not exists artifacts (
  id text primary key,
  team_id text not null,
  tenant_id text,
  opportunity_id text references opportunities(id) on delete set null,
  company_id text references companies(id) on delete set null,
  generation_job_id text references generation_jobs(id) on delete set null,
  kind text not null,
  slug text,
  source_path text,
  build_commit text,
  deployment_target text,
  deployment_url text,
  version text not null default '1',
  status text not null default 'draft',
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_id is not null or opportunity_id is not null),
  check (kind in ('pitch', 'teaser', 'audit', 'report', 'proposal', 'other'))
);

create table if not exists generation_job_artifacts (
  generation_job_id text not null references generation_jobs(id) on delete cascade,
  artifact_id text not null references artifacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (generation_job_id, artifact_id)
);

create table if not exists external_links (
  id text primary key,
  team_id text not null,
  tenant_id text,
  local_entity_type text not null,
  local_entity_id text not null,
  external_system text not null,
  external_object_type text not null,
  external_id text not null,
  external_url text,
  sync_cursor text,
  sync_state text not null default 'linked',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, local_entity_type, local_entity_id, external_system, external_object_type, external_id)
);

create table if not exists activities (
  id text primary key,
  team_id text not null,
  tenant_id text,
  company_id text references companies(id) on delete set null,
  contact_id text references contacts(id) on delete set null,
  opportunity_id text references opportunities(id) on delete set null,
  campaign_id text references campaigns(id) on delete set null,
  message_id text references messages(id) on delete set null,
  activity_type text not null,
  occurred_at timestamptz not null default now(),
  actor_type text,
  actor_id text,
  summary text,
  metadata jsonb not null default '{}',
  legacy_source_type text,
  legacy_source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, legacy_source_type, legacy_source_id)
);

-- Team isolation and graph traversal indexes.
create index if not exists companies_team_updated_idx on companies (team_id, updated_at desc);
create index if not exists companies_team_domain_idx on companies (team_id, normalized_domain);
create index if not exists contacts_team_updated_idx on contacts (team_id, updated_at desc);
create index if not exists contacts_team_email_idx on contacts (team_id, normalized_email);
create index if not exists contacts_company_idx on contacts (company_id, updated_at desc);
create index if not exists opportunities_team_updated_idx on opportunities (team_id, updated_at desc);
create index if not exists opportunities_company_idx on opportunities (company_id, updated_at desc);
create index if not exists research_company_idx on research_records (company_id, captured_at desc);
create index if not exists research_opportunity_idx on research_records (opportunity_id, captured_at desc);
create index if not exists campaigns_opportunity_idx on campaigns (opportunity_id, updated_at desc);
create index if not exists messages_opportunity_idx on messages (opportunity_id, created_at desc);
create index if not exists artifacts_opportunity_idx on artifacts (opportunity_id, created_at desc);
create index if not exists artifacts_company_idx on artifacts (company_id, created_at desc);
create index if not exists external_links_local_idx on external_links (team_id, local_entity_type, local_entity_id);
create index if not exists generation_jobs_opportunity_idx on generation_jobs (opportunity_id, created_at desc);
create index if not exists activities_opportunity_idx on activities (opportunity_id, occurred_at desc);
create index if not exists activities_company_idx on activities (company_id, occurred_at desc);
create index if not exists import_rows_batch_status_idx on import_rows (import_batch_id, status, row_number);

-- Guarded team FKs keep tenant isolation explicit without changing deletion
-- behavior of existing production records.
do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array[
    'import_batches', 'import_rows', 'companies', 'contacts', 'opportunities',
    'research_records', 'campaigns', 'messages', 'generation_jobs', 'artifacts',
    'external_links', 'activities'
  ] loop
    constraint_name := table_name || '_team_id_fkey';
    if not exists (select 1 from pg_constraint where conname = constraint_name) then
      execute format(
        'alter table %I add constraint %I foreign key (team_id) references teams(id) on delete restrict',
        table_name,
        constraint_name
      );
    end if;
  end loop;
end $$;

-- Safe deterministic legacy backfill. A legacy row gets its own Core record;
-- no domain/email duplicate is automatically merged.
insert into companies (
  id, team_id, tenant_id, display_name, normalized_domain, website_url,
  industry, category, source, owner_user_id, relationship_status,
  research_summary, legacy_source_type, legacy_source_id, metadata,
  created_at, updated_at
)
select
  'company_target_' || target_accounts.id,
  target_accounts.team_id,
  target_accounts.tenant_id,
  target_accounts.name,
  nullif(lower(trim(target_accounts.domain)), ''),
  case when nullif(trim(target_accounts.domain), '') is null then null
       when target_accounts.domain ~* '^https?://' then target_accounts.domain
       else 'https://' || target_accounts.domain end,
  nullif(target_accounts.firmographics ->> 'industry', ''),
  nullif(target_accounts.segment, ''),
  coalesce(nullif(target_accounts.source_type, ''), 'legacy_target_account'),
  null,
  case when target_accounts.gate_status = 'deprioritized' then 'inactive' else 'prospect' end,
  nullif(target_accounts.fit_rationale, ''),
  'target_account',
  target_accounts.id,
  jsonb_build_object('tier', target_accounts.tier, 'fitScore', target_accounts.fit_score,
    'gateStatus', target_accounts.gate_status, 'dataGaps', target_accounts.data_gaps),
  target_accounts.created_at,
  target_accounts.updated_at
from target_accounts
on conflict do nothing;

insert into companies (
  id, team_id, tenant_id, display_name, normalized_domain, website_url,
  industry, category, address_line, city, region, country, source,
  owner_user_id, relationship_status, research_summary,
  legacy_source_type, legacy_source_id, metadata, created_at, updated_at
)
select
  'company_lead_' || leads.id,
  leads.team_id,
  leads.tenant_id,
  coalesce(nullif(trim(leads.business), ''), nullif(trim(leads.name), ''),
    nullif(trim(leads.domain), ''), nullif(trim(leads.email), ''), 'Imported lead'),
  nullif(lower(trim(leads.domain)), ''),
  nullif(trim(leads.website_url), ''),
  nullif(leads.category, ''),
  nullif(leads.category, ''),
  nullif(leads.address, ''),
  nullif(leads.city, ''),
  nullif(leads.region, ''),
  nullif(leads.country, ''),
  coalesce(nullif(leads.source_type, ''), 'legacy_lead'),
  nullif(leads.assigned_to_user_id, ''),
  case when leads.pipeline_status in ('won', 'booked') then 'customer'
       when leads.pipeline_status in ('lost', 'do_not_contact') then 'inactive'
       else 'prospect' end,
  nullif(leads.notes, ''),
  'lead',
  leads.id,
  jsonb_build_object('leadScore', leads.lead_score, 'sourceMetadata', leads.metadata),
  leads.created_at,
  leads.updated_at
from leads
on conflict do nothing;

insert into contacts (
  id, team_id, tenant_id, company_id, full_name, title, email,
  normalized_email, phone, source, deliverability_state, consent_state,
  suppression_state, owner_user_id, legacy_source_type, legacy_source_id,
  metadata, created_at, updated_at
)
select
  'contact_lead_' || leads.id,
  leads.team_id,
  leads.tenant_id,
  'company_lead_' || leads.id,
  nullif(trim(leads.name), ''),
  nullif(trim(leads.contact_title), ''),
  nullif(trim(leads.email), ''),
  nullif(lower(trim(leads.email)), ''),
  nullif(trim(leads.phone), ''),
  coalesce(nullif(leads.source_type, ''), 'legacy_lead'),
  coalesce(nullif(leads.metadata ->> 'emailStatus', ''), 'unknown'),
  case when leads.do_not_contact then 'withdrawn'
       when nullif(leads.consent_source, '') is not null then 'recorded'
       else 'unknown' end,
  case when leads.do_not_contact then 'suppressed' else 'active' end,
  nullif(leads.assigned_to_user_id, ''),
  'lead',
  leads.id,
  jsonb_build_object('preferredContactMethod', leads.preferred_contact_method,
    'doNotCall', leads.do_not_call, 'consentSource', leads.consent_source),
  leads.created_at,
  leads.updated_at
from leads
on conflict do nothing;

insert into opportunities (
  id, team_id, tenant_id, company_id, primary_contact_id, name, stage,
  owner_user_id, qualification, approach_angle, offer, next_action,
  next_action_at, source, status, legacy_source_type, legacy_source_id,
  metadata, created_at, updated_at
)
select
  'opportunity_lead_' || leads.id,
  leads.team_id,
  leads.tenant_id,
  'company_lead_' || leads.id,
  'contact_lead_' || leads.id,
  coalesce(nullif(trim(leads.business), ''), nullif(trim(leads.name), ''), 'Lead opportunity'),
  coalesce(nullif(leads.pipeline_status, ''), nullif(leads.status, ''), 'new'),
  nullif(leads.assigned_to_user_id, ''),
  jsonb_build_object('score', leads.lead_score, 'reason', leads.lead_score_reason),
  nullif(leads.pain_points, ''),
  nullif(leads.recommended_offer, ''),
  nullif(leads.metadata ->> 'nextAction', ''),
  leads.next_follow_up_at,
  coalesce(nullif(leads.source_type, ''), 'legacy_lead'),
  case when leads.pipeline_status in ('won', 'lost', 'do_not_contact') then 'closed' else 'open' end,
  'lead',
  leads.id,
  jsonb_build_object('outreachStatus', leads.outreach_status,
    'enrichmentStatus', leads.enrichment_status, 'replyStatus', leads.reply_status),
  leads.created_at,
  leads.updated_at
from leads
on conflict do nothing;

insert into opportunity_contacts (opportunity_id, contact_id, role, is_primary, created_at)
select 'opportunity_lead_' || leads.id, 'contact_lead_' || leads.id, 'primary', true, leads.created_at
from leads
on conflict do nothing;

insert into opportunities (
  id, team_id, tenant_id, company_id, name, stage, qualification,
  approach_angle, offer, source, status, legacy_source_type,
  legacy_source_id, metadata, created_at, updated_at
)
select
  'opportunity_account_campaign_' || account_campaigns.id,
  account_campaigns.team_id,
  target_accounts.tenant_id,
  'company_target_' || account_campaigns.account_id,
  account_campaigns.name,
  account_campaigns.status,
  jsonb_build_object('budgetBand', account_campaigns.budget_band,
    'budgetRationale', account_campaigns.budget_rationale,
    'successMetric', account_campaigns.success_metric),
  nullif(account_campaigns.big_idea, ''),
  nullif(account_campaigns.deliverables::text, '[]'),
  'legacy_account_campaign',
  case when account_campaigns.status in ('closed', 'won', 'lost') then 'closed' else 'open' end,
  'account_campaign',
  account_campaigns.id,
  jsonb_build_object('outreachOpener', account_campaigns.outreach_opener,
    'approvedBy', account_campaigns.approved_by,
    'approvedAt', account_campaigns.approved_at),
  account_campaigns.created_at,
  account_campaigns.updated_at
from account_campaigns
join target_accounts on target_accounts.id = account_campaigns.account_id
on conflict do nothing;

insert into research_records (
  id, team_id, tenant_id, company_id, opportunity_id, source_url,
  source_type, content, structured_data, captured_at, author_type,
  confidence, verification_status, legacy_source_type, legacy_source_id,
  created_at, updated_at
)
select
  'research_lead_' || leads.id,
  leads.team_id,
  leads.tenant_id,
  'company_lead_' || leads.id,
  'opportunity_lead_' || leads.id,
  nullif(leads.source_url, ''),
  coalesce(nullif(leads.source_type, ''), 'legacy_lead'),
  leads.notes,
  coalesce(leads.metadata -> 'enrichment', '{}'::jsonb),
  leads.updated_at,
  'legacy_import',
  null,
  'unverified',
  'lead',
  leads.id,
  leads.created_at,
  leads.updated_at
from leads
where nullif(trim(leads.notes), '') is not null
   or coalesce(leads.metadata -> 'enrichment', '{}'::jsonb) <> '{}'::jsonb
on conflict do nothing;

insert into research_records (
  id, team_id, tenant_id, company_id, source_type, content,
  structured_data, captured_at, author_type, verification_status,
  legacy_source_type, legacy_source_id, created_at, updated_at
)
select
  'research_target_' || target_accounts.id,
  target_accounts.team_id,
  target_accounts.tenant_id,
  'company_target_' || target_accounts.id,
  'legacy_target_account',
  coalesce(nullif(target_accounts.fit_rationale, ''), 'Legacy target-account dossier'),
  jsonb_build_object('dossier', target_accounts.dossier, 'signals', target_accounts.signals,
    'firmographics', target_accounts.firmographics),
  target_accounts.updated_at,
  'legacy_import',
  'unverified',
  'target_account',
  target_accounts.id,
  target_accounts.created_at,
  target_accounts.updated_at
from target_accounts
where coalesce(target_accounts.dossier, '{}'::jsonb) <> '{}'::jsonb
   or coalesce(target_accounts.signals, '[]'::jsonb) <> '[]'::jsonb
   or nullif(trim(target_accounts.fit_rationale), '') is not null
on conflict do nothing;

insert into campaigns (
  id, team_id, tenant_id, name, kind, status, source,
  legacy_source_type, legacy_source_id, metadata, created_at, updated_at
)
select
  'campaign_outreach_' || outreach_campaigns.id,
  tenants.team_id,
  outreach_campaigns.tenant_id,
  outreach_campaigns.name,
  'outreach',
  outreach_campaigns.status,
  'legacy_outreach',
  'outreach_campaign',
  outreach_campaigns.id,
  jsonb_build_object('description', outreach_campaigns.description,
    'sourceFilter', outreach_campaigns.source_filter,
    'cityFilter', outreach_campaigns.city_filter,
    'categoryFilter', outreach_campaigns.category_filter,
    'dailySendCap', outreach_campaigns.daily_send_cap,
    'perDomainDailyCap', outreach_campaigns.per_domain_daily_cap),
  outreach_campaigns.created_at,
  outreach_campaigns.updated_at
from outreach_campaigns
join tenants on tenants.id = outreach_campaigns.tenant_id
on conflict do nothing;

insert into messages (
  id, team_id, tenant_id, opportunity_id, campaign_id, contact_id,
  channel, direction, subject, body, status, provider,
  external_message_id, scheduled_at, sent_at, legacy_source_type,
  legacy_source_id, metadata, created_at, updated_at
)
select
  'message_outreach_queue_' || outreach_queue.id,
  leads.team_id,
  outreach_queue.tenant_id,
  'opportunity_lead_' || outreach_queue.lead_id,
  case when nullif(outreach_queue.campaign_id, '') is null then null
       when exists (select 1 from outreach_campaigns where outreach_campaigns.id = outreach_queue.campaign_id)
       then 'campaign_outreach_' || outreach_queue.campaign_id
       else null end,
  'contact_lead_' || outreach_queue.lead_id,
  'email',
  'outbound',
  outreach_queue.subject,
  outreach_queue.body,
  outreach_queue.status,
  'resend',
  nullif(outreach_queue.resend_message_id, ''),
  outreach_queue.scheduled_for,
  outreach_queue.sent_at,
  'outreach_queue',
  outreach_queue.id,
  jsonb_build_object('templateId', outreach_queue.template_id,
    'recipientEmail', outreach_queue.recipient_email,
    'senderEmail', outreach_queue.sender_email,
    'failureReason', outreach_queue.failure_reason,
    'step', outreach_queue.step),
  outreach_queue.created_at,
  outreach_queue.updated_at
from outreach_queue
join leads on leads.id = outreach_queue.lead_id
on conflict do nothing;

insert into messages (
  id, team_id, tenant_id, opportunity_id, campaign_id, contact_id,
  channel, direction, subject, body, status, legacy_source_type,
  legacy_source_id, metadata, created_at, updated_at
)
select
  'message_draft_email_' || draft_emails.id,
  draft_emails.team_id,
  draft_emails.tenant_id,
  'opportunity_lead_' || draft_emails.lead_id,
  case when nullif(leads.campaign_id, '') is null then null
       when exists (select 1 from outreach_campaigns where outreach_campaigns.id = leads.campaign_id)
       then 'campaign_outreach_' || leads.campaign_id
       else null end,
  'contact_lead_' || draft_emails.lead_id,
  'email',
  'outbound',
  draft_emails.subject,
  draft_emails.body,
  draft_emails.status,
  'draft_email',
  draft_emails.id,
  '{}'::jsonb,
  draft_emails.created_at,
  draft_emails.created_at
from draft_emails
join leads on leads.id = draft_emails.lead_id
on conflict do nothing;
