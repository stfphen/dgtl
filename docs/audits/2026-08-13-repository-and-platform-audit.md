# DGTL repository and operating-platform audit

**Audit date:** 2026-08-13

**Repository:** `stfphen/dgtl`

**Audit branch:** `audit-for-full-integration`
**Scope:** tracked source, local WIP, local and remote branches, worktrees, open pull requests,
verification gates, current product architecture, and a recommended target architecture for the
DGTL operating engine.

## Executive assessment

The repository contains most of the required business capabilities, but they are assembled as
separate applications and file-based publishing systems rather than one coherent operating model.
The immediate problem is not a missing dashboard theme. It is the absence of a shared domain model,
stable integration boundaries, and a deterministic release gate.

The existing platform should be retained as the system of record and progressively decomposed into
routed product modules. It should not be rewritten all at once. The first product slice should join
contacts, companies, opportunities, research, pitch angles, assets, outreach activity, and Worklog
references around durable IDs. The publishing, audit, deployment, Worklog, and Terminal systems
should remain independently deployable and connect through authenticated APIs/MCP adapters.

Current release confidence is **red** for the main platform and **amber** for the wider monorepo:

- The required production build completed on merged local `main` with Next 15.5.23: compilation,
  type checks, 49 static pages, optimization, and trace collection all passed. It still fetches seven
  Google-hosted font families, so reproducibility depends on a third-party endpoint.
- The platform tests execute 356 cases, but five network-dependent enrichment tests fail. Treating
  these as permanently “known” failures makes the gate non-enforcing.
- A non-breaking dependency refresh reduced the production audit from eight vulnerabilities to three
  high-severity advisories. Removing the final three requires a deliberate Next.js 16 migration or
  an explicitly supported mitigation.
- Publishing link integrity is good (`missing=0`). Fourteen root-absolute pitch links were repaired;
  five unresolved links remain in the Hotels pitch because their intended full-pitch target does not
  exist. Three ESCOTT assets remain explicitly pending.
- Open PRs have no CI statuses. Most are isolated domain placeholders, two are superseded, and one is
  an unmergeable mixed-scope branch.
- The new Worklog v2 implementation is materially better than the tracked version and passes all 375
  tests. Its production database migration and backup/restore runbook still require a dry run.
- The three formerly untracked tenant modules contain no credentials and two are compatibility
  re-exports. The actual Polish Stone config is not publish-ready: it carries a `555` phone number and
  unsupported pricing, portfolio, partner-logo, and testimonial claims that require owner sign-off.

## Repository inventory

The repo has six practical surfaces today, although the root documentation describes only four:

1. `platform/` — Next.js multi-tenant CRM, outreach, telephony, funding, checkout, and admin.
2. `journal/`, `pitches/`, `deploy/`, `engine/` — publishing and prospect assets.
3. `apps/` — DGTL OS, Worklog, Worklog MCP, creator intake, and other standalone applications.
4. `sites/` — static client and DGTL domain sites.
5. `audits/` — generated/source audit deliverables and durable findings ledgers.
6. `ops/` — local n8n and ComfyUI workflow definitions.

The last two are legitimate concepts but are not yet part of the documented top-level contract. The
README, setup notes, link checker scope, ownership rules, and deployment policy should be updated to
recognize them explicitly.

## Current product architecture

### Main platform

The main admin experience is centralized rather than modular:

- `platform/app/admin/page.jsx` is approximately 1,900 lines and loads data for every major panel in
  one server render.
- `platform/lib/store.js` is approximately 3,350 lines and combines unrelated persistence concerns
  plus dual-backend behavior.
- `AdminTabbedShell.jsx` uses client state for eight major areas instead of addressable routes.
- The page fetches tenants, leads, contractors, drafts, batches, outreach state, calls, tasks, users,
  logs, accounts, and campaigns up front, even though most are not initially visible.
- The codebase has 53 API route files, eight migrations, and 356 tests. There is enough useful
  functionality to refactor incrementally; a ground-up rewrite would discard working behavior and
  multiply migration risk.

This structure explains why `dgtlmag.com` feels large and difficult to navigate: navigation state is
not reflected in URLs, boundaries are visual tabs rather than product modules, and the server must
assemble nearly the entire operating surface for one request.

### Existing adjacent systems

- `deploy/portal` publishes pitches to `pitch.dgtlmag.com` through `deploy.dgtlmag.com`.
- `deploy/report-host` and `deploy/report-portal` serve `dgtl.report`, `audit.dgtl.report`, and
  `deploy.dgtl.report`.
