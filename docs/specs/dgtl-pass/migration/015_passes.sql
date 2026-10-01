-- 015_passes.sql: DGTL Pass (issue, deliver, verify)
-- Renumbered from 009 on 2026-10-01: main now carries Core migrations 009-014.
--
-- DRAFT migration for the handoff package. Copy to platform/migrations/ in
-- Phase 1 (13-build-plan.md). Idempotent like 001-014: every statement is safe
-- to re-run. Validated against 001-014 on PostgreSQL 18.3 (PGlite 0.5.8) on
-- 2026-09-30 by reference/repository.test.js.
--
-- Stored pass status is only active | suspended | revoked. "expired", "used"
-- and "scheduled" are derived from valid_from / valid_until / use_count at read
-- time (reference/verify.js effectiveStatus), so no cron job has to flip them.

-- ---------------------------------------------------------------------------
-- Auth: two new staff roles, OAuth-only users, linked identities
-- ---------------------------------------------------------------------------

-- issuer: issue + resend passes, view holders, scan. No revoke, no settings.
-- verifier: scan only. Lands on /scan, never sees /admin.
alter table team_memberships drop constraint if exists team_memberships_role_check;
alter table team_memberships add constraint team_memberships_role_check
  check (role in ('owner', 'admin', 'sales', 'contractor', 'viewer', 'issuer', 'verifier'));

-- Staff invited for Google sign-in never get a password. verifyPassword()
-- must return false for a null hash (Phase 1 task P1.4).
alter table users alter column password_hash drop not null;

create table if not exists user_identities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null check (provider in ('google', 'apple', 'microsoft')),
  -- The provider's stable subject ("sub"). Matched on every login after the
  -- first, so an email change at the provider cannot hijack another account.
  subject text not null,
  email text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (provider, subject)
);
create index if not exists user_identities_user_id_idx on user_identities (user_id);

-- ---------------------------------------------------------------------------
-- Pass types: a tenant's catalogue (Day, Monthly, Yearly, VIP Lifetime, …)
-- ---------------------------------------------------------------------------

create table if not exists pass_types (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  tenant_id text not null references tenants(id) on delete restrict,
  slug text not null,
  name text not null,
  description text not null default '',
  tier text not null check (tier in ('day', 'monthly', 'yearly', 'vip_lifetime', 'custom')),
  validity_kind text not null check (validity_kind in ('day', 'month', 'year', 'lifetime', 'fixed')),
  validity_count integer not null default 1 check (validity_count between 1 and 120),
  -- null = unlimited entries inside the window
  max_uses integer check (max_uses is null or max_uses >= 1),
  reentry_cooldown_seconds integer not null default 0 check (reentry_cooldown_seconds between 0 and 86400),
  is_vip boolean not null default false,
  -- { accent, useBrandAccent, materialLabel, wallet: { style, background, foreground, label, imageAssetId } }
  design jsonb not null default '{}',
  -- { variant, copy: { subject, headline, … }, perks: [{ title, body }] }
  email jsonb not null default '{}',
  -- { enabled, copy: { standard | vip } }
  sms jsonb not null default '{}',
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  check (validity_kind <> 'lifetime' or tier in ('vip_lifetime', 'custom'))
);
create index if not exists pass_types_team_idx on pass_types (team_id, status, sort_order);

-- ---------------------------------------------------------------------------
-- Holders: the people passes are issued to (not sales leads)
-- ---------------------------------------------------------------------------

