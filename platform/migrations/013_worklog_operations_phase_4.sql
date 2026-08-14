-- 013: DGTL Core Worklog operations bridge (Stage 4).
--
-- Additive only. Core records integration intent, approval, idempotency, and
-- read-only status snapshots. Worklog remains the sole authority for clients,
-- projects, tasks, time entries, shifts, budgets, and execution state — this
-- migration deliberately creates no canonical copy of any Worklog table.

-- Generic approved consequential operations against external systems.
-- Modelled on artifact_deployments: idempotency key unique per team, distinct
-- request/approval identities, attempt counting, and an explicit
-- outcome_unknown quarantine that is never automatically retried.
create table if not exists integration_operations (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  tenant_id text,
  connector_id text not null,
  action text not null,
  local_entity_type text not null,
  local_entity_id text not null,
  payload jsonb not null default '{}',
  payload_checksum text,
  status text not null default 'draft',
  idempotency_key text not null,
  requested_by text,
  requested_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  attempt_count integer not null default 0,
  external_result_type text,
  external_result_id text,
  result_metadata jsonb not null default '{}',
  error_metadata jsonb not null default '{}',
  uncertain_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, idempotency_key)
);

create index if not exists integration_operations_team_status_idx
  on integration_operations (team_id, status, created_at desc);
create index if not exists integration_operations_entity_idx
  on integration_operations (team_id, local_entity_type, local_entity_id, created_at desc);
create index if not exists integration_operations_connector_idx
  on integration_operations (team_id, connector_id, status)
  where status in ('draft', 'approved', 'executing', 'outcome_unknown');

-- External-link lifecycle fields. The existing unique key
-- (team, local type/id, system, object type/id) stays the identity of a
-- relationship; retiring and re-linking transitions the same row and appends
-- to link_history rather than creating duplicates.
alter table external_links add column if not exists linked_by text;
alter table external_links add column if not exists linked_at timestamptz;
alter table external_links add column if not exists last_verified_at timestamptz;
alter table external_links add column if not exists last_verified_state text;
alter table external_links add column if not exists status_snapshot jsonb not null default '{}';
alter table external_links add column if not exists snapshot_at timestamptz;
alter table external_links add column if not exists link_history jsonb not null default '[]';

create index if not exists external_links_system_object_idx
  on external_links (team_id, external_system, external_object_type, external_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'integration_operations_id_team_unique') then
    alter table integration_operations add constraint integration_operations_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'external_links_id_team_unique') then
    alter table external_links add constraint external_links_id_team_unique unique (id, team_id);
  end if;
end $$;
