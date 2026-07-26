-- Telephony integration, Phase 1: call activity + lead/rep telephony fields.
-- Tenant telephony CONFIG is stored inside tenants.config (jsonb), so no tenant
-- column is needed here. Activity (calls, call_events) lives in dedicated tables.
-- All statements are idempotent so this is safe to re-run.

-- Call activity -------------------------------------------------------------
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

-- Lead telephony fields (all optional, safe defaults) -----------------------
alter table leads add column if not exists assigned_to_user_id text;
alter table leads add column if not exists last_call_at timestamptz;
alter table leads add column if not exists call_status text;
alter table leads add column if not exists preferred_contact_method text;
alter table leads add column if not exists do_not_call boolean not null default false;
alter table leads add column if not exists do_not_contact boolean not null default false;
alter table leads add column if not exists consent_source text;
alter table leads add column if not exists last_opt_out_at timestamptz;
alter table leads add column if not exists phone_country text;

-- Team member (sales rep) telephony settings --------------------------------
-- telephony_role is kept separate from team_memberships.role (the permission
-- role) so the sales/telephony role does not collide with access control.
alter table team_memberships add column if not exists telephony_role text;
alter table team_memberships add column if not exists phone_number text;
alter table team_memberships add column if not exists provider_user_id text;
alter table team_memberships add column if not exists availability_status text not null default 'offline';
alter table team_memberships add column if not exists can_receive_inbound boolean not null default false;
alter table team_memberships add column if not exists can_make_outbound boolean not null default false;
