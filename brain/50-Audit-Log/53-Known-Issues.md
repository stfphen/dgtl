---
title: 53 · Known Issues, Risks & Tech Debt
type: log
tags: [audit, security]
status: living
updated: 2026-07-25
source: docs/SECURITY_REVIEW.md, docs/audits/2026-07-02-codebase-audit.md, status docs
---

# Known Issues, Risks & Tech Debt

Open problems. Full security analysis in [[61-Security-Review]]. **Update status here as items are fixed.**
Latest sweep: `docs/audits/2026-07-02-codebase-audit.md` (branch `audit/2026-07-02`).

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
| **L6 — ACCEPTED (07-02)** | `npm audit`: 2 moderate — postcss <8.5.10 XSS in CSS-stringify output, bundled by **next** (every next release 9.3.4→16.x-canary pins a vulnerable postcss, so no non-breaking fix exists; `npm audit fix --force` would downgrade next to 9.3.3 — never do that). Build-time-only surface. Re-check on each next upgrade. | `node_modules/next` (transitive) |

## 🐛 Functional / correctness (NEW — 07-02 audit)
- ✅ **RESOLVED: pipeline status not validated on update.** `updateLeadStatus` now rejects statuses outside `pipelineStatuses` (Postgres stored junk verbatim; file store silently reset the lead to `new`). Test: `tests/lead-status-validation.test.js`.
- ✅ **RESOLVED: buying-committee promotion collapsed to one lead per account.** All committee members shared domain+business+website, so `shouldSkipReliableDuplicate` merged them; the response over-reported `promotedLeads`. Fixed: email now distinguishes people in dedupe; promotion counts only non-duplicates. Test: `tests/committee-dedupe.test.js`.
- **OPEN — pg-vs-file-store dedupe parity (HIGH):** the Postgres `createLead` branch inserts unconditionally — `shouldSkipReliableDuplicate` runs **only** in file-store mode. In production (DATABASE_URL set) re-imports create duplicate leads and never return the `skippedDuplicate` flag callers rely on. No DB unique constraint either. Fix: replicate the dedupe in the pg branch (or a partial unique index + `on conflict do nothing`). `lib/store.js` `createLead`.
- **OPEN — file-store write race (HIGH, dev/CI path only):** every mutation is an unserialized read-modify-write of `data/app-store.json` with a non-atomic full-file write. Concurrent requests lose updates; a crash mid-write truncates the store. Prod uses Postgres so impact is dev/CI. Fix: in-process write mutex + temp-file+rename. `lib/store.js`.
- ✅ **RESOLVED (07-04): outreach double-send race.** The send engine now claims each item via an atomic `claimOutreachQueueItem` (approved→sending compare-and-set; Postgres `UPDATE … WHERE status='approved'`, file-store mutex) before sending, so a concurrent/double-submit loses the race and is skipped. `lib/outreach/sendQueue.js` + `lib/store.js`. Test: `tests/outreach-send.test.js` (double-send).
- **OPEN — Stripe webhook idempotency (LOW/MED):** no persisted `event.id` dedup (only a read-then-write on `order.status`); the `leadMissing` path ACKs 200 (loses the event); no idempotency key on session create. Benign today, dangerous once fulfillment gains side effects. Fix: `processed_stripe_events(event_id PK)` insert-or-ignore before fulfilling; return 500 on lead-lookup error. `app/api/webhooks/stripe/route.js`.
- **OPEN — batch import non-idempotent / no double-submit guard (MED):** re-running an import re-increments counts and can double-create non-dedupable rows; a mid-loop throw leaves the batch non-completed. Fix: guard on `batch.status`, per-row try/catch, recompute (not add) counts. `app/api/admin/prospecting/batches/import/route.js`.
- **OPEN — no delete path for leads/batches/accounts (INFO):** only `deleteCall` exists (cascades correctly). Stale `batchId`/`campaignId`/`metadata.accountId` refs are never cleaned; bad records can only be removed by hand-editing the store.

## ⚡ Performance (NEW — 07-02 audit, DB layer)
- **Missing indexes (MED):** `outreach_*` and `prospecting_batches` have PK-only indexes but are queried by `tenant_id` join + `created_at/updated_at` order; `leads`/`calls` tenant-only filters can't use the team-leading composite indexes; audit-log team filter is an unindexable `metadata->>'teamId'` expression. Concrete `CREATE INDEX` list in the audit report — propose as migration `007_performance_indexes.sql`.
- **N+1 write loops (MED):** bulk lead import, outreach enqueue (+per-item event) run per-row INSERTs with no surrounding transaction. Fix: multi-row INSERT inside `withTransaction`.

