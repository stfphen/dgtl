---
title: 53 · Known Issues, Risks & Tech Debt
type: log
tags: [audit, security]
status: living
updated: 2026-08-14
source: docs/SECURITY_REVIEW.md, docs/audits/2026-07-02-codebase-audit.md, status docs
---

# Known Issues, Risks & Tech Debt

Open problems. Full security analysis in [[61-Security-Review]]. **Update status here as items are fixed.**
Latest sweep: `docs/audits/2026-07-02-codebase-audit.md` (branch `audit/2026-07-02`).

## Repository/platform integration audit (2026-08-13)

- ✅ **Core 009–011 rehearsed on a production-shaped copy (08-14).** The sealed 2026-07-21 dump
  restored into isolated PostgreSQL 16; backfills reconciled, repeat execution was stable, all
  deferred team constraints validated, and there were zero orphans/cross-team rows. Remaining risk:
  that dump is not current. A fresh backup/restore and isolated staging run are mandatory before
  production. `docs/operations/dgtl-core-release-checkpoint.md` · [[13-Data-Model]]
- **Legacy and canonical outreach engines still coexist.** Canonical imports/campaigns/messages do
  not blindly dual-write, while legacy lead/outreach features retain their existing tables. The first
  post-release migration should move `outreach_campaigns`/`outreach_queue` onto canonical IDs; two
  independent delivery concepts are the largest duplication risk.
- ✅ **Composite team-aware relationships added in migration 011.** All Core routes derive team from
  the authenticated session and direct-ID attacks are covered. PostgreSQL RLS remains future
  defense-in-depth and should be designed platform-wide before generalized agent writes.

- ✅ **Platform migration build verified 2026-08-13.** Final `npm run build` on merged local `main`
  with Next 15.5.23 compiled, type-checked, generated 49/49 static pages, collected traces, and exited
  0. Earlier attempts failed fetching Geist Mono, so the root layout's seven Google font families
  remain a reproducibility risk. Self-host/pin or reduce them and make the build required CI.
- ✅ **Three high production dependency advisories resolved 2026-08-14.** Narrow lockfile overrides
  use patched PostCSS 8.5.26 and Sharp 0.35.3 without a breaking Next 16 upgrade. `npm audit
  --omit=dev` reports zero vulnerabilities; platform tests pass 407/407 and production build passes.
- ✅ **Primary platform test gate repaired 2026-08-13.** Five enrichment fixtures mocked `fetch` but
  not the SSRF guard's preceding DNS lookup. The lookup is now injectable through the enrichment
  path, tests use a fixed public address, production continues to resolve and validate real DNS, and
  the complete suite passes 356/356.
- **Worklog v2 passes 375/375 tests but is not production-migration verified.** Back up the live
  database, dry-run schema migration and restore against a production-shaped copy, then extend
  `apps/worklog-mcp` for the new client, shift, reconciliation, and digest endpoints before deploy.
- **Five root-absolute pitch links remain**, all in `pitches/hotels/index.html`, pointing to a
  nonexistent `/full/` target. Fourteen other invalid teaser links were repaired. Choose the actual
  full pitch or remove the calls to action. Three ESCOTT media files remain declared pending.
- **Twelve pre-existing open GitHub PRs had no CI statuses.** PRs 19 and 20 are superseded; PR 23 is an
  unmergeable mixed-scope branch; PRs 13–18 and 21–22 are unverified domain placeholders; PR 24 is
  the isolated DGTL Neon review branch. See the 2026-08-13 audit before merging or closing them.
- **Polish Stone tenant content is not publish-ready.** The three formerly untracked modules contain
  no credentials; `nowakStoneworks.js` and `dziuraStoneTile.js` are compatibility re-exports. The
  actual config contains `(437) 555-0140` plus pricing, portfolio, partner-logo, and testimonial claims
  with no recorded provenance. Replace/verify every one with the owner before enabling the tenant.

