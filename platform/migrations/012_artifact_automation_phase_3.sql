-- 012: DGTL Core sales-asset generation and immutable artifact versions.
--
-- Additive only. Core records bounded job/deployment intent and immutable version
-- metadata. Authorized external workers execute versioned engine skills in isolated
-- workspaces; no web route receives shell, repository, SSH, or deploy credentials.

create table if not exists artifact_families (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  tenant_id text,
  company_id text not null,
  opportunity_id text not null,
  kind text not null,
  slug text not null,
  status text not null default 'active',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, kind, slug),
  foreign key (company_id, team_id) references companies(id, team_id),
  foreign key (opportunity_id, team_id) references opportunities(id, team_id)
);

alter table generation_jobs add column if not exists artifact_family_id text references artifact_families(id) on delete restrict;
alter table generation_jobs add column if not exists artifact_kind text;
alter table generation_jobs add column if not exists adapter_id text;
alter table generation_jobs add column if not exists adapter_version text;
alter table generation_jobs add column if not exists source_commit text;
alter table generation_jobs add column if not exists slug text;
alter table generation_jobs add column if not exists context_snapshot jsonb not null default '{}';
alter table generation_jobs add column if not exists generation_parameters jsonb not null default '{}';
alter table generation_jobs add column if not exists idempotency_key text;
alter table generation_jobs add column if not exists attempt_count integer not null default 0;
alter table generation_jobs add column if not exists claimed_by text;
alter table generation_jobs add column if not exists claimed_at timestamptz;
alter table generation_jobs add column if not exists lease_expires_at timestamptz;
alter table generation_jobs add column if not exists heartbeat_at timestamptz;
alter table generation_jobs add column if not exists execution_reference text;
alter table generation_jobs add column if not exists validation_results jsonb not null default '{}';
alter table generation_jobs add column if not exists output_manifest jsonb not null default '{}';
alter table generation_jobs add column if not exists content_checksum text;
alter table generation_jobs add column if not exists preview_reference text;
alter table generation_jobs add column if not exists input_approved_by text;
alter table generation_jobs add column if not exists input_approved_at timestamptz;
alter table generation_jobs add column if not exists result_submitted_at timestamptz;
alter table generation_jobs add column if not exists revision_of_job_id text references generation_jobs(id) on delete set null;
alter table generation_jobs add column if not exists revision_instructions text;
alter table generation_jobs add column if not exists cancellation_metadata jsonb not null default '{}';

create unique index if not exists generation_jobs_team_idempotency_idx
  on generation_jobs (team_id, idempotency_key) where idempotency_key is not null;
create index if not exists generation_jobs_claim_idx
  on generation_jobs (team_id, status, created_at) where status in ('queued', 'claimed', 'running', 'validating');
create index if not exists generation_jobs_lease_idx
  on generation_jobs (team_id, lease_expires_at) where status in ('claimed', 'running', 'validating');

alter table artifacts add column if not exists artifact_family_id text references artifact_families(id) on delete restrict;
alter table artifacts add column if not exists previous_version_id text references artifacts(id) on delete set null;
alter table artifacts add column if not exists version_number integer;
alter table artifacts add column if not exists source_commit text;
alter table artifacts add column if not exists content_checksum text;
alter table artifacts add column if not exists manifest_reference text;
alter table artifacts add column if not exists validation_status text;
alter table artifacts add column if not exists approved_by text;
alter table artifacts add column if not exists retired_at timestamptz;

create unique index if not exists artifacts_family_version_idx
  on artifacts (artifact_family_id, version_number) where artifact_family_id is not null;
create unique index if not exists artifacts_job_checksum_idx
  on artifacts (team_id, generation_job_id, content_checksum)
  where generation_job_id is not null and content_checksum is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'artifact_families_id_team_unique') then
    alter table artifact_families add constraint artifact_families_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_id_team_unique') then
    alter table artifacts add constraint artifacts_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generation_jobs_id_team_unique') then
    alter table generation_jobs add constraint generation_jobs_id_team_unique unique (id, team_id);
  end if;

  -- NOT VALID avoids a blocking historical-table scan while enforcing every new
  -- Stage 3 relationship. Validation is an explicit promotion rehearsal gate.
  if not exists (select 1 from pg_constraint where conname = 'generation_jobs_company_team_fkey') then
    alter table generation_jobs add constraint generation_jobs_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generation_jobs_opportunity_team_fkey') then
    alter table generation_jobs add constraint generation_jobs_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'generation_jobs_family_team_fkey') then
    alter table generation_jobs add constraint generation_jobs_family_team_fkey
      foreign key (artifact_family_id, team_id) references artifact_families(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_company_team_fkey') then
    alter table artifacts add constraint artifacts_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_opportunity_team_fkey') then
    alter table artifacts add constraint artifacts_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_generation_job_team_fkey') then
    alter table artifacts add constraint artifacts_generation_job_team_fkey
      foreign key (generation_job_id, team_id) references generation_jobs(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_family_team_fkey') then
    alter table artifacts add constraint artifacts_family_team_fkey
      foreign key (artifact_family_id, team_id) references artifact_families(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'artifacts_previous_version_team_fkey') then
    alter table artifacts add constraint artifacts_previous_version_team_fkey
      foreign key (previous_version_id, team_id) references artifacts(id, team_id) not valid;
  end if;
end $$;

create table if not exists artifact_deployments (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  tenant_id text,
  artifact_id text not null,
  adapter_id text not null,
  target_id text not null,
  status text not null default 'draft',
  idempotency_key text not null,
  approved_by text,
  approved_at timestamptz,
  requested_by text,
  requested_at timestamptz not null default now(),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0,
  deployment_reference text,
  deployment_url text,
  deployed_checksum text,
  verification_results jsonb not null default '{}',
  error_metadata jsonb not null default '{}',
  uncertain_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, idempotency_key),
  foreign key (artifact_id, team_id) references artifacts(id, team_id)
);
create index if not exists artifact_deployments_claim_idx
  on artifact_deployments (team_id, status, requested_at) where status in ('deploy_queued', 'deploying');

create table if not exists message_artifacts (
  id text primary key,
  team_id text not null references teams(id) on delete restrict,
  message_id text not null,
  artifact_id text not null,
  artifact_version integer not null,
  artifact_kind text not null,
  artifact_title text,
  deployment_url_snapshot text not null,
  content_checksum text not null,
  attached_by text,
  attached_at timestamptz not null default now(),
  unique (message_id, artifact_id),
  foreign key (message_id, team_id) references messages(id, team_id),
  foreign key (artifact_id, team_id) references artifacts(id, team_id)
);
create index if not exists message_artifacts_team_message_idx on message_artifacts (team_id, message_id);