## ⚙️ Operational / tech debt
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
- **2 moderate npm advisories** (`npm install`) — not yet addressed.
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
| **M2** | **`npm run build` has never been verified on the migrated tree.** | `next/font/google` fetches Manrope, Geist, Bricolage Grotesque, Space Grotesk, Instrument Serif and Fraunces at build time; the migration sandbox had no outbound network. Tests pass (351/356) but a build break would surface only on deploy. | `cd platform && npm ci && npm run build` on a networked machine; record the result in [[51-Timeline]]. Blocks calling the migration done. |
| **M3** | **Three tenant configs were never committed to the old repo and have never been reviewed.** | `platform/lib/tenants/polishStone.js`, `nowakStoneworks.js`, `dziuraStoneTile.js` are imported by `lib/store.js` — the app does not boot without them — yet they were untracked in `content-checkout-funnel`. They are committed here, so this repo boots and the archive does not. | Read them before trusting them; confirm no client data or credentials are embedded. |
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

## Creator-feature template ships stale relative paths (found 2026-08-01)

`engine/dgtl-creator-features/assets/creator-feature-template.html` still references the **pre-pack**
layout — `../assets/dgtl-editorial.css`, `../assets/journal.js`, `../assets/logos/*.svg`,
`../index.html#creators`, `../cases/a-day-with-swae-lee.html`, and a related-card pointing at a
sibling `peter-mckinnon.html`. Under the pack model a hub sits at `journal/packs/<slug>/index.html`
and needs `../../_shared/…` and `../../index.html`.

So `populate.py` reports "all tokens filled" and then `validate.py` immediately fails with ~25
broken local refs. Every pack built from this template has needed the same manual post-populate
rewrite (Shane Boyer's page carries the corrected paths; Casper's needed it too). It is a silent
tax on every new pack and it makes the skill's documented workflow wrong as written.

**Fix:** update the template to the pack-relative paths and repoint the related-cards at real pages,
or teach `populate.py` to rewrite them. Not done here — it changes the shared engine and belongs in
its own PR, not one adding a creator.

## Creator intake — pre-launch gates (2026-08-03)

- **Legal copy unreviewed.** `apps/creator-intake/site/terms.html` and the apply step-4 licence text ship as drafts (`<!-- LEGAL: draft -->`). Counsel sign-off before `join.dgtlinfluence.com` goes live; bump `TERMS_VERSION` if wording changes.
- **Provisioning not done.** DNS `A join → Hostinger IP`, MySQL import, `join@dgtlinfluence.com` mailbox (verify SPF/DKIM pass at Gmail *before* launch), private R2 bucket + CORS policy, production `.env`. Runbook: `apps/creator-intake/README.md`.
- **R2 upload path untested against a real bucket** (`SMOKE_R2=1 ./tests/smoke.sh`) — the signer is vector-proven offline, but the bucket CORS policy is the classic prod-only failure; test with one real presigned PUT during provisioning.
- **Roster launches with 6 creators** (Casper still `draft`); brief wants 10–15 before launch — 4–9 more packs are content work via the dgtl-creator-features skill, not code.
- **OG image for join.dgtlinfluence.com not produced** (`assets/img/og-join.jpg` referenced in plan, page currently ships without an og:image).
- **Journal index canonicals still point at `pitch.dgtlmedia.io`** while pack.json canonicalUrls now say `dgtlinfluence.com` — the blanket canonical rewrite remains its own PR per the 2026-08-01 decision.

## DGTL Worklog — import and Round 1 audit (2026-08-10)

**`be8267b` is mislabelled. It is not a pristine import.** The commit says it imports the app
"at its current deployed state", and its tree is *almost* that — but it also captured a
half-written `public/assets/js/views/projects.js` from a builder that was running concurrently:
`SWATCH_TOKENS` and `swatchColors()` declared at lines 18-21, while `editor()` at 159-160 still
referenced the deleted `SWATCHES`. The project editor therefore throws
`ReferenceError: SWATCHES is not defined` at that commit and the modal never opens. Confirmed
three ways — by grep, by a critic running a baseline server in Chromium, and by the seam critic.

Cause: pristineness was verified with `diff -rq` and the tree was staged with `git add` several
tool calls later. The diff was true when run and stale when used. **Rule going forward: stage
first, then verify what is staged, never the working tree.**

Consequences to know when reading the branch:
- The **live deploy was never affected**. `hbuilds/current/nodejs/.../projects.js` still carries
  `const SWATCHES` at line 14. Production is fine; only the repo commit is wrong.
