-- 008: Outreach drip + scheduled sends.
-- Additive columns only. Kept consistent with the inline bootstrap in
-- lib/store.js ensureSchema (which mirrors these alters).
--
-- Scheduling reuses the existing outreach_queue.scheduled_for column (no new
-- column needed): the drain endpoint sends approved items whose scheduled_for
-- has passed. A follow-up is just another approved row with a future
-- scheduled_for and step = 1 (so a follow-up never spawns its own follow-up).

alter table outreach_campaigns add column if not exists follow_up_template_id text;
alter table outreach_campaigns add column if not exists follow_up_delay_days integer not null default 3;
alter table outreach_campaigns add column if not exists test_mode boolean not null default false;

alter table outreach_queue add column if not exists step integer not null default 0;

-- Support the drain's due-item selection (approved rows ordered by schedule).
create index if not exists outreach_queue_status_scheduled_idx
  on outreach_queue (status, scheduled_for);
