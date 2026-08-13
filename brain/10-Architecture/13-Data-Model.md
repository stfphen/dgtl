---
title: 13 · Data Model
type: reference
tags: [architecture, leads, tenancy]
status: stable
updated: 2026-08-13
source: migrations/001-009, lib/store.js, lib/core/
---

# Data Model

Postgres schema, defined by ordered migrations (`migrations/`, latest `009`, run via `npm run migrate`).
The data layer is `lib/store.js` (82KB) which also has a **JSON-file fallback**
(`data/app-store.json`) used when `DATABASE_URL` is unset — local dev only.

> Key store constant: `DEFAULT_TEAM_ID = "team_default"`. Built-in tenants + public/funding leads
> are scoped here — the operating owner must be in this team (`TEAM_SLUG=default`). See [[15-Multi-Tenancy]].

## Migrations
### `001_initial_schema.sql` — core business tables
- **`tenants`** — id, slug, domains (jsonb), status, config (jsonb).
- **`leads`** — large table: contact fields, `pipeline_status`, `enrichment_status`, `outreach_status`, `lead_score`, `source_type`, `metadata` (jsonb), `google_*` fields, follow-up timestamps.
- **`contractors`** — contractor capacity records.
- **`draft_emails`** — generated draft outreach.
- **`prospecting_batches`** — query/category/city/provider, `preview_results` (jsonb), counts (jsonb), `enrich_hunter`/`enrich_apollo` flags.
- **`outreach_templates`**, **`outreach_campaigns`** (`daily_send_cap=25`, `per_domain_daily_cap=1`, filters), **`outreach_queue`** (status, `scheduled_for`, `resend_message_id`), **`outreach_suppression_list`**, **`outreach_events`**.

### `002_team_auth_schema.sql` — auth & teams
- **`users`** (email unique, `password_hash`, status), **`teams`** (slug unique), **`team_memberships`** (role CHECK: owner/admin/sales/contractor/viewer; unique team+user), **`sessions`** (`token_hash` unique = SHA-256, `expires_at`), **`audit_logs`** (user_id, action, target_type/id, metadata) + indexes.

### `003_team_scoped_business_data.sql` — multi-tenant isolation
- Adds `team_id NOT NULL` to tenants/leads/contractors/draft_emails (backfill → enforce) + team-scoped composite indexes. **This is the migration that makes the app multi-tenant-safe.**

### `004_telephony.sql` — calls
- **`calls`** — provider, `provider_call_id`, direction, from/to/tenant numbers, status, outcome, `duration_seconds`, `recording_url`, `transcript`, `ai_summary`, started/ended timestamps.
- **`call_events`** — `call_id`, `event_type`, `payload` (jsonb) — the call timeline.
- Adds lead telephony fields (`assigned_to_user_id`, `do_not_call`, `do_not_contact`, `consent_source`, `phone_country`) and `team_memberships` telephony fields (`telephony_role`, `phone_number`, `availability_status`, `can_receive_inbound`/`can_make_outbound`).

### `005_tasks.sql` — tasks
- **`tasks`** — `team_id`, `lead_id`, title, priority, `due_at`, `assigned_to_user_id`, status. Powers missed-call follow-ups (`createMissedCallTask`). See [[28-Telephony]].

### `007_media_assets.sql` — media library (2026-07-02)
- **`media_assets`** — `team_id NOT NULL`, `tenant_id` ("" = team-wide), kind (image/video/embed), `url`, `storage_key`, mime/bytes/width/height/duration, `thumbnail_url`, title/alt, `tags` (jsonb industry/format), source, `created_by`. Indexes: btree `(team_id, created_at desc)` + gin(tags). Referenced from `tenants.config` by `mediaId` (`media.heroImageId`, portfolio items, reference logos) — resolved at render by `resolveTenantMediaConfig`. See [[2D-Portfolio-Media]].

### `008_outreach_drip.sql` — outreach drip/scheduling (2026-07-04)
- **`outreach_campaigns`** gains `follow_up_template_id`, `follow_up_delay_days`, `test_mode`; **`outreach_queue`** gains `step` (0 = intro, 1+ = follow-up). Powers the follow-up drip + scheduled drain. Store adds claim/due primitives (`claimOutreachQueueItem`, `listDueQueueItems`). See [[26-Outreach]].

### `009_core_domain.sql` — DGTL Core commercial graph (2026-08-13)
- Canonical **`companies`**, **`contacts`**, **`opportunities`** + **`opportunity_contacts`**, and provenance-bearing **`research_records`**.
- Canonical **`campaigns`**, **`messages`**, and append-only commercial **`activities`**. Existing outreach/call tables remain operational behind compatibility projections; `audit_logs` remains the separate security audit trail.
- Artifact registry **`artifacts`**, process records **`generation_jobs`**, and many-result join **`generation_job_artifacts`**. `media_assets` remains presentation media and is not conflated with pitch/audit/report artifacts.
- Polymorphic **`external_links`** stores identities/cursors for Worklog, pitch/audit/report deployment, GitHub, email providers, DGTL OS, and future systems without replicating their authoritative fields.
- **`import_batches`** + **`import_rows`** stage raw/normalized spreadsheet data, duplicate candidates, before-state, applied changes, and imported IDs for previewed/reversible imports.
- Safe deterministic backfill from `leads`, `target_accounts`, `account_campaigns`, `outreach_campaigns`, `outreach_queue`, and `draft_emails`; no legacy delete, merge, or rename. `lib/core/` merges canonical rows with live compatibility projections so post-migration legacy writes stay visible during dual-write rollout.
- Full contract and retirement map: `docs/architecture/dgtl-core-phase-1.md`.

## Entity relationships (mental model)
```
team ─┬─ users (via team_memberships, with role + telephony fields)
      ├─ tenants ── config (funnel/branding/packages/telephony)
      ├─ companies ─┬─ contacts
      │             ├─ opportunities ─┬─ research_records
      │             │                 ├─ campaigns ── messages
      │             │                 ├─ activities
      │             │                 ├─ artifacts ← generation_jobs
      │             │                 └─ external_links
      │             └─ research_records / external_links
      ├─ leads (compatibility) ─┬─ calls ── call_events
      │         ├─ draft_emails
      │         ├─ outreach_queue / outreach_events
      │         └─ tasks
      ├─ contractors
      ├─ prospecting_batches
      └─ outreach_templates / campaigns / suppression_list
sessions ── users        audit_logs ── users
```

`Opportunity` is the operational center of a sales approach; one Company may have many. Worklog
task/time data is never copied into this graph — only an `external_links` reference is stored.

Up: [[10-Architecture-MOC]]
