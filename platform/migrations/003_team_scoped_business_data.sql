insert into teams (id, name, slug)
select 'team_default', 'Default Team', 'default'
where not exists (select 1 from teams);

alter table tenants add column if not exists team_id text;
alter table leads add column if not exists team_id text;
alter table contractors add column if not exists team_id text;
alter table draft_emails add column if not exists team_id text;

with default_team as (
  select id
  from teams
  order by case when slug = 'default' then 0 else 1 end, created_at asc, id asc
  limit 1
)
update tenants
set team_id = (select id from default_team)
where team_id is null
   or not exists (select 1 from teams where teams.id = tenants.team_id);

update leads
set team_id = tenants.team_id
from tenants
where leads.tenant_id = tenants.id
  and (
    leads.team_id is null
    or not exists (select 1 from teams where teams.id = leads.team_id)
  );

with default_team as (
  select id
  from teams
  order by case when slug = 'default' then 0 else 1 end, created_at asc, id asc
  limit 1
)
update leads
set team_id = (select id from default_team)
where team_id is null
   or not exists (select 1 from teams where teams.id = leads.team_id);

with default_team as (
  select id
  from teams
  order by case when slug = 'default' then 0 else 1 end, created_at asc, id asc
  limit 1
)
update contractors
set team_id = (select id from default_team)
where team_id is null
   or not exists (select 1 from teams where teams.id = contractors.team_id);

update draft_emails
set team_id = tenants.team_id
from tenants
where draft_emails.tenant_id = tenants.id
  and (
    draft_emails.team_id is null
    or not exists (select 1 from teams where teams.id = draft_emails.team_id)
  );

with default_team as (
  select id
  from teams
  order by case when slug = 'default' then 0 else 1 end, created_at asc, id asc
  limit 1
)
update draft_emails
set team_id = (select id from default_team)
where team_id is null
   or not exists (select 1 from teams where teams.id = draft_emails.team_id);

alter table tenants alter column team_id set not null;
alter table leads alter column team_id set not null;
alter table contractors alter column team_id set not null;
alter table draft_emails alter column team_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_team_id_fkey'
  ) then
    alter table tenants
      add constraint tenants_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_team_id_fkey'
  ) then
    alter table leads
      add constraint leads_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contractors_team_id_fkey'
  ) then
    alter table contractors
      add constraint contractors_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'draft_emails_team_id_fkey'
  ) then
    alter table draft_emails
      add constraint draft_emails_team_id_fkey foreign key (team_id) references teams(id) on delete restrict;
  end if;
end $$;

create index if not exists tenants_team_id_created_at_idx on tenants (team_id, created_at desc);
create index if not exists leads_team_id_created_at_idx on leads (team_id, created_at desc);
create index if not exists leads_team_id_tenant_id_idx on leads (team_id, tenant_id);
create index if not exists contractors_team_id_created_at_idx on contractors (team_id, created_at desc);
create index if not exists draft_emails_team_id_created_at_idx on draft_emails (team_id, created_at desc);
