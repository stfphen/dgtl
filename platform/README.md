# DGTL Platform

The application layer of the DGTL repo (`stfphen/dgtl`): a multi-tenant sales funnel
front end, an admin panel, and the sales tooling behind them (lead pipeline,
prospecting, outreach, telephony, checkout, funding).

Built on Next.js (App Router) + PostgreSQL. Tenants are data, not code — every funnel,
brand and pipeline is scoped to a tenant and a team, so the platform is never wired to a
single client. DGTL is the default brand of the admin surface; tenant-facing values
always come from tenant config at runtime.

## Quick start

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and any API keys you need
npm run migrate           # applies migrations/*.sql (idempotent)
npm run dev               # http://localhost:8088
```

Create your first owner account with `OWNER_PASSWORD=... npm run create-owner`
(the other owner/team values come from `.env`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server on port 8088 |
| `npm run dev:clean` | Same, after clearing `.next` |
| `npm run build` / `npm start` | Production build / serve on port 3000 |
| `npm test` | `node --test tests/*.test.js` |
| `npm run migrate` | Runs the SQL migrations in order |
| `npm run validate:migrations` | Rehearses migrations against disposable localhost PostgreSQL; requires the explicit isolation guard |
| `npm run worker:core` | Runs one bounded canonical outbox worker cycle using the configured transport |
| `npm run rehearse:stage3` | Runs the guarded Opportunity → isolated pitch → immutable versions → test deploy acceptance path |
| `npm run rehearse:stage4` | Runs the guarded Opportunity → approved Worklog delivery handoff acceptance against a real local Worklog server on a throwaway database |
| `npm run rehearse:stage5` | Proves HOME is a projection over canonical state on disposable PostgreSQL plus a real local Worklog |
| `npm run rehearse:stage6` | Proves the DGTL.chat scenarios A–J (grounded answers, proposals, injection defense, stale no-mutation) with the deterministic adapter — no AI provider needed |
| `npm run create-owner` | Bootstraps the first owner user + team |
| `npm run seed:tenants` | Seeds demo tenants |
| `npm run seed:funding-demo` | Seeds funding-program demo data |
| `npm run seed:enterprise-demo` | Seeds enterprise prospecting demo data |
| `npm run seed:outreach-demo` | Seeds outreach campaigns/queue demo data |

## Surfaces

- `/` — host-resolved tenant site (the tenant matched to the request's domain)
- `/t/[slug]` — the same tenant surface addressed by slug (checkout, lead capture,
  funding survey), rendered by the template the tenant selects
- `/home` — the Stage 5 HOME command center: attention, today, approvals, pipeline,
  delivery, health, recent activity, and the ⌘K search palette. Unclaimed app hosts land
  here from `/`.
- `/chat` — DGTL.chat: grounded conversational answers over canonical state and
  ActionProposals that only an explicit human confirmation turns into normal draft
  state. Requires `CORE_CHAT_PROVIDER`; unset shows a bounded unavailable state.
- `/admin/login` — DGTL-branded sign-in
- `/admin` — the tabbed admin shell
- `/companies`, `/contacts`, `/opportunities` — the routed DGTL Core commercial
  graph, with detail routes at `/<entity>/[id]`.
- `/imports` — staged CSV/TSV prospect import, mapping, normalization, duplicate
  review, approval, and compensating reversal.
- `/campaigns` — canonical opportunity/contact cohorts, personalized drafts, and
  exact campaign/message approval.
- `/operations/outbox`, `/operations/exceptions`, `/operations/worklog` — durable
  test-delivery state, the human exception desk, and the Worklog delivery bridge.
  The legacy admin remains available while workflows migrate.
- `/generation-jobs`, `/artifacts` — immutable generation context, bounded agent jobs,
  validation/review, artifact versions, test deployment, and exact Message attachments.
- `/api/core/health` — authenticated, team-scoped worker/outbox/import/exception health.

The admin shell has eight tabs: **pipeline**, **funding**, **prospecting**,
**accounts**, **outreach**, **calls**, **tenants**, **team**. Its styling lives in
`app/admin/dgtl-admin.css` (black + gold `#F0CF50`, Manrope) and is scoped to the admin
shell and login only, so public tenant funnels keep their own tenant branding.

## Sales modules

- **Lead pipeline** — inbound + imported leads, scoring, statuses, enrichment,
  AI research, CSV import/export.
- **Prospecting + batch builder** — sourcing batches via Google Places, Hunter and
  Apollo; account-based (enterprise) prospecting with target accounts, gated research
  and account campaigns.
- **Outreach** — templates, campaigns, an approval queue, drip/scheduled sends,
  suppression list, one-click unsubscribe, and a cron drain endpoint.
- **Telephony** — click-to-dial, inbound/outbound call handling, recordings,
  transcription, call outcomes and callback tasks.
- **Checkout / packages** — service package selection and Stripe checkout with
  webhook fulfilment.
- **Funding** — funding-program survey, scoring and admin review, matched back to
  leads and outreach.
- **Tenants + team** — tenant builder/editor, branding and media library,
  team members, roles and audit logging.

## Migrations

Run in order by `npm run migrate`; each file is idempotent.

| File | Adds |
| --- | --- |
| `001_initial_schema.sql` | Core schema: tenants, leads, contractors, draft emails, prospecting batches, outreach templates/campaigns/queue/events/suppression list |
| `002_team_auth_schema.sql` | Auth + org: users, teams, team memberships, sessions, audit logs |
| `003_team_scoped_business_data.sql` | `team_id` scoping on tenants, leads, contractors and draft emails |
| `004_telephony.sql` | Calls and call events, lead telephony fields, per-rep telephony settings |
| `005_tasks.sql` | Tasks entity for follow-ups and missed-call callbacks |
| `006_enterprise_prospecting.sql` | Account-based prospecting: target accounts and account campaigns |
| `007_media_assets.sql` | Team-scoped media library referenced from tenant config by id |
| `008_outreach_drip.sql` | Drip sequences and scheduled sends on outreach campaigns/queue |
| `009_core_domain.sql` | Additive DGTL Core graph, artifact/job/external-link registry, safe legacy backfill, and reversible import staging |
| `010_import_outreach_phase_2.sql` | Reviewed imports, canonical campaign cohorts, immutable message approvals, durable outbox, suppression, provider/reply association, and exception operations |
| `011_core_release_gate.sql` | Approved delivery envelopes, uncertain-outcome quarantine, worker heartbeats, indexes, and composite team-integrity constraints |
| `012_artifact_automation_phase_3.sql` | Artifact families and immutable versions, bounded job leases, deployment attempts, and exact Message–Artifact relationships |
| `013_worklog_operations_phase_4.sql` | Generic approved integration operations (idempotent, quarantine-aware) and external-link lifecycle/snapshot columns; no Worklog data copies |
| `014_dgtl_chat_command_layer.sql` | Assistant threads/messages/tool-run audit and ActionProposals (payload hash, precondition snapshot, expiry, CAS states, one live proposal per exact payload) |

The Core architecture, legacy mapping, and spreadsheet-import contract are documented
in [`docs/architecture/dgtl-core-phase-1.md`](../docs/architecture/dgtl-core-phase-1.md).
Stage 2's working revenue workflow and safety boundaries are documented in
[`docs/architecture/dgtl-core-phase-2.md`](../docs/architecture/dgtl-core-phase-2.md).
Stage 3's bounded generation, immutable Artifact, and test-deployment contract is documented in
[`docs/architecture/dgtl-core-phase-3.md`](../docs/architecture/dgtl-core-phase-3.md); worker and
staging procedures are in
[`docs/operations/dgtl-artifact-worker-runbook.md`](../docs/operations/dgtl-artifact-worker-runbook.md).
Stage 4's Worklog delivery bridge — approved idempotent Company/Opportunity handoff, read-through
status, and the capability audit that shaped it — is documented in
[`docs/architecture/dgtl-core-phase-4.md`](../docs/architecture/dgtl-core-phase-4.md).
Stage 5's HOME command center — the attention model, search, routing decision, and Stage 6 seam —
is documented in [`docs/architecture/dgtl-core-phase-5.md`](../docs/architecture/dgtl-core-phase-5.md).
Stage 6's DGTL.chat command & action layer — the trust chain, tool registry, ActionProposal
contract, and provider abstraction — is documented in
[`docs/architecture/dgtl-core-phase-6.md`](../docs/architecture/dgtl-core-phase-6.md).
The safe staging procedure is documented in
[`docs/operations/dgtl-core-staging-runbook.md`](../docs/operations/dgtl-core-staging-runbook.md).

## Configuration

All environment variables are documented inline in [`.env.example`](./.env.example) —
database, app URL, owner/team bootstrap, email (Resend), enrichment providers
(Google Places, Hunter, Apollo, SEC EDGAR, OpenCorporates), Stripe, Twilio, YouTube,
and the Claude/OpenAI credentials that power the AI tenant builder, deep research and
sales briefs. Copy it to `.env` and fill in only what the features you use require;
missing keys degrade to offline/mock behaviour rather than failing.
