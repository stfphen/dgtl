-- 014: DGTL.chat command & action layer (Stage 6).
--
-- Additive only. Stores private assistant threads, final messages, safe
-- tool-run audit records, and durable ActionProposals — the conversational
-- confirmation step BEFORE an existing native domain workflow runs. No
-- model chain-of-thought, no provider secret, and no business-domain state
-- is ever stored here; canonical entities remain owned by Stages 1-4.

create table if not exists assistant_threads (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  user_id text not null,
  title text not null default '',
  -- Turn concurrency: one running turn per thread, enforced by CAS on status.
  status text not null default 'idle',
  active_turn_id text,
  policy_version text not null default '',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id)
);
create index if not exists assistant_threads_team_user_idx
  on assistant_threads (team_id, user_id, last_message_at desc nulls last);

create table if not exists assistant_messages (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  thread_id text not null,
  turn_id text not null default '',
  role text not null,
  content text not null default '',
  source_refs jsonb not null default '[]',
  tool_summary jsonb not null default '[]',
  provider_metadata jsonb not null default '{}',
  policy_version text not null default '',
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  foreign key (thread_id, team_id) references assistant_threads(id, team_id)
);
create index if not exists assistant_messages_thread_idx
  on assistant_messages (thread_id, created_at);

create table if not exists assistant_tool_runs (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  thread_id text not null,
  turn_id text not null,
  tool_id text not null,
  classification text not null,
  arguments jsonb not null default '{}',
  target_refs jsonb not null default '[]',
  status text not null default 'completed',
  error text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (thread_id, team_id) references assistant_threads(id, team_id)
);
create index if not exists assistant_tool_runs_thread_idx
  on assistant_tool_runs (thread_id, created_at);
create index if not exists assistant_tool_runs_team_tool_idx
  on assistant_tool_runs (team_id, tool_id, created_at desc);

create table if not exists assistant_action_proposals (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  thread_id text not null,
  turn_id text not null default '',
  action_id text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  payload jsonb not null default '{}',
  payload_hash text not null,
  impact_summary text not null default '',
  preconditions jsonb not null default '{}',
  proposed_by text not null,
  confirmed_by text,
  status text not null default 'proposed',
  expires_at timestamptz,
  confirmed_at timestamptz,
  executed_at timestamptz,
  result_entity_type text,
  result_entity_id text,
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (thread_id, team_id) references assistant_threads(id, team_id)
);
create index if not exists assistant_action_proposals_team_status_idx
  on assistant_action_proposals (team_id, status, created_at desc);
create index if not exists assistant_action_proposals_thread_idx
  on assistant_action_proposals (thread_id, created_at desc);
-- One live proposal per exact payload per thread: a re-proposed identical
-- action reuses the open card instead of stacking duplicates.
create unique index if not exists assistant_action_proposals_active_idx
  on assistant_action_proposals (thread_id, action_id, payload_hash)
  where status = 'proposed';