create table if not exists pass_holders (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  tenant_id text not null references tenants(id) on delete restrict,
  name text not null,
  email text,
  phone text,                                   -- E.164, validated in lib/passes/holders.js
  lead_id text references leads(id) on delete set null,
  -- Consent basis for *commercial* messages (the VIP onboarding offer). Pass
  -- delivery itself is transactional and does not depend on this.
  marketing_consent text not null default 'none' check (marketing_consent in ('none', 'implied', 'express')),
  marketing_consent_at timestamptz,
  marketing_consent_source text,                -- e.g. 'issuer_attested', 'pass_page_optin'
  marketing_consent_expires_at timestamptz,     -- implied consent lapses (CASL: 2 years from purchase)
  email_suppressed_at timestamptz,              -- unsubscribed from marketing
  sms_opted_out_at timestamptz,                 -- STOP received
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index if not exists pass_holders_tenant_email_uidx on pass_holders (tenant_id, lower(email)) where email is not null;
create index if not exists pass_holders_tenant_phone_idx on pass_holders (tenant_id, phone) where phone is not null;
create index if not exists pass_holders_team_idx on pass_holders (team_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Passes: one credential each; the verification source of truth
-- ---------------------------------------------------------------------------

create table if not exists passes (
  id text primary key,                          -- also the Apple Wallet serialNumber
  team_id text not null references teams(id) on delete cascade,
  tenant_id text not null references tenants(id) on delete restrict,
  pass_type_id text not null references pass_types(id) on delete restrict,
  holder_id text not null references pass_holders(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  valid_from timestamptz not null,
  valid_until timestamptz,                      -- null = lifetime
  -- Snapshotted from the pass type at issue: editing a type never changes a
  -- pass that is already in someone's Wallet.
  max_uses integer check (max_uses is null or max_uses >= 1),
  reentry_cooldown_seconds integer not null default 0,
  use_count integer not null default 0 check (use_count >= 0),
  first_used_at timestamptz,
  last_used_at timestamptz,
  last_used_gate text,
  -- Credential: sha256 of the derived code. The code itself is never stored
  -- (reference/credentials.js).
  credential_hash text not null unique,
  credential_key_id text not null,
  credential_version integer not null default 1 check (credential_version >= 1),
  short_code text not null,                     -- manual-entry fallback, staff-only lookup
  source text not null default 'manual' check (source in ('manual', 'import', 'checkout', 'api')),
  source_ref text,                              -- import batch id, Stripe session id, API client id
  issue_request_id text unique,                 -- idempotency key from the issue form / API
  issued_by text references users(id) on delete set null,
  first_viewed_at timestamptz,                  -- holder opened /p/<credential> (onboarding "accept")
  revoked_at timestamptz,
  revoked_by text references users(id) on delete set null,
  revoke_reason text,
  -- Bumped whenever anything Wallet displays changes; drives the Wallet web
  -- service's passesUpdatedSince (Phase 5b).
  content_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unique per team: manual entry searches the verifier's whole team.
  unique (team_id, short_code),
  check (valid_until is null or valid_until > valid_from),
  check (max_uses is null or use_count <= max_uses)
);
create index if not exists passes_team_created_idx on passes (team_id, created_at desc);
create index if not exists passes_tenant_status_idx on passes (tenant_id, status);
create index if not exists passes_holder_idx on passes (holder_id);
create index if not exists passes_type_idx on passes (pass_type_id);
create index if not exists passes_expiring_idx on passes (team_id, valid_until) where valid_until is not null and status = 'active';

-- ---------------------------------------------------------------------------
-- Deliveries: every email / SMS attempt (a queue for bulk, a log for single)
-- ---------------------------------------------------------------------------

create table if not exists pass_deliveries (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  pass_id text not null references passes(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  template text not null check (template in ('day', 'monthly', 'yearly', 'vip_lifetime', 'vip_onboarding', 'sms_standard', 'sms_vip')),
  recipient text not null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'skipped')),
  skip_reason text,                             -- e.g. 'sms_opted_out', 'render_blocked:missing_postal_address'
  marketing boolean not null default false,     -- carried a commercial offer (audit trail for consent)
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  claim_token text,                             -- compare-and-set claim, same pattern as outreach_queue
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pass_deliveries_due_idx on pass_deliveries (status, scheduled_at) where status = 'queued';
create index if not exists pass_deliveries_pass_idx on pass_deliveries (pass_id, created_at desc);
create index if not exists pass_deliveries_provider_idx on pass_deliveries (provider, provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- Scans: the verification ledger (append-only)
-- ---------------------------------------------------------------------------

create table if not exists pass_scans (
  id text primary key,                          -- client-generated scan id: replays return the stored verdict
  team_id text not null references teams(id) on delete cascade,
  tenant_id text,
  pass_id text references passes(id) on delete set null,
  verifier_id text references users(id) on delete set null,
  result text not null check (result in ('valid', 'recently_used', 'used', 'expired', 'not_yet_valid', 'revoked', 'suspended', 'not_found', 'invalid_format')),
  internal_reason text,                         -- e.g. 'foreign_team' (never shown to the scanner)
  admitted boolean not null,
  input_kind text not null check (input_kind in ('qr', 'barcode', 'manual')),
  gate text,
  device_label text,
  ip_hash text,                                 -- sha256(ip + daily salt), not the raw IP
  user_agent text,
  -- The exact response returned, so a replayed scan id gets the same verdict
  -- back instead of a second admission (or a spurious "already used").
  response jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists pass_scans_team_created_idx on pass_scans (team_id, created_at desc);
create index if not exists pass_scans_pass_idx on pass_scans (pass_id, created_at desc);
create index if not exists pass_scans_verifier_idx on pass_scans (verifier_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Apple Wallet web service registrations (Phase 5b; harmless if unused)
-- ---------------------------------------------------------------------------

create table if not exists pass_wallet_registrations (
  id text primary key,
  pass_id text not null references passes(id) on delete cascade,
  device_library_id text not null,
  push_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_library_id, pass_id)
);
create index if not exists pass_wallet_registrations_device_idx on pass_wallet_registrations (device_library_id);
