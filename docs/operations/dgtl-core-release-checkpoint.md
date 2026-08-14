# DGTL Core Phase 1 + 2 release checkpoint

Date: 2026-08-14

Branch: `codex/import-outreach-phase-2`

Scope: release stabilization only; no production deployment, database change, DNS change, or commercial email

## Decision status

The local and GitHub release gates are green. The branch is preserved remotely and draft pull
request #26 targets `main`. GitHub Actions run `31771897952` completed all four jobs successfully,
including the aggregate `Required DGTL Core checkpoint`. This checkpoint is safe to merge after
human review of the broad branch delta. Production promotion remains a separate decision after an
isolated staging deployment with test transport.

## CI checkpoint

`.github/workflows/core-release-gate.yml` emits one branch-protection-ready result named
`Required DGTL Core checkpoint`. It requires:

- repository whitespace, JSON, link/manifest, roster, and compliance checks;
- migration 001–011 rehearsal on disposable PostgreSQL 16, including seeded legacy backfill,
  direct repeat execution, and a cross-team constraint attack;
- explicit Phase 1, Phase 2, and release-hardening tests, the complete platform suite, the
  production Next build, and the representative import-to-test-delivery rehearsal;
- Worklog and creator-intake deterministic suites plus a non-network Worklog MCP syntax check.

The check still has to be selected in GitHub branch protection before it becomes mechanically
impossible to merge around it.

## Production-shaped migration rehearsal

The strongest safe local source found was the sealed 2026-07-21 offboarding PostgreSQL dump. It is
production-shaped but not current and was not treated as sanitized or copied into the repository.
It restored into isolated PostgreSQL 16 after removing PostgreSQL 17's unsupported
`transaction_timeout` session statement. The production restore script now fails closed with
`ON_ERROR_STOP=1`.

Pre-migration legacy counts:

| Teams | Tenants | Leads | Target accounts | Account campaigns | Outreach campaigns | Queue | Drafts | Suppressions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10 | 361 | 1 | 1 | 1 | 7 | 2 | 0 |

After migrations 009–011:

| Companies | Contacts | Opportunities | Research | Campaigns | Messages |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 362 | 361 | 362 | 357 | 1 | 9 |

Reconciliation found zero orphan Contacts, zero orphan Opportunities, zero cross-team
Company/Contact or Company/Opportunity rows, and zero unvalidated team constraints after explicit
validation. Eight normalized-domain duplicate groups covering 32 rows remain review candidates;
the migration correctly did not auto-merge them. Direct repeat execution of 009–011 produced no
additional backfill rows, and the normal migration ledger reported the database up to date.

The dump's age is the remaining limitation. Before production, restore a new backup, repeat the
same reconciliation, record duration/locks, and prove the restore procedure again.

## Migration risk review

- 009–011 contain no table drop or data delete. Legacy rows remain authoritative for legacy paths.
- Backfills scan the small current legacy tables and insert stable compatibility IDs. They do not
  rewrite the legacy source rows.
- 010's opportunity-contact update and canonical uniqueness builds touch only new canonical data.
- 011 adds approved-envelope fields, worker health, partial outbox indexes, and composite team
  constraints. `NOT VALID` avoids a historical scan during migration while immediately protecting
  new writes; every constraint validated on the restored copy.
- Index and uniqueness creation can take brief locks on canonical tables. The rehearsed dataset is
  small, but a fresh production count and a backed-up maintenance window are still required.
- The migration runner uses an advisory lock and one transaction per migration file. Recovery is
  forward repair or full restore, not destructive down-migration after lineage-bearing data exists.

## Authorization and tenant isolation

All Core API routes authenticate and derive `team_id` from the session. The only request-owned
tenant values are checked with the existing team/tenant authorization helper. Direct-ID tests cover
cross-team Company, Contact, Opportunity, ImportBatch, Campaign membership, Message approval/queue,
and exception resolution attacks. Composite database constraints reject new cross-team relationship
rows even if an application defect reaches PostgreSQL.

Isolation remains application-level plus database relationships; PostgreSQL RLS is future
defense-in-depth and should be introduced platform-wide rather than only for Core.

## Outbox and delivery safety

Worker claim capacity is serialized per team with a transaction-scoped advisory lock, then rows are
claimed with `FOR UPDATE SKIP LOCKED`. Finalization compares both queue state and lease owner.
Delivery attempts are written before the provider call.

