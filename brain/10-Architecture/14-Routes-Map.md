---
title: 14 · Routes Map
type: reference
tags: [architecture]
status: stable
updated: 2026-08-14
source: app/
---

# Routes Map

All routing lives under `app/` (Next.js App Router). Pages are server components by default;
API routes are `route.js` handlers.

## Pages
| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.jsx` | Public tenant page, host-resolved via `getTenantForHost`; renderer picked by the config's `template` field via `components/templates/registry.js` (default FunnelPage; `"showcase"` → ShowcasePage, `"authority"` → AuthorityPage, `"agency"` → AgencyPage, `"platform"` → PlatformPage). Since 2026-07-16 also exposes host-resolved `generateMetadata` via the template's `buildMetadata` (funnel tenants keep inheriting layout metadata). `app.dgtlmedia.io` → `dgtl-platform`. |
| `/t/[slug]` | `app/t/[slug]/page.jsx` | Per-tenant page preview; `?preview=draft` renders the draft config. Same template-registry renderer selection + per-template `generateMetadata`. |
| `/admin` | `app/admin/page.jsx` | The admin shell (server component importing all admin components). [[21-Admin-Shell]] |
| `/admin/login` | `app/admin/login/page.jsx` | Login (DB-backed; redirects here if unauthenticated). |
| `/companies` | `app/(core)/companies/page.jsx` | Authenticated canonical Company list through the hybrid Core repository. |
| `/companies/[id]` | `app/(core)/companies/[id]/page.jsx` | Company graph: details, contacts, opportunities, research, artifacts, activity, external links. |
| `/contacts` | `app/(core)/contacts/page.jsx` | Authenticated canonical Contact list. |
| `/contacts/[id]` | `app/(core)/contacts/[id]/page.jsx` | Contact detail with company, opportunities, activity, and external links. |
| `/opportunities` | `app/(core)/opportunities/page.jsx` | Authenticated canonical Opportunity list. |
| `/opportunities/[id]` | `app/(core)/opportunities/[id]/page.jsx` | Opportunity-centered operating view: company/stakeholders, approach, research, assets/jobs, campaign/messages, activity, links. |
| `/generation-jobs` | `app/(core)/generation-jobs/page.jsx` | Team-scoped GenerationJob queue and adapter status. |
| `/generation-jobs/[id]` | `app/(core)/generation-jobs/[id]/page.jsx` | Immutable context/brief, adapter identity, validation, output, sandboxed preview, and approval controls. |
| `/artifacts` | `app/(core)/artifacts/page.jsx` | Immutable Artifact version registry. |
| `/artifacts/[id]` | `app/(core)/artifacts/[id]/page.jsx` | Version/checksum lineage, test deployment, revision request, and exact Message attachment. |
| `/operations/worklog` | `app/(core)/operations/worklog/page.jsx` | Worklog bridge: connector health, delivery-handoff queue, pending operations (approve/execute/cancel/reconcile/retry), linked projects/clients, stale links, exceptions. Stage 4: Company/Opportunity detail also gain Worklog panels; mutations post to `/api/core/worklog/*`, `/api/core/companies/[id]/worklog/*`, `/api/core/opportunities/[id]/worklog/*` — all session-authenticated, connector endpoint server-configured. |
| `/branding/icon` | `app/branding/icon/route.js` | Per-tenant PWA icon. |
| `/manifest.webmanifest` | route | PWA manifest. |

The `(core)` route group shares `components/core/CoreShell.jsx`; it does not alter the public URL.
`/admin` remains reachable as the compatibility UI. `/` is deliberately still host-resolved so a
data-model migration cannot break tenant-domain routing. See [[13-Data-Model]].

## Public API routes (UNAUTHENTICATED — security-sensitive)
| Route | Method | Purpose | Notes |
|---|---|---|---|
| `/api/leads` | POST | Create a lead from the funnel. | ⚠️ public; can set internal fields (security M1/M2). [[61-Security-Review]] |
| `/api/funding/survey` | POST | Funding scan: teaser w/o email, full result + `funding_scan` lead w/ email; re-scores server-side. | ⚠️ public; SSRF vector via website field (C2). |
| `/api/checkout` | POST | Resolves tenant+package price server-side, captures lead, redirects to Stripe (or falls back). | [[27-Checkout-Payments]] |
| `/api/webhooks/stripe` | POST | Raw-body signature verify, idempotent fulfillment. | force-dynamic, no auth (by design). |
| `/api/unsubscribe` | GET+POST | Signed one-click unsubscribe: HMAC token required, writes a **team/tenant-scoped** suppression; RFC-8058 POST supported. | H4/M3 fixed 07-04. `lib/outreach/unsubscribe.js`. [[26-Outreach]] |
| `/api/cron/outreach/drain` | POST | Scheduled send drain over due approved outreach queue items. | Bearer `OUTREACH_CRON_TOKEN` (constant-time check), triggered by host cron. [[26-Outreach]] |

## Admin API routes (`/api/admin/*` — 34 files, 29 use `requireRole`)
- **Auth:** `login`, `logout`.
- **Leads:** `leads/status`, `leads/update`, `leads/import`, `leads/export`, `leads/enrich`, `leads/enrich-batch` ⚠️(IDOR H2 — bare session, no team scope), `leads/research`, `leads/research-from-query`, `leads/fill-missing`.
- **Funding:** `funding/review`.
- **Outreach:** `outreach/campaigns` (now accepts follow-up template/delay + `testMode`), `outreach/events` (eager-cancels pending drip steps on reply/booked/opt-out), `outreach/queue`, `outreach/queue/approve` (queued→approved transition), `outreach/queue/send` (thin wrapper over the shared send engine `lib/outreach/sendQueue.js`), `outreach/suppressions`, `outreach/templates`.
- **Prospecting:** `prospecting/apollo`, `prospecting/google`, `prospecting/hunter`, `prospecting/batches`, `prospecting/batches/import`.
- **Telephony:** `telephony/outcome`, `telephony/transcribe`, `telephony/delete-call`.
- **Tenants:** `tenants/generate` (AI, takes a `direction` field), `tenants/edit` (POST NL-instruction **or** deterministic `patch` mode onto the draft; GET returns the draft snapshot for the editor), `tenants/import`, `tenants/publish`, `tenants/branding`, `tenants/telephony`.
- **Media:** `media` (GET team library list, POST multipart image upload → `public/uploads/` via `lib/media/`, DELETE with tenant-reference check + `force`); `media/youtube-resolve` (POST — classify a pasted YouTube video/playlist/channel link into a `heroVideo` block; channel handles resolve via optional `YOUTUBE_API_KEY` or an SSRF-guarded page fetch). See [[2D-Portfolio-Media]].
- **Other:** `contractors`, `drafts`, `users`.

## Telephony provider routes (`/api/telephony/*`)
| Route | Caller | Notes |
|---|---|---|
| `inbound` | Twilio webhook | Signature must verify (403 else); routes via `decideRoute`; logs Call. |
| `status` | Twilio webhook | Updates Call by `providerCallId`; missed → `createMissedCallTask`. |
| `outbound` | Admin UI (auth: owner/admin/sales) | Click-to-call; bridge rep→lead. |
| `recording`, `recordings/[callId]`, `transcription`, `dial` | mixed | Recording proxy + transcription. |

See [[28-Telephony]] for the full telephony flow.

## Artifact worker API (`/api/core/generation-*`)
- Authenticated operator routes create/approve briefs and Artifacts, request revisions/test
  deployments, and attach exact Artifact versions to Messages.
- Bearer-service routes claim/heartbeat/result/fail GenerationJobs and claim/result deployment jobs.
  Team and worker identity come from server configuration; request JSON cannot override them.
- No route imports shell/process execution or deployment credentials. The separately operated worker
  uses the bounded contract in [[2E-Artifact-Automation]].

Up: [[10-Architecture-MOC]]
