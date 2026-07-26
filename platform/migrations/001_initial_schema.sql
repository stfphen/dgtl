create table if not exists tenants (
  id text primary key,
  slug text unique not null,
  domains jsonb not null default '[]',
  status text not null default 'active',
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  tenant_id text not null,
  campaign_id text,
  batch_id text,
  business text,
  name text,
  contact_title text,
  email text,
  phone text,
  website_url text,
  domain text,
  address text,
  city text,
  region text,
  country text,
  category text,
  notes text,
  package_id text,
  status text not null default 'new',
  enrichment_status text not null default 'not_started',
  outreach_status text not null default 'not_started',
  pipeline_status text not null default 'new',
  lead_score integer not null default 0,
  lead_score_reason text,
  pain_points text,
  recommended_offer text,
  assigned_to text,
  google_place_id text,
  google_rating numeric,
  google_review_count integer,
  source_url text,
  source_type text not null default 'form',
  metadata jsonb not null default '{}',
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  reply_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table leads add column if not exists campaign_id text;
alter table leads add column if not exists batch_id text;
alter table leads add column if not exists contact_title text;
alter table leads add column if not exists domain text;
alter table leads add column if not exists address text;
alter table leads add column if not exists city text;
alter table leads add column if not exists region text;
alter table leads add column if not exists country text;
alter table leads add column if not exists category text;
alter table leads add column if not exists enrichment_status text not null default 'not_started';
alter table leads add column if not exists outreach_status text not null default 'not_started';
alter table leads add column if not exists pipeline_status text not null default 'new';
alter table leads add column if not exists lead_score integer not null default 0;
alter table leads add column if not exists lead_score_reason text;
alter table leads add column if not exists pain_points text;
alter table leads add column if not exists recommended_offer text;
alter table leads add column if not exists assigned_to text;
alter table leads add column if not exists google_place_id text;
alter table leads add column if not exists google_rating numeric;
alter table leads add column if not exists google_review_count integer;
alter table leads add column if not exists last_contacted_at timestamptz;
alter table leads add column if not exists next_follow_up_at timestamptz;
alter table leads add column if not exists reply_status text;

create table if not exists contractors (
  id text primary key,
  name text not null,
  email text,
  phone text,
  service_area text,
  availability_notes text,
  weekly_capacity integer,
  rate_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists draft_emails (
  id text primary key,
  lead_id text not null,
  tenant_id text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists prospecting_batches (
  id text primary key,
  tenant_id text not null,
  name text not null,
  query text not null,
  category text,
  city text,
  provider text not null default 'google_places',
  status text not null default 'draft',
  max_results integer not null default 20,
  enrich_hunter boolean not null default false,
  enrich_apollo boolean not null default false,
  target_roles jsonb not null default '[]',
  preview_results jsonb not null default '[]',
  counts jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_templates (
  id text primary key,
  tenant_id text not null,
  name text not null,
  subject text not null,
  body text not null,
  category text,
  offer_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_campaigns (
  id text primary key,
  tenant_id text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  source_filter text,
  city_filter text,
  category_filter text,
  daily_send_cap integer not null default 25,
  per_domain_daily_cap integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_queue (
  id text primary key,
  lead_id text not null,
  campaign_id text,
  template_id text,
  tenant_id text not null,
  status text not null default 'queued',
  subject text not null,
  body text not null,
  recipient_email text,
  sender_email text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  failure_reason text,
  resend_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_suppression_list (
  id text primary key,
  tenant_id text,
  email text,
  domain text,
  reason text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists outreach_events (
  id text primary key,
  lead_id text not null,
  queue_id text,
  campaign_id text,
  type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