- `apps/worklog-mcp` already provides a zero-dependency MCP bridge over the Worklog API. Extend this
  bridge rather than creating a second Worklog database in the platform.
- `apps/dgtl-os` already provides the basis of a Terminal/OS surface through a browser terminal,
  Cloudflare Worker API, and Mac-local server.
- `engine/` and installed DGTL skills already generate audits, pitches, teasers, and reports. They
  need a stable job contract and artifact registry, not direct access to arbitrary UI state.

## Target operating model

The platform should be a modular monolith with explicit adapters around independently deployed tools.
The canonical relationship is:

`Contact → Company → Opportunity → Research / Approach → Asset → Sequence → Message → Activity`

Every external object should attach to one or more of these durable IDs. A pitch URL, audit report,
Worklog project, sent email, reply, task, and generated file should be a linked record, not prose in
an unrelated table or an unindexed filesystem path.

### Recommended information architecture

Replace the current tab collection with routed modules:

1. **Today** — assigned follow-ups, replies, failed jobs, approvals, due Worklog tasks.
2. **Contacts** — people, consent/suppression state, deliverability, source, and activity.
3. **Companies** — account research, signals, contacts, relationship history, and owner.
4. **Opportunities** — qualification, approach angle, stage, value, next action, and linked assets.
5. **Campaigns** — imports, cohorts, sequences, approvals, send state, replies, and metrics.
6. **Assets** — audits, pitches, teasers, reports, deployment versions, and share URLs.
7. **Operations** — Worklog projects/tasks, automation jobs, deployment health, and exceptions.
8. **Settings** — tenants, users, connectors, sending domains, templates, and policy.

Use entity pages or drawers for detail. Preserve the current features behind new routes while moving
one bounded workflow at a time. Add a global command/search palette only after the entity model and
permissions are reliable.

### Spreadsheet and outreach pipeline

Large contact spreadsheets should enter a staging pipeline rather than writing directly to leads:

1. upload and retain source metadata;
2. map columns to canonical fields;
3. normalize email, phone, company domain, country, and names;
4. preview validation and duplicates;
5. merge by deterministic rules with a reversible import batch;
6. enrich asynchronously with provenance and timestamps;
7. assign contacts to a campaign cohort;
8. require approval of the audience, template, assets, and sending policy;
9. enqueue idempotent messages in bounded chunks;
10. record provider events, replies, suppression, and follow-up activity.

Bulk sending must run through a job/outbox model with idempotency keys, tenant and domain rate limits,
unsubscribe enforcement, retry/dead-letter state, and a visible exception queue. Never make a browser
request responsible for completing a large send.

### Pitch and audit integration

Introduce an artifact registry with fields such as `artifact_id`, `opportunity_id`, `kind`, `slug`,
`source_path`, `build_commit`, `deployment_target`, `deployment_url`, `version`, `status`, and
`approved_at`. The generation flow should be:

`brief approved → skill job created → source generated → repository checks → human preview → deploy
approved version → attach immutable URL/version to outreach message`

The platform orchestrates and records this flow. The pitch/report deployers remain responsible for
hosting. A sent message should retain the artifact version it used even after a newer version is
published.

### Worklog integration

Keep `office.dgtl.at` authoritative for time, execution tasks, shifts, and client work records. Use
the existing Worklog MCP/API bridge for:

- linking a platform company/opportunity to a Worklog client/project;
- showing due tasks and exceptions in Today/Operations;
- creating approved delivery tasks from a won or active opportunity;
- importing completion/time summaries as activity, not duplicating editable timesheets;
- producing client digests and reports from the same linked identity.

Add external-link and sync-cursor tables in the platform. Do not create bidirectional field-by-field
replication until ownership and conflict rules are written down.

### Terminal / DGTL OS

DGTL OS should be the command and query layer over the same service APIs, not a privileged shortcut
to databases or SSH. Give it a tool registry with scoped tools for CRM, campaigns, assets, Worklog,
and deployments. Separate operations into:

- read-only queries that run immediately;
- draft actions that produce a preview;
- consequential actions (send, deploy, publish, delete, DNS) that require an approval record;
- background jobs that return a job ID and stream status/events.

The dashboard and terminal should consume the same APIs and authorization rules. This prevents the
LLM interface from becoming a second, untestable implementation of the business.

## Branch and pull-request audit

### Open GitHub pull requests