## 🔴 Security — Critical
| ID | Issue | Location | Fix |
|---|---|---|---|
| **C1** | Live API keys were in plaintext `.env`, exposed in session logs (Resend/Google/Hunter/Apollo). Confirmed **never git-committed** (07-02 audit). | `.env` | Rotate all four (ops). [[44-Secrets-And-Rotation]] |
| ✅ **C2 — RESOLVED (07-02)** | **SSRF** in enrichment fetcher. Fixed: `lib/enrichment/ssrfGuard.js` (scheme allowlist + private/reserved/metadata IP block + per-redirect-hop revalidation via `safeFetch`), wired into `website.js`. Tests: `tests/ssrf-guard.test.js`. | `lib/enrichment/website.js` | — [[24-Enrichment]] |

## 🟠 Security — High
| ID | Issue | Location | Fix |
|---|---|---|---|
| ✅ **H1 — PARTIALLY RESOLVED (07-02)** | Login now rate-limited (`lib/rateLimit.js`, 10/min/IP) + bcrypt-timing equalizer. Still no global middleware for the other public POSTs. | `POST /api/admin/login` done; `/api/leads`, `/api/checkout`, `/api/funding/survey` still unthrottled | Extend limiter to remaining public POSTs. |
| ✅ **H2 — RESOLVED (07-02)** | Enrich IDOR + a broader cross-team lead read/write class. Fixed: `getLeadById`/`updateLeadResearch` take `{teamId}` and filter both backends; enrich/enrich-batch/research/fill-missing/research-from-query/funding-review pass session team; enrich routes now `requireRole`. Also fixed cross-team `updateUserStatus` lockout. Tests: `tests/tenant-isolation.test.js`, `tests/users.test.js`. | `app/api/admin/leads/*`, `lib/store.js`, `lib/users.js` | — [[21-Admin-Shell]] |
| **H3** | Weak prod DB password `content_funnel`. | VPS `.env` | Strong generated password (ops). [[44-Secrets-And-Rotation]] |
| ✅ **H4 — RESOLVED (07-04)** | **Unsubscribe amplification.** Fixed: `/api/unsubscribe` requires an HMAC-signed token (`lib/outreach/unsubscribe.js`, {email,tenantId,teamId}) and writes a **team/tenant-scoped** suppression — no more `tenant_id=NULL` row that suppressed an address for every team. Added an RFC-8058 one-click POST + `List-Unsubscribe` headers on sends. Test: `tests/outreach-send.test.js` (H4 regression). | `app/api/unsubscribe/route.js` | — (Superseded M3.) |