The release suite covers simultaneous workers, pre-attempt crash recovery, post-attempt lease
expiry, provider timeout/unknown result, retry backoff, maximum-attempt dead letter, duplicate
execution, already-finalized messages, campaign pause, late suppression, changed Contact email,
and changed approved content. Ambiguous provider outcomes become `delivery_uncertain` plus an
exception and are never automatically retried.

The final PostgreSQL acceptance run imported two researched prospects, created two canonical messages,
launched two workers concurrently (`1/1` claimed results), recorded exactly two attempts, then
returned no work on the repeat drain. `duplicateDeliveryPrevented=true`; provider `test` made zero
external calls.

## Rate and provider boundary

Provider-independent policy covers sending-account/day, recipient-domain/day, team/day, batch size,
worker concurrency, and bounded exponential retry. Defaults are deliberately conservative and are
not production recommendations.

Test transport is the default. Resend reuses the existing integration and requires all of an
explicit mode, enabled flag, release ID, release-ID-bound authorization phrase, release-ID-bound
rate approval, and API key. The canonical idempotency key is sent to Resend and the provider message
ID is stored. No release gate is enabled in committed configuration and no real email was sent.

`/api/webhooks/resend` requires a raw-body Svix signature, freshness window, and server-owned team.
Events de-duplicate on provider event ID, associate to a Message, emit Activity, update suppression
for bounce/complaint/rejection, and open an exception when deterministic association fails.

There is no configured production inbound mailbox. The authenticated reply adapter retains the
required correlation order: provider message/In-Reply-To, then unique sender/message fallback,
then ambiguity to the exception desk. A future receiving adapter must verify its provider signature,
retrieve headers/content server-side, and use a separately configured inbound domain.

## Operations and staging

Authenticated `/api/core/health` reports worker running state, pending/retry/dead-letter/uncertain
counts, failed imports, unresolved exceptions, last successful cycle, provider mode, and production
gate status without exposing secrets. `npm run worker:core` is a one-shot, team-scoped server worker.

No safe platform staging target or staging DNS is defined. The production compose configuration is
not suitable for staging. `docs/operations/dgtl-core-staging-runbook.md` defines the separate app,
database, volume, team, hostname, test transport, worker, webhook fixture, migration, and smoke path
required before production promotion.

## Legacy classification

| Path | Classification | Release decision |
| --- | --- | --- |
| `leads` | legacy but still required | Compatibility projection only; canonical imports do not blind dual-write |
| `outreach_campaigns` | legacy but still required | Old outreach UI remains operational; new campaigns are canonical |
| `draft_emails` | compatibility-only plus legacy required | Existing drafts still project into canonical reads; new drafts use Messages |
| `outreach_queue` | legacy but still required | Old worker remains separate; canonical outbox does not dual-write |
| legacy Resend send path | legacy but still required | Core reuses the integration behind stronger gates; old path needs later migration |

The first post-release migration should move the legacy `outreach_campaigns` / `outreach_queue`
cohort-and-send path onto canonical Contact, Opportunity, Campaign, and Message IDs. Maintaining two
independent delivery engines longer than necessary is the largest duplication risk.

## Verification evidence

- Phase 1 + Phase 2 + release-focused selection: 81/81 passed.
- Complete platform suite after patched dependency overrides: 407/407 passed.
- Production Next 15.5.23 build: compiled, type/lint checks passed, 54/54 static pages generated.
- Disposable migration validator: migrations 001–011 passed, repeat counts stable, cross-team insert
  rejected.
- Production-shaped restore: migrations 009–011 and deferred constraint validation passed.
- Worklog: 375/375 passed. Creator intake: 26/26 passed. Worklog MCP syntax passed.
- Repository: 160 JSON files parsed; 1,054 links checked with zero missing, 3 declared pending assets,
  and 5 known root-absolute warnings; roster and 8-file compliance checks passed.
- `npm audit --omit=dev`: zero vulnerabilities after locked PostCSS 8.5.26 and Sharp 0.35.3 overrides.
- Workflow YAML, restore shell syntax, and `git diff --check`: passed.

## Remaining release actions

1. Configure `Required DGTL Core checkpoint` as a required status check on `main`.
2. Review the broad branch delta against the older remote `main`; do not mix unrelated open PRs.
3. Create the isolated staging target and repeat with a fresh production backup.
4. Keep production transport disabled until a separately authorized send release and reviewed limits.