| PR | Scope | State | Disposition |
|---:|---|---|---|
| 13 | `dgtl.pics` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 14 | `dgtl.college` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 15 | `dgtl.mov` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 16 | `dgtl.chat` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 17 | `dgtl.ltd` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 18 | `dgtl.at` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 19 | `dgtl.rent` placeholder | mergeable, no checks | Close as superseded after deciding the real rent app's location. |
| 20 | `dgtl.report` placeholder | mergeable, no checks | Close as superseded by the report host/portal already on main. |
| 21 | `dgtl.gallery` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 22 | `dgtl.wiki` placeholder | mergeable, no checks | Hold for screenshot/content acceptance. |
| 23 | mixed DGTL Neon + ops + diagnostics | unmergeable | Close after its useful commits are integrated in scoped commits. |
| 24 | isolated DGTL Neon site | mergeable, no checks | Keep as the review PR or supersede with the integration branch. |

No open PR reported a CI/check status. Merging placeholders because Git reports “mergeable” would be
a content and deployment decision without a release signal.

### Local branches

- `audit-for-full-integration` is the active integration line.
- `feat/report-deploy` and `feature/worklog-mcp` contain the report/Worklog MCP history already
  represented by the squash commit on `origin/main`, plus the report go-live fix on the audit line.
- `claude/sweet-wozniak-cc9baf` contains one valid creator-template path fix and should be merged.
- `feature/dgtlneon-site` contains useful but mixed-scope WIP; its valid site, ops, and diagnostics
  changes should land as separate commits before the branch is retired.
- `feat/dgtl-rent-site` is a real 3D Node application with about 105 files and large model assets.
  It conflicts with the current `sites/` rule (“static, no build step”) and must be reclassified to
  `apps/` or accepted through a documented architecture decision before merge.
- `feat/creator-intake`, `feature/casper-pack-and-journal-deploy`, and
  `fix/stale-vps-ip-in-deploy-docs` are diverged primarily because main received squash merges. Their
  patch content is already represented on main; do not re-merge old history merely to make the graph
  look tidy.
- `consolidate-vps`, `feat/coolify-deploy`, `feat/root-to-admin`, `release/vps-prep`, and ten
  `worktree-wf_*` branches are already ancestors of `origin/main`. They are deletion candidates after
  one human review of branch-retention policy.
- The `feat/site-*` branches correspond to the open placeholder PRs and should follow their PR
  disposition.

Remote-only historical/deployment branches should be archived or deleted only after a retention pass:
`chore/dgtlmag-domain-and-dgtl-pay-golive`, `deploy/creator-intake`, `deploy/site-*`,
`feat/dgtl-pay-v4-and-pitch-funnel`, `feature/skill-integration`, and the completed `fix/*` branches.

### Worktrees

| Worktree | State | Action |
|---|---|---|
| repository root | active integration work | Keep. |
| `.../scratchpad/wt-rent` | directory missing; registration prunable | Prune stale metadata only. Preserve branch. |
| `.claude/worktrees/project-zip-dev-comparison-4f5677` | live; dead temp launch paths and untracked instruction copy | Keep until its PR/branch decision; do not delete user work. |
| `.claude/worktrees/sweet-wozniak-cc9baf` | live; creator path fix committed | Merge fix, then remove only with explicit final confirmation. |

## Engineering risks and non-standard areas

### P0 — release blockers

1. **Make the verified platform build deterministic.** Self-host/pin the seven font families or
   reduce the set; remove build-time dependence on Google font downloads and run the build in CI.
2. **Create a real required CI gate.** Platform tests/build, Worklog tests, creator-intake tests and
   PHP lint, JSON validation, and the repository link check must report on every relevant PR.
3. **Back up and dry-run the Worklog v2 schema migration.** Verify restore, not only migration.
4. **Resolve remaining high production advisories.** Plan and test the Next.js 16 upgrade or document
   a supported backport/mitigation with an expiry date.

### P1 — product and data integrity

1. Define canonical Contact, Company, Opportunity, Asset, Campaign, Message, Activity, and External
   Link entities with tenant ownership, audit fields, and stable IDs.
2. Introduce import staging, deduplication, provenance, suppression, and reversible batch semantics.
3. Move sending to an idempotent worker/outbox and expose its failure queue.
4. Add the artifact registry and approval gates before automating pitch/audit attachment.
5. Extend Worklog MCP for clients, shifts, reconciliation, and digest APIs introduced by Worklog v2.
6. Route the admin modules and split `page.jsx` and `store.js` behind tested service boundaries.

### P2 — repository hygiene and operability

1. Update top-level documentation for `audits/`, `ops/`, current domains, and actual deploy ownership.
2. Resolve the five Hotels pitch links after identifying their intended target, and supply or
   explicitly retire the three pending ESCOTT assets.