## 🟡 Security — Medium / Low
| ID | Issue | Location |
|---|---|---|
| ✅ **M1/M2 — RESOLVED (07-02)** | `sanitizePublicLeadInput()` whitelists public fields on `POST /api/leads` **and** `/api/checkout` (checkout had the same uncatalogued hole); teamId/status/score/assignee no longer client-forgeable. `funding/survey` was already safe. Test: `tests/public-lead-input.test.js`. |
| **M3** | Folded into **H4** above (unsubscribe). |
| ✅ **L1 — RESOLVED (07-02)** | `permissionDeniedResponse` now returns 401 JSON to fetch/XHR callers; navigations still redirect. Test: `tests/permissions-response.test.js`. |
| **L2** | `SESSION_SECRET` referenced in docs/`.env.example` but never read in code. |
| **L3** | Historic `.env.example` shipped `ADMIN_PASSWORD=change-this-password` placeholder. |
| **L4 (NEW)** | `telephony/transcription` webhook accepts unsigned requests (proceeds when `X-Twilio-Signature` absent); the other four telephony callbacks hard-require a valid signature. Low impact (limited to our own account's transcripts). | `app/api/telephony/transcription/route.js` |
| **L5 (NEW)** | Portfolio embed `<iframe src>` has no scheme allowlist (admin-controlled data, so low risk). | `components/FunnelPage.jsx` |
| ✅ **L6 — RESOLVED (08-14)** | The July snapshot and 08-13 three-high snapshot are obsolete. Locked overrides now resolve PostCSS 8.5.26 and Sharp 0.35.3; audit is zero and Next 15 tests/build pass. | `platform/package.json`, lockfile |

## 🐛 Functional / correctness (NEW — 07-02 audit)
- ✅ **RESOLVED: pipeline status not validated on update.** `updateLeadStatus` now rejects statuses outside `pipelineStatuses` (Postgres stored junk verbatim; file store silently reset the lead to `new`). Test: `tests/lead-status-validation.test.js`.
- ✅ **RESOLVED: buying-committee promotion collapsed to one lead per account.** All committee members shared domain+business+website, so `shouldSkipReliableDuplicate` merged them; the response over-reported `promotedLeads`. Fixed: email now distinguishes people in dedupe; promotion counts only non-duplicates. Test: `tests/committee-dedupe.test.js`.
- **OPEN — pg-vs-file-store dedupe parity (HIGH):** the Postgres `createLead` branch inserts unconditionally — `shouldSkipReliableDuplicate` runs **only** in file-store mode. In production (DATABASE_URL set) re-imports create duplicate leads and never return the `skippedDuplicate` flag callers rely on. No DB unique constraint either. Fix: replicate the dedupe in the pg branch (or a partial unique index + `on conflict do nothing`). `lib/store.js` `createLead`.
- **OPEN — file-store write race (HIGH, dev/CI path only):** every mutation is an unserialized read-modify-write of `data/app-store.json` with a non-atomic full-file write. Concurrent requests lose updates; a crash mid-write truncates the store. Prod uses Postgres so impact is dev/CI. Fix: in-process write mutex + temp-file+rename. `lib/store.js`.
- ✅ **RESOLVED (07-04): outreach double-send race.** The send engine now claims each item via an atomic `claimOutreachQueueItem` (approved→sending compare-and-set; Postgres `UPDATE … WHERE status='approved'`, file-store mutex) before sending, so a concurrent/double-submit loses the race and is skipped. `lib/outreach/sendQueue.js` + `lib/store.js`. Test: `tests/outreach-send.test.js` (double-send).
- **OPEN — Stripe webhook idempotency (LOW/MED):** no persisted `event.id` dedup (only a read-then-write on `order.status`); the `leadMissing` path ACKs 200 (loses the event); no idempotency key on session create. Benign today, dangerous once fulfillment gains side effects. Fix: `processed_stripe_events(event_id PK)` insert-or-ignore before fulfilling; return 500 on lead-lookup error. `app/api/webhooks/stripe/route.js`.
- **OPEN — batch import non-idempotent / no double-submit guard (MED):** re-running an import re-increments counts and can double-create non-dedupable rows; a mid-loop throw leaves the batch non-completed. Fix: guard on `batch.status`, per-row try/catch, recompute (not add) counts. `app/api/admin/prospecting/batches/import/route.js`.
- **OPEN — no delete path for leads/batches/accounts (INFO):** only `deleteCall` exists (cascades correctly). Stale `batchId`/`campaignId`/`metadata.accountId` refs are never cleaned; bad records can only be removed by hand-editing the store.

## 🐛 Creator intake (`apps/creator-intake/`) — opened 08-04
- **OPEN — the live deployment is `dgtl.press`, but the code and docs still say `join.dgtlinfluence.com` (HIGH).**
  `deploy.sh`'s default domain, the README provisioning steps, and the `canonical`/`og:url` tags in
  `site/index.html`, `apply.html`, `thanks.html`, `terms.html` all name the old subdomain. Cosmetic in the
  tags; **not cosmetic in `.env`** — `require_json_post()` 403s any browser call whose Origin host differs
  from `APP_URL`'s host (`bad_origin`), so a stale `APP_URL` silently blocks every draft save and every
  submit before a row is written. `/admin/status.php` now checks exactly this. Decide the canonical domain,
  then fix `.env`, the four HTML files, `deploy.sh` and the README in one pass.
- **UNVERIFIED — nobody has confirmed which database production is writing to, or that mail leaves the box.**
  Reported symptoms (submissions possibly not landing, no admin emails) are consistent with any of:
  `APP_ENV` ≠ `production` (falls back to the SQLite dev file *and* to `dev-mail/*.eml`), the `APP_URL`
  mismatch above, empty `SMTP_PASS` (send skipped, request still succeeds), or unset `ADMIN_NOTIFY_EMAIL`
  (applicant receipts go out, admin notification never fires). `/admin/status.php` distinguishes them —
  run it before changing anything.
- **INFO — silent-by-design failure paths.** A failed receipt must never fail a submission, so mail errors
  are non-fatal; and `presign.php`/R2 misconfiguration surfaces to the applicant as a stuck upload step,
  not as an alert. The status page's drafts-stalled-by-step counter is the tell (a pile-up on step 3 means
  R2, not shy applicants). There is still **no alerting** — nothing pages anyone when submissions stop.

