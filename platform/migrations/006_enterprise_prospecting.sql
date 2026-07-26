-- 006: Enterprise Prospecting (account-based / ABM).
-- Two directly-team-scoped tables. All statements idempotent so re-running is safe
-- and this file stays consistent with the inline bootstrap DDL in lib/store.js
-- (ensureSchema). See docs/specs/enterprise-prospecting-module-spec.md.

create table if not exists target_accounts (
  id text primary key,
  team_id text not null default 'team_default',
  tenant_id text,
  name text not null,
  domain text,
  segment text,                       -- 'enterprise' | 'mid-market'
  tier smallint,                      -- 1 | 2 | 3
  fit_score smallint,                 -- 0..100
  fit_rationale text,
  firmographics jsonb not null default '{}',
  signals jsonb not null default '[]',
  buying_committee jsonb not null default '[]',
  dossier jsonb not null default '{}',
  source_type text,                   -- 'open_db' | 'apollo' | 'manual' | 'csv'
  gate_status text not null default 'sourced',
  -- sourced -> gate1_approved -> researched -> scoped -> gate2_approved -> in_outreach | deprioritized
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
  status text not null default 'draft',  -- draft -> gate2_approved -> queued
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_campaigns_team_id_account_id_idx on account_campaigns (team_id, account_id);

-- FK to teams, guarded (matches migration 003 style).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'target_accounts_team_id_fkey') then
    alter table target_accounts
      add constraint target_accounts_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'account_campaigns_team_id_fkey') then
    alter table account_campaigns
      add constraint account_campaigns_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'account_campaigns_account_id_fkey') then
    alter table account_campaigns
      add constraint account_campaigns_account_id_fkey foreign key (account_id) references target_accounts(id) on delete cascade;
  end if;
end $$;