3. Separate network integration tests from deterministic unit tests. A known failure should be skipped
   with an explicit condition or supplied a fixture; it should not make the primary gate permanently red.
4. Add CODEOWNERS or an equivalent ownership map for platform, apps, publishing, deploy, sites,
   audits, and ops.
5. Adopt branch retention: delete merged temporary branches after a short grace period; label parked
   experiments; prohibit mixed-scope PRs.
6. Remove ignored `.DS_Store` files from local trees and keep generated review bundles outside the
   canonical source path.

## Recommended delivery sequence

### Phase 0 — stabilize the foundation

- deterministic fonts and green platform build;
- required CI and dependency policy;
- Worklog migration/restore rehearsal;
- branch and PR retirement pass;
- production secrets, endpoint rate limits, backups, and deployment ownership review.

### Phase 1 — new routed CRM shell

- introduce the target routes and shared entity header/search;
- build Contacts, Companies, and Opportunities over existing data first;
- move one workflow at a time from the tab shell;
- keep old routes available behind a feature flag during migration.

### Phase 2 — import and outreach engine

- spreadsheet staging/mapping/dedupe;
- campaign cohorts, approval, and outbox workers;
- delivery/reply/suppression activity timeline;
- operational exception desk.

### Phase 3 — audit and pitch assets

- artifact/job registry;
- skill adapters for audits, pitches, teasers, and reports;
- preview/check/deploy/attach workflow with immutable versions.

### Phase 4 — Worklog operations bridge

- durable external links and sync cursors;
- Today/Operations projections;
- approved task creation and client delivery digests.

### Phase 5 — DGTL OS control plane

- unified tool registry and permissions;
- query, draft, approval, and background-job interaction modes;
- dashboard status stream using the same APIs as the terminal.

## Verification evidence

Commands run during this audit:

| Command | Result |
|---|---|
| `python3 tools/check-links.py` (initial) | exit 0; `checked=1040 missing=0 pending=3 root_absolute=19` |
| `python3 tools/check-links.py` (after safe link fixes) | exit 0; `checked=1054 missing=0 pending=3 root_absolute=5` |
| `cd apps/creator-intake && php tests/run.php` | `26 passed, 0 failed` |
| PHP lint on new creator diagnostics/status/mailer | no syntax errors |
| `cd platform && npm test` | 356 total; 351 pass, 5 network-dependent enrichment failures; exit 1 |
| `cd platform && npm run build` (sandbox) | failed resolving Google font hosts |
| `cd platform && npm run build` (network permitted, first attempt) | failed after retries fetching Geist Mono from `fonts.gstatic.com` |
| `cd platform && npm run build` (merged `main`, final) | exit 0; Next 15.5.23 compiled, type-checked, generated 49/49 static pages, and collected build traces |
| `cd platform && npm audit --omit=dev` before refresh | 8 production vulnerabilities: 6 high, 2 moderate |
| `npm update next` and `npm audit fix --omit=dev` | Next 15.5.23 locked; 3 high remain; no forced major upgrade |
| old tracked `cd apps/worklog && npm test` | 55 pass, 1 fail; exposed test DB isolation bug |
| promoted Worklog v2 `cd apps/worklog && npm test` | `375 passed, 0 failed` |
| creator feature template validation at hub and nested output depths | `9 ok, 1 og:image warning, 0 failures` for each |
| JSON validation for pitch manifests/index, audit ledger, and ops workflows | valid JSON |
| repository object check `git fsck --full --no-reflogs` | no corruption; four dangling commits and two dangling trees, recoverable through normal Git retention until garbage collection |

The build gate is green. The overall release gate is not: five tests and three high production
dependency advisories remain, so this audit does not claim the current platform is production-ready.

## Definition of success for the next release

A release is ready when all of the following are true:

- a clean checkout installs and builds without fetching mutable font assets;
- deterministic tests and link checks are green in required CI;
- remaining advisories have a reviewed resolution or time-bounded exception;
- Worklog v2 migration and restore are rehearsed against a production-shaped copy;
- Contacts, Companies, and Opportunities have routed URLs and stable IDs;
- one spreadsheet can be imported, deduplicated, approved, and sent through an idempotent queue;
- one opportunity can generate, verify, deploy, version, and attach an audit/pitch asset;
- one Worklog project can be linked without duplicating ownership of tasks/time;
- DGTL OS can query the workflow and submit an approved job through the same APIs as the dashboard.