## ⚡ Performance (NEW — 07-02 audit, DB layer)
- **Missing indexes (MED):** `outreach_*` and `prospecting_batches` have PK-only indexes but are queried by `tenant_id` join + `created_at/updated_at` order; `leads`/`calls` tenant-only filters can't use the team-leading composite indexes; audit-log team filter is an unindexable `metadata->>'teamId'` expression. Concrete `CREATE INDEX` list in the audit report — propose as migration `007_performance_indexes.sql`.
- **N+1 write loops (MED):** bulk lead import, outreach enqueue (+per-item event) run per-row INSERTs with no surrounding transaction. Fix: multi-row INSERT inside `withTransaction`.

## ⚙️ Operational / tech debt
- ✅ **RESOLVED (08-01) — Creator-feature template shipped stale relative paths; every new pack failed
  `validate.py` with ~25 broken local refs until someone hand-rewrote them.**
  `engine/dgtl-creator-features/assets/creator-feature-template.html` still carried the *pre-pack*
  layout: `../assets/dgtl-editorial.css`, `../assets/journal.js`, `../assets/logos/…`,
  `../index.html`, `../cases/…` — plus a related-card pointing at `peter-mckinnon.html`, a sibling
  that has never existed. Under the pack model those needed `../../_shared/…`, `../../index.html`,
  `../../cases/…`. **Why it went unnoticed:** `tools/check-links.py` scopes to `journal/`, `pitches/`
  and `sites/` — it does not scan `engine/`, and it *cannot* usefully do so, because the template's
  paths are correct relative to a pack hub, not relative to where the file itself sits. So the only
  thing that ever caught this was `validate.py`, i.e. after each pack was already built.
  **Fix (two halves, both needed):** the template now ships pack-hub-correct paths, *and*
  `populate.py` re-depths them from `--out` (`journal_depth()` + `reroot()`), so a feature page at
  `packs/<slug>/features/<x>.html` gets `../../../_shared/…` automatically. That second half is what
  makes SKILL.md's hub-vs-feature path table true as written — fixing only the template would have
  left feature pages broken at the other depth. Own-media paths still come from `fields.json` and are
  deliberately untouched by the rewrite (it runs before media injection). Verified by populating the
  example fields to both depths: 0 failures from `validate.py` with no manual path editing.
  [[16-Design-System]]