- `8491ee5`'s message claims it removed "eight swatch hex literals ... copies of tokens that
  already existed in tokens.css". Those literals were not present in `be8267b`'s tree, because
  the token block was already there. What that commit actually did, in addition to its five
  stated fixes, was **repair a ReferenceError that made the project editor unopenable** — and no
  commit message says so.
- History was **not** rewritten. Force-pushing a shared branch needs explicit sign-off
  (see the git workflow rules in CLAUDE.md), so this note is the correction of record.

**Token contract does not hold repo-wide** (`CLAUDE.md`: never hardcode a brand value, reference
the token). As of Round 1, `grep -rnE '#[0-9a-fA-F]{6}' apps/dgtl-worklog/public/assets/js
apps/dgtl-worklog/server` returns 10 hits, plus three 3-digit literals:

| File | Literal |
|---|---|
| `public/assets/js/ui.js:176,177` | `#1c1c1c`, `#F0CF50` — the brand gold restated inside the ring every screen renders |
| `server/api.mjs:59` | `#F0CF50` — `colorOr()` default |
| `server/api.mjs:229` | `#8a8a8a` — `buildReport` unassigned-bucket colour |
| `views/timesheet.js:125,158,253,257` | `#3a3a3a`, `#1c1c1c` |
| `views/today.js:263`, `views/quick.js:252` | `#3a3a3a` |
| `views/today.js:69,172`, `views/timesheet.js:27` | `#fff` |

The server cannot read CSS, so `api.mjs`'s two need named constants with a comment tying them to
`--gold` and `--chart-6`. `#3a3a3a` and `#1c1c1c` map to no existing token and recur enough to
deserve one.

**Pre-existing UI defects found while auditing, not caused by this work:**
- **Today overflows horizontally at 390px** (`scrollWidth` 421 vs 390). `views/today.js:50` sets
  `gridTemplateColumns` *inline*, so no media query can override it and the phone keeps a
  two-column grid; the daily-target ring is clipped off-screen and "Your focus" wraps to roughly
  one character per line. Verified identical at `8491ee5`, so it predates the Round 1 CSS work.
- **`:focus-visible` is 1.34:1.** `tokens.css` sets `outline:none` plus
  `box-shadow:0 0 0 3px rgba(240,207,80,.15)`, which blends to `rgb(45,40,21)` on `--surface-1`.
  WCAG 1.4.11/2.4.11 require 3:1. `.btn-icon` is saved by a gold `border-color` fallback;
  `.task-check` and `.chip` are not, because `app.css` redeclares their `border` shorthand after
  `tokens.css`.
- **The drag grip is unreachable and invisible.** `.task .grip` is a `<span>` with `tabIndex -1`
  at `#3a3a3a` (1.85:1), and task rows use HTML5 `draggable` with no touch handlers — so
  reordering works with neither touch nor keyboard.
- **Sticky cells cannot show a border under `border-collapse:collapse`.** Chromium paints
  collapsed borders at the cell's static position. Proven by overriding the border to `#ff0000`
  and getting a byte-identical screenshot crop. Any pinned table column needs `box-shadow`.

**Scripts silently attach to the live database.** `server/config.mjs:16-23` loads `.env` before
resolving `DB_PATH`, so any script run from the app directory on a host — `scripts/seed.mjs`,
`scripts/user.mjs`, and `scripts/demo.mjs`, which *inserts data* — opens the production database.
`npm test` was the loud instance of this and is fixed (`b888295`); the scripts are not.

**`scripts/seed.mjs` writes colours that bypass validation.** It `INSERT`s `#b3a06a` and
`#8a8a8a` lowercase directly, skipping `colorOr()`, which uppercases. Any UI comparing a stored
colour against a canonical uppercase value fails for those two projects.

## DGTL Worklog — Round 1 seam audit, deferred defects (2026-08-10)

A seam critic drove every view, ran eleven mutations against the suite and checked the Projects
arithmetic against the database. Nineteen defects. Three blocked the next round and are fixed in
`1690ed2` (switch-verb coverage, the circular isolation guard, the `userId` coercion). **The
sixteen below are deliberately deferred** — most predate this work, and the round was scoped to
the Projects page, the test harness and the touch/contrast pass. Each is reproducible as written.

### Correctness

- **Reports counts future tasks as overdue.** `buildReport`'s task query measures overdue against
  `to`, the end of the requested range, not against today. Measured: `from=2026-08-10&to=2026-08-16`
  returned `{done:1, open:8, overdue:4}` where all four were due 11–15 Aug, i.e. in the future.
  Fix: pass `localDate()` as that third parameter.
