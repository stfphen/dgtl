-- 010: DGTL Core staged import and canonical outreach, Phase 2.
--
-- Additive only. Canonical Stage 2 writes live beside the legacy lead/outreach
-- engine. Existing queues and suppressions are read through compatibility
-- adapters; this migration does not delete, rewrite, or auto-merge legacy data.

alter table import_batches add column if not exists source_type text not null default 'csv';
alter table import_batches add column if not exists uploaded_at timestamptz not null default now();
alter table import_batches add column if not exists total_rows integer not null default 0;
alter table import_batches add column if not exists valid_rows integer not null default 0;
alter table import_batches add column if not exists warning_rows integer not null default 0;
alter table import_batches add column if not exists conflicting_rows integer not null default 0;
alter table import_batches add column if not exists applied_rows integer not null default 0;

alter table import_rows add column if not exists review_state text not null default 'new';
alter table import_rows add column if not exists review_decision text not null default 'review_later';
alter table import_rows add column if not exists decision_metadata jsonb not null default '{}';
alter table import_rows add column if not exists reviewed_by text;
alter table import_rows add column if not exists reviewed_at timestamptz;

create table if not exists import_row_reviews (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  import_batch_id text not null references import_batches(id) on delete cascade,
  import_row_id text not null references import_rows(id) on delete cascade,
  decision text not null,
  actor_user_id text not null,
  before_state jsonb not null default '{}',
  decision_metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table campaigns add column if not exists audience_definition jsonb not null default '{}';
alter table campaigns add column if not exists sequence jsonb not null default '[]';
alter table campaigns add column if not exists sending_identity jsonb not null default '{}';
alter table campaigns add column if not exists approval_state text not null default 'draft';
alter table campaigns add column if not exists personalization_config jsonb not null default '{}';
alter table campaigns add column if not exists metrics jsonb not null default '{}';
alter table campaigns add column if not exists approved_by text;
alter table campaigns add column if not exists approved_at timestamptz;

create table if not exists campaign_members (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  tenant_id text,
  campaign_id text not null references campaigns(id) on delete cascade,
  opportunity_id text not null references opportunities(id) on delete restrict,
  contact_id text not null references contacts(id) on delete restrict,
  import_batch_id text references import_batches(id) on delete set null,
  status text not null default 'active',
  personalization_context jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, opportunity_id, contact_id)
);

alter table messages add column if not exists recipient_email text;
alter table messages add column if not exists sender_email text;
alter table messages add column if not exists personalization_context jsonb not null default '{}';
alter table messages add column if not exists rendered_subject text;
alter table messages add column if not exists rendered_body text;
alter table messages add column if not exists content_hash text;
alter table messages add column if not exists approved_subject text;
alter table messages add column if not exists approved_body text;
alter table messages add column if not exists approved_content_hash text;
alter table messages add column if not exists approved_by text;
alter table messages add column if not exists approved_at timestamptz;
alter table messages add column if not exists idempotency_key text;
alter table messages add column if not exists queue_state text not null default 'not_queued';
alter table messages add column if not exists attempt_count integer not null default 0;
alter table messages add column if not exists max_attempts integer not null default 3;
alter table messages add column if not exists next_attempt_at timestamptz;
alter table messages add column if not exists last_attempt_at timestamptz;
alter table messages add column if not exists locked_at timestamptz;
alter table messages add column if not exists locked_by text;
alter table messages add column if not exists permanent_failure_at timestamptz;
alter table messages add column if not exists dead_lettered_at timestamptz;
alter table messages add column if not exists failure_reason text;
alter table messages add column if not exists provider_metadata jsonb not null default '{}';

create unique index if not exists messages_team_idempotency_idx
  on messages (team_id, idempotency_key) where idempotency_key is not null;
create index if not exists messages_outbox_due_idx
  on messages (queue_state, next_attempt_at, scheduled_at) where queue_state in ('queued', 'retry');

create table if not exists message_delivery_attempts (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  message_id text not null references messages(id) on delete cascade,
  attempt_number integer not null,
  transport text not null,
  status text not null,
  provider_message_id text,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}',
  unique (message_id, attempt_number)
);

create table if not exists contact_suppressions (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  tenant_id text,
  contact_id text references contacts(id) on delete set null,
  normalized_email text,
  normalized_domain text,
  reason text not null,
  source text not null default 'manual',
  provider text,
  external_event_id text,
  metadata jsonb not null default '{}',
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_email is not null or normalized_domain is not null)
);
create unique index if not exists contact_suppressions_email_idx
  on contact_suppressions (team_id, normalized_email) where active and normalized_email is not null;
create unique index if not exists contact_suppressions_domain_idx
  on contact_suppressions (team_id, normalized_domain) where active and normalized_domain is not null;

create table if not exists provider_events (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  message_id text references messages(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  payload_reference text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (team_id, provider, provider_event_id)
);

create table if not exists inbound_replies (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  message_id text references messages(id) on delete set null,
  contact_id text references contacts(id) on delete set null,
  company_id text references companies(id) on delete set null,
  opportunity_id text references opportunities(id) on delete set null,
  campaign_id text references campaigns(id) on delete set null,
  provider text,
  provider_message_id text,
  in_reply_to text,
  normalized_sender text,
  association_state text not null default 'unresolved',
  candidate_message_ids jsonb not null default '[]',
  received_at timestamptz not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operation_exceptions (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  exception_type text not null,
  severity text not null default 'warning',
  source_entity_type text not null,
  source_entity_id text not null,
  status text not null default 'open',
  summary text not null,
  details jsonb not null default '{}',
  assigned_to text,
  resolved_by text,
  resolved_at timestamptz,
  resolution jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operation_exceptions_team_status_idx
  on operation_exceptions (team_id, status, created_at desc);

-- Team-aware joins on the relationship tables prevent a caller from composing
-- cross-team graphs even if it obtains another team's stable ID. NOT VALID
-- avoids blocking this additive migration on historical inconsistencies while
-- still enforcing the constraints for new rows.
alter table opportunity_contacts add column if not exists team_id text;
update opportunity_contacts oc set team_id = o.team_id
from opportunities o where oc.opportunity_id = o.id and oc.team_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_id_team_unique') then
    alter table companies add constraint companies_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_id_team_unique') then
    alter table contacts add constraint contacts_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunities_id_team_unique') then
    alter table opportunities add constraint opportunities_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaigns_id_team_unique') then
    alter table campaigns add constraint campaigns_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunity_contacts_opportunity_team_fkey') then
    alter table opportunity_contacts add constraint opportunity_contacts_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunity_contacts_contact_team_fkey') then
    alter table opportunity_contacts add constraint opportunity_contacts_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
end $$;

create index if not exists campaign_members_team_campaign_idx on campaign_members (team_id, campaign_id);
create index if not exists provider_events_message_idx on provider_events (message_id, occurred_at desc);
create index if not exists inbound_replies_team_state_idx on inbound_replies (team_id, association_state, received_at desc);
create index if not exists import_row_reviews_batch_idx on import_row_reviews (team_id, import_batch_id, created_at desc);