- ⚠️ **RECURRING (07-13): git commits succeed but every in-sandbox commit leaves stale `.git/*.lock`
  files behind — clear them on the Mac.** Good news: the original 07-04 blocker is gone and commits now
  land — FAYELLA committed `4d12dfe` on the Mac (07-12 23:10) and the 07-13 brain sync committed
  `32ddc28`. Root cause of the recurrence is now understood: the Cowork **FUSE mount forbids `unlink`**,
  so after a successful commit git cannot remove its own `.git/HEAD.lock` + `.git/index.lock` (and the
  `.git/objects/*/tmp_obj_*` temp objects) — they persist as 0-byte files and will block the *next*
  commit until removed. Fix (on the Mac, not from the sandbox): `rm -f .git/HEAD.lock .git/index.lock`
  before the next `git` write. Automation must NOT delete lock files itself (see [[CLAUDE-Operating-Rules]]).
  Same failure family as 06-29 and 07-11. ~~**Still present 07-15:** the 0-byte `.git/HEAD.lock` +
  `.git/index.lock` (dated 07-13) remain and blocked the 07-15 auto-sync commit — the 07-13→07-15 brain
  edits (this Journal/skill entry included) are staged in the working tree, uncommitted, until the Mac
  clears the locks.~~ **Update 07-16 (auto-sync):** the 07-13 locks were cleared and commits flowed
  again — `a1e65f5` (07-15 20:13) through `61fd3bb` (07-16 06:36) all landed; the once-stranded brain
  edits are committed (`775f301`, `b98226f`, `61fd3bb`). The pattern immediately recurred, though: the
  07-16 sandbox session stranded a fresh **live 0-byte `.git/index.lock` (06:36)** plus inert
  `HEAD.lock.orphan*`/`*.done*` copies and `tmp_obj_*` files — the live `index.lock` blocks the next
  git write (including today's auto-sync commit) until removed on the Mac
  (`rm -f .git/index.lock` + sweep the `*.orphan*`/`*.done*`/`tmp_obj_*` debris).
- **OPEN — Higgsfield trial fulfillment stuck (07-11, blocks scroll-world generation):** trial
  Stripe checkout completed via Apple Pay ($0 card-setup, no money charged) but Higgsfield's
  `payment-success` page 404s and the account stayed `free` (transactions empty, trial pending);
  the MCP connector session then invalidated. Reconnect + re-verify DONE later 07-11: account
  STILL free (0 transactions, generation refused) — fulfillment broken on Higgsfield's side.
  Next: user escalates to Higgsfield support/Discord with the receipt — **do not check out
  again**. ⚠️ If the trial
  DOES activate, it auto-renews to Plus **$49/mo after 3 days** unless "cancel auto-renewal" is
  said in a Higgsfield-MCP chat. Runbook: `prototypes/dgtl-scroll-world/spec/journey.md`.
- **Cowork sandbox network allowlist is fixed at boot** (07-11): mid-session settings changes
  don't apply; higgsfield.ai/api/upload/result-CDN, storage.googleapis.com and GitHub release
  assets are blocked; background processes are killed between bash calls (45 s cap). Any
  long-running or byte-heavy external pipeline must run host-side (MCP / Chrome extension) or
  in a fresh session after widening network access. [[51-Timeline]]
- ✅ **RESOLVED (06-29): stale `.git/*.lock` files cleared** — git ref ops work again (commits flowing on `feature/ui-overhaul`). No lock files remain.
- ✅ **RESOLVED (06-29): enterprise-prospecting MVP committed** (`87f94a6`); `lib/enterpriseProspecting/*`, `app/api/admin/accounts/**`, `AccountsPanel.jsx`, `migrations/006_*`, seed + tests are now tracked. ⚠️ Still run `npm run migrate` + `npm run build` on a real machine before deploy (sandbox lacks Linux SWC). [[2C-Enterprise-Prospecting]]
- **Pre-existing test flake in sandbox:** `tests/core.test.js` → "updateLeadResearch works in file-store mode" fails with `EPERM unlink data/app-store.json` (old test deletes the real store file; sandbox FS forbids it). Passes on a normal filesystem. Not a code defect; consider migrating that test to the `APP_STORE_PATH`-tmpdir isolation pattern. [[62-Testing]]
- **`next build` can't run in the cloud sandbox** (only the macOS SWC binary is vendored; no Linux/wasm SWC + no npm network). Build/typecheck must run on the operator's machine or CI.
- **Branch sprawl** (~15+ local + backups + wip/rescue + remotes) — needs consolidation. [[47-Git-Workflow]]
- **`team_default` workaround** — built-in tenants tied to one team; blocks clean multi-team onboarding. [[15-Multi-Tenancy]] / [[33-Sprint-2-Productization]]
- **No `lint` script** despite the mobile prompt referencing `npm run lint`. [[11-Tech-Stack]]
- **VPS drift risk** — ✅ RESOLVED 2026-07-03: VPS runs the current tip (`main@14a746b`, smoke green;
  migrations 006+007 applied, 5/5 tenants seeded, uploads volume mounted). Keep it current via
  `docs/DEPLOY_NEXT.md`. Still missing: an uptime monitor (Phase 12) to catch 502s automatically.
  [[42-Go-Live-Plan]]
- Provider hardening (retries/rate-limits/quota) outstanding. [[23-Prospecting]]
- **PLANNED-SURFACE (watch): media upload endpoints** — the proposed portfolio/media library
  ([[2D-Portfolio-Media]]) adds a file-upload surface (`POST /api/admin/media`). It must ship **after** the
  open security fixes and with: mime allowlist + magic-byte sniff, size caps, team-scoped IDOR checks
  (cf. H2), rate limiting (cf. H1), path-traversal-safe storage keys, and SSRF guards on any server-side
  URL fetch/thumbnailing (cf. C2). Do not point `next/image` at arbitrary uploaded remote hosts.

## 🎨 Template library — deferred polish (07-04 build, from the visual audit)
- **Full-bleed hero dead band:** on image-backed heroes the brandbar + content sit ~200px down at
  desktop and ~550px on mobile (headline lands near/below the first fold; mitigated by the sticky
  bottom CTA bar). Pre-existing flagship design, so left frozen — revisit as a hero-variant option,
  not a global change. [[16-Design-System]]
- **Output section band is near-black in every direction** (`.section--black`): fine for
  premium-agency/dark-cinematic, jarring on warm-boutique/editorial-minimal. A per-direction surface
  needs a new `--fp-*` token → unfreezes the closed `DIRECTION_TOKEN_KEYS` set; deferred deliberately.
- **Split hero × large display sizes:** editorial/dark serif h1 clamps don't fit 5+ word headlines in
  a half-width column. Mitigated (B2B preset no longer forces split; generator caps hero headlines at
  3-5 words); the token-level fix (split-specific size) is deferred with the same unfreeze caveat.
- **`.brandbar__login` ghost button** can be near-invisible over bright hero photos (needs a scrim or
  stroke treatment).
- **Package grid renders full-width stacked cards at ≥1440px** on some directions — audit flagged it
  as looking unfinished; pre-existing behavior, evaluate a 3-up desktop rule against prod tenants first.
- **Logo slots show placeholder photography** until real client marks are uploaded per tenant
  (`docs/design-research/asset-prompts.md` documents the policy); vertical × direction asset packs not
  yet generated (prompt sheet ready).
- **TenantEditor has no vertical/variant UI** — preset + sectionVariants are settable via manual patch
  only; the builder-side picker exists. Small follow-up if operators want to retune existing tenants.

## 🏷️ DGTL Group agency page — open items for the team (07-04 build)
- **Founder name NOT printed anywhere** on `/t/dgtl-group`: public snippets say CEO "Will Giroux",
  internal anchors reference owner "Stephen" (stephen@dgtlgroup.io). Needs team confirmation before
  any name goes on the page.
- **dgtlgroup.io visual identity unverified:** the live site returned 403 through this session's
  egress (search snippets only). The page is designed from the logo asset + verified facts; wants a
  human eyeball pass against the real site.
- **No real work imagery yet:** the page is deliberately typographic (no picsum stand-ins next to
  real artist names). Needs: hero/results/about stills from the team, then image slots added to the
  `agency` block.
- **Domain go-live plan:** config claims `dgtlgroup.io`/`www.dgtlgroup.io`, but DNS still points at
  the WordPress-ish site. Plan needed: point the domain at the platform (Traefik host rule + cert),
  seed prod with `npm run seed:tenants -- --only dgtl-group`, then verify host resolution.
- **DMTV shown as a client brand on DGTL's page:** fine (it is DGTL's platform), but the DGTL↔DMTV
  relationship was previously internal-only knowledge — flag to the team that it is now public copy.
