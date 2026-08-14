-- 011: DGTL Core release-gate hardening.
--
-- Additive only. This migration freezes approved envelope fields, records worker
-- health, indexes lease recovery, and prevents new cross-team relationship rows.
-- Existing rows are not rewritten or deleted. Team-aware foreign keys are NOT
-- VALID so they enforce new writes without a blocking historical-table scan;
-- validation remains an explicit staging/production release step.

alter table messages add column if not exists approved_recipient_email text;
alter table messages add column if not exists approved_sender_email text;
alter table messages add column if not exists delivery_uncertain_at timestamptz;

create table if not exists core_worker_heartbeats (
  team_id text not null references teams(id) on delete restrict,
  worker_id text not null,
  state text not null default 'idle',
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (team_id, worker_id)
);

create index if not exists messages_team_outbox_due_idx
  on messages (team_id, queue_state, next_attempt_at, scheduled_at)
  where queue_state in ('queued', 'retry');
create index if not exists messages_team_lease_idx
  on messages (team_id, locked_at)
  where queue_state = 'sending';
create index if not exists messages_provider_external_idx
  on messages (provider, external_message_id)
  where external_message_id is not null;
create index if not exists core_worker_heartbeats_updated_idx
  on core_worker_heartbeats (team_id, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'import_batches_id_team_unique') then
    alter table import_batches add constraint import_batches_id_team_unique unique (id, team_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_id_team_unique') then
    alter table messages add constraint messages_id_team_unique unique (id, team_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contacts_company_team_fkey') then
    alter table contacts add constraint contacts_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunities_company_team_fkey') then
    alter table opportunities add constraint opportunities_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunities_primary_contact_team_fkey') then
    alter table opportunities add constraint opportunities_primary_contact_team_fkey
      foreign key (primary_contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'research_company_team_fkey') then
    alter table research_records add constraint research_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'research_opportunity_team_fkey') then
    alter table research_records add constraint research_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaigns_opportunity_team_fkey') then
    alter table campaigns add constraint campaigns_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_opportunity_team_fkey') then
    alter table messages add constraint messages_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_campaign_team_fkey') then
    alter table messages add constraint messages_campaign_team_fkey
      foreign key (campaign_id, team_id) references campaigns(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_contact_team_fkey') then
    alter table messages add constraint messages_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_members_campaign_team_fkey') then
    alter table campaign_members add constraint campaign_members_campaign_team_fkey
      foreign key (campaign_id, team_id) references campaigns(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_members_opportunity_team_fkey') then
    alter table campaign_members add constraint campaign_members_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_members_contact_team_fkey') then
    alter table campaign_members add constraint campaign_members_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'campaign_members_import_batch_team_fkey') then
    alter table campaign_members add constraint campaign_members_import_batch_team_fkey
      foreign key (import_batch_id, team_id) references import_batches(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_attempts_message_team_fkey') then
    alter table message_delivery_attempts add constraint delivery_attempts_message_team_fkey
      foreign key (message_id, team_id) references messages(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_suppressions_contact_team_fkey') then
    alter table contact_suppressions add constraint contact_suppressions_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_events_message_team_fkey') then
    alter table provider_events add constraint provider_events_message_team_fkey
      foreign key (message_id, team_id) references messages(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inbound_replies_message_team_fkey') then
    alter table inbound_replies add constraint inbound_replies_message_team_fkey
      foreign key (message_id, team_id) references messages(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inbound_replies_contact_team_fkey') then
    alter table inbound_replies add constraint inbound_replies_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inbound_replies_company_team_fkey') then
    alter table inbound_replies add constraint inbound_replies_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inbound_replies_opportunity_team_fkey') then
    alter table inbound_replies add constraint inbound_replies_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'inbound_replies_campaign_team_fkey') then
    alter table inbound_replies add constraint inbound_replies_campaign_team_fkey
      foreign key (campaign_id, team_id) references campaigns(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_company_team_fkey') then
    alter table activities add constraint activities_company_team_fkey
      foreign key (company_id, team_id) references companies(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_contact_team_fkey') then
    alter table activities add constraint activities_contact_team_fkey
      foreign key (contact_id, team_id) references contacts(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_opportunity_team_fkey') then
    alter table activities add constraint activities_opportunity_team_fkey
      foreign key (opportunity_id, team_id) references opportunities(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_campaign_team_fkey') then
    alter table activities add constraint activities_campaign_team_fkey
      foreign key (campaign_id, team_id) references campaigns(id, team_id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_message_team_fkey') then
    alter table activities add constraint activities_message_team_fkey
      foreign key (message_id, team_id) references messages(id, team_id) not valid;
  end if;
end $$;