- **`open` in the report payload is not range-bound.** It returns the same count for every range,
  including one entirely in the past, so a historical report shows today's open tasks. Either drop
  it or label it "open now" in the UI.
- **`done_at` is stamped and bucketed in UTC while entries file in `APP_TIMEZONE`.** A task
  completed after 20:00 Toronto counts toward the next day. Drift up to five hours in
  "completed this week".
- **`GET /api/export` interpolates the user id into SQL** (`WHERE user_id = ${user.id}`) — the only
  interpolation in `server/`, and it contradicts `buildReport`'s own "bound not interpolated"
  comment. It also selects without the `ENTRY_SELECT` joins while mapping through `entryRow()`, so
  every exported row carries `projectName`, `projectColor`, `taskTitle` and `userName` as null —
  verified across all 175 rows. Endpoint has zero assertions.

### Numbers the UI states wrongly

- **The Projects KPI feet name one exclusion and hide a larger one.** With "Show archived" off —
  the default — "Logged all time … excludes 2h 45m on no project" omitted **43h 30m** of
  archived-project time, an exclusion 16× larger than the one named. Reconciliation holds only
  with archived shown: `15838 + 45 = 15883` matches the report total exactly; with archived hidden
  `13228 + 45 = 13273` against `15883`.
- **Billable share quotes the wrong exclusion.** It states total off-project minutes as the
  exclusion for a *billable* ratio. `unassigned.billableMinutes` is returned by the API, carried in
  `store.js` and asserted in the suite — and read by no view.

### Spine violations

- **`settings.js` mutates users without `load()`** (lines ~206 and ~214, `api.updateUser` /
  `api.createUser` called straight from the view). Proven: after creating a user, `state.users` is
  unchanged, so the new person is missing from every assignee, timesheet and report select until a
  full page reload. Fix: a `saveUser()` in `store.js` following the existing pattern.
- **`PATCH /api/timer` has a second side effect the store exception does not cover.** It sets a
  task to `doing`, but `updateTimer` patches in place without reloading, so client state says
  `todo` while the server says `doing`.
- **`/api/report` and `/api/suggestions` return raw rows with camelCase SQL aliases** instead of an
  `xRow()` mapper — so `byProject` carries `billableMinutes` via `AS billableMinutes` while
  `unassignedTotals()` maps `billable_minutes` in JS. Two idioms for one job in adjacent functions.
- **The migration idiom has no implementation.** The spine names a `hasColumn()` + `PRAGMA
  table_info` guard; no such helper exists anywhere. Nothing violated it because Round 1 added no
  columns, but the shift clock will. Add it before that lands.

### Documentation that will mislead the next person

- **`README.md:139` and `:238` state `tokens.css` is the brand kit "verbatim / unmodified".** It is
  not: this round added `--text-strong`, `--border-row`, `--surface-hover`, `--nil` and
  `--shadow-edge`, and rewrote `:focus-visible`. Anyone re-pasting the brand kit on the strength of
  that sentence deletes five tokens and reverts the focus-ring contrast fix.
- **`README.md:135` says the suite is "45 checks".** It is 86.
- **`api.mjs:22-23` claims its two constants are the only brand values outside `tokens.css`.**
  `scripts/seed.mjs:56-60` restates five more and `schema.sql:27` restates the gold as a column
  default. The comment was written in the same commit that made it untrue.

### Dead and inconsistent

- **`--chart-1` and `--chart-2` are defined and never used.** `SWATCH_TOKENS` names the same two
  colours as `--gold` / `--gold-tan`, so re-theming the chart series would move six swatches and
  leave two behind.
- **`app.css` declares `.chip.on` twice** (line ~156, fully overridden by ~248). Dead CSS also for
  `.chart-target`, `.btn-lg`, `.delta`, `.section-title`, `.tabular`, `.cols-2`, `.cols-3`,
  `tr.clickable` — none match rendered markup.
- **Both editors destroy themselves to show a delete confirmation** — `modal()` calls
  `closeModal()` first — so cancelling the confirm leaves no modal on screen and the edit is lost.
- **The whole-team timesheet is gated behind `isAdmin()` in the UI** while the API serves
  `scope=team` to any member and the suite asserts that as correct. The gate is cosmetic; the two
  layers disagree about whether it is a permission.
- **`streaks()` has no behavioural coverage** — zeroing it entirely leaves the suite green. The only
  assertion checks the field is a number.