- **Observation (dev-mode):** every `/t/<slug>` page's RSC payload appears to serialize the full
  tenants array (other brands' configs visible in any page's HTML source). Pre-existing (also true
  of `dmtv-studio`), mostly-public marketing content, but worth confirming on a prod build and
  trimming the payload to the resolved tenant.

## 📦 Post-migration risks (2026-07-25)

| ID | Issue | Detail | Fix |
|---|---|---|---|
| **M1** | **~556 MB of prototype renders exist only on the Mac, with no backup.** | `prototypes/` (scroll-world + tower-3d video, netlify builds, a 184 MB zip, plus Finder-duplicate `… 2`/`… 3` dirs) is not in this repo and was **never** tracked in `content-checkout-funnel` either — that `.gitignore` excluded it from the start because the zip exceeds GitHub's 100 MB file limit. Not a regression, but a single disk failure loses all of it. | Decide a home: LFS in a dedicated archive repo, or object storage (S3/R2/Backblaze). Exclude the 184 MB zip and the duplicate dirs either way — the zip is a redundant build archive. **Partial mitigation 2026-07-28:** every *deployed* pitch site (18 slugs) is now tracked in `pitches/` via the VPS offboard bundle — only unshipped renders/WIP remain Mac-only. |
| ✅ **M2 — RESOLVED (08-13)** | **`npm run build` is verified on the migrated tree.** | Final merged-local-main run compiled, type-checked, generated 49/49 static pages, collected traces, exit 0. Font downloads remain a reliability risk, tracked above. | Put the same command in required CI and self-host/pin fonts. |
| ✅ **M3 — CODE REVIEWED (08-13), CONTENT GATE OPEN** | **Three tenant modules had been untracked in the old repo.** | They contain no credentials. Two are compatibility re-exports; Polish Stone is the actual config and uses bundled assets. Its `555` phone and unsupported commercial claims prevent publication. | Owner verification and real contact/routing data before enabling. |
| **M4** | **~30 branches and open PR #2 stayed in the archive.** | This repo starts from one squashed commit. `feature/platform-landing` had unpushed commits; PR #2 (AI prospect enrichment) was never merged or closed. | When a feature looks missing, read it out of the archive and re-apply as new work here. Never add the old repo as a remote. |
| **M5** | **Stale `.git/index.lock` is a recurring failure mode — third occurrence.** | `dgtl-repo/.git/index.lock` + `HEAD.lock` (07-24 22:38) stranded this repo's bootstrap commit, leaving `main` with zero commits despite a complete tree. `content-checkout-funnel/.git/index.lock` dates to **07-19** and blocked that repo for six days — which is why the 07-19/07-20 auto-sync brain edits are still staged-but-uncommitted there. | Check `ls .git/*.lock` before any commit run. If a commit fails, clear the stale lock rather than retrying blindly — a silent retry loop is how six days were lost. |

