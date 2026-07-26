-- Team membership roles: owner, admin, sales, contractor, viewer.
-- Use owner/admin for credential issuing and account administration flows.

create table if not exists users (
  id text primary key,
  email text unique not null,
  name text,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists teams (
  id text primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists team_memberships (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'sales', 'contractor', 'viewer')),
  created_at timestamptz default now(),
  unique (team_id, user_id)
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id text primary key,
  user_id text references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists users_status_idx on users (status);
create index if not exists team_memberships_user_id_idx on team_memberships (user_id);
create index if not exists team_memberships_team_id_role_idx on team_memberships (team_id, role);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);
create index if not exists audit_logs_user_id_created_at_idx on audit_logs (user_id, created_at desc);
create index if not exists audit_logs_action_created_at_idx on audit_logs (action, created_at desc);
create index if not exists audit_logs_target_idx on audit_logs (target_type, target_id);
