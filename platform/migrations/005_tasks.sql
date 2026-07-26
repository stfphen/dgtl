-- Telephony Phase 5: minimal task entity for follow-ups (missed-call callbacks).
-- Idempotent.

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