## 🔀 Branch/merge risks (2026-07-16)
- **`feature/platform-landing` ⇄ `main@fe2d78a` deliberate conflict in `lib/defaultTenant.js`.** The
  platform branch (base: `feature/batch-email-sending` tip, which lacks `fe2d78a`) gives
  `app.dgtlmedia.io` exclusively to the new `dgtl-platform` tenant; `main@fe2d78a` had parked that
  domain on the default (Content Day) tenant. On merge, **keep the platform branch's version** —
  `tests/platform-template.test.js` ("dgtl-platform exclusively owns the canonical app host") fails the
  gate if the domain leaks back, because built-in resolution order would silently hand the root page to
  Content Day. All other `fe2d78a` files (compose/deploy/docs/cron comment) merge cleanly and stay wanted.
- **Sandbox verification gaps (07-16 session):** full `next build` and 5 network-dependent tests
  (enrichment/website suites) can't run in the Cowork sandbox (no Google Fonts / outbound DNS; mount
  forbids `unlink`). `npm test && npm run build` must be run locally before deploying the platform page.
  Stale `.git/*.lock.stale*` files parked in `.git/` by the sandbox session are safe to delete locally.

## Fix order — remaining after the 07-02 audit
Code-side C2/H2/M1/M2/L1 and login-H1 are **done**. Remaining, in order:
1. **Ops:** rotate the four provider keys + set a strong prod DB password (C1, H3).
2. **H4:** lock down `/api/unsubscribe` (signed token + team scope + POST) — global outreach-suppression hole.
3. **DB parity:** pg-side dedupe in `createLead` (prod is creating duplicate leads today).
4. Extend rate limiting to the remaining public POSTs; add `007_performance_indexes.sql`.
5. Stripe idempotency + outreach double-send + file-store write mutex.

Up: [[50-Audit-Log-MOC]]

## ✅ Creator-feature template relative paths — resolved 2026-08-13

The template is now authored at pack-hub depth and `populate.py` deterministically re-roots shared
chrome links for deeper feature/case output paths without changing author-supplied media paths. Both
hub and nested example builds validate with 9 checks OK, one expected empty-`og:image` warning, and
zero failures. The engine still needs a regression test in a required CI job because the repository
link checker intentionally does not scan templates under `engine/`.

## Creator intake — pre-launch gates (2026-08-03)

- **Legal copy unreviewed.** `apps/creator-intake/site/terms.html` and the apply step-4 licence text ship as drafts (`<!-- LEGAL: draft -->`). Counsel sign-off before `join.dgtlinfluence.com` goes live; bump `TERMS_VERSION` if wording changes.
- **Provisioning not done.** DNS `A join → Hostinger IP`, MySQL import, `join@dgtlinfluence.com` mailbox (verify SPF/DKIM pass at Gmail *before* launch), private R2 bucket + CORS policy, production `.env`. Runbook: `apps/creator-intake/README.md`.
- **R2 upload path untested against a real bucket** (`SMOKE_R2=1 ./tests/smoke.sh`) — the signer is vector-proven offline, but the bucket CORS policy is the classic prod-only failure; test with one real presigned PUT during provisioning.
- **Roster launches with 6 creators** (Casper still `draft`); brief wants 10–15 before launch — 4–9 more packs are content work via the dgtl-creator-features skill, not code.
- **OG image for join.dgtlinfluence.com not produced** (`assets/img/og-join.jpg` referenced in plan, page currently ships without an og:image).
- **Journal index canonicals still point at `pitch.dgtlmedia.io`** while pack.json canonicalUrls now say `dgtlinfluence.com` — the blanket canonical rewrite remains its own PR per the 2026-08-01 decision.

- **dgtlinfluence.com ACME challenge failing repeatedly** (seen 2026-08-10 in `coolify-proxy` logs, every ~10 min: "Cannot retrieve the ACME challenge for dgtlinfluence.com"). The journal host may be serving on Traefik's fallback/self-signed cert or an expiring one. Unrelated to the dgtl.report stack. Check the journal router's cert and whether dgtlinfluence.com DNS actually points at this VPS.

## DGTL Core Phase 2 follow-ups (2026-08-13)

- ✅ **Production-shaped rehearsal completed 08-14** using the sealed 2026-07-21 dump. A fresh/current
  backup and a separate staging target are still required before production.
- **Native XLSX is not parsed.** `/imports` accepts CSV/TSV (8 MB, 10,000 rows). Add a reviewed streaming workbook parser before operators upload `.xlsx` directly.
- **Merge reversal is conservative.** Batch-created records compensate safely; restoring explicitly merged fields from `before_state` after concurrent edits needs a field-level conflict UI.
- ✅ **Outbound adapter boundary hardened 08-14:** fail-closed release gates, signed Resend events,
  health, lease recovery, unknown-outcome quarantine, idempotency, and provider-independent caps are
  implemented. Production stays disabled. No production inbound mailbox exists; connect one only
  behind the tested deterministic correlation boundary.
- **No isolated platform staging target exists.** The current compose and DNS are production-shaped;
  do not reuse them. Follow `docs/operations/dgtl-core-staging-runbook.md` after authorization.
- **GitHub branch protection must select `Required DGTL Core checkpoint`.** The workflow produces the
  aggregate check, but a repository admin must make it required before merge bypass is mechanically
  prevented.
- **Application authorization is primary; PostgreSQL RLS is absent.** Composite team checks were added where practical, but RLS should be designed platform-wide rather than applied only to Stage 2.
- **Import review UI exposes JSON mapping and candidate decisions, not a polished visual mapper/diff.** The workflow is complete and auditable; drag/drop mapping, per-field merge diffs, bulk decisions, and native large-sheet pagination remain Phase 3 ergonomics.
