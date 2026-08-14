---
title: 26 · Outreach Sequence
type: module
tags: [module, leads]
status: stable
updated: 2026-08-14
---

# Outreach Sequence (V1)

## Purpose
Turn leads into a tracked, **human-approved-only** email outreach pipeline: template library → queue
preview → approved send via Resend → events + follow-ups + lightweight metrics.

> 🚫 **Outreach is human-approved only — never auto-send.** Standing rule ([[CLAUDE-Operating-Rules]]).
> The scheduled drain only sends items a human already **approved**; drip follow-ups are scheduled
> as `approved` rows only because the human approved the campaign's follow-up settings.

## Send engine (2026-07-04, `feature/batch-email-sending`)
- `lib/outreach/sendQueue.js` — **shared send engine** (`sendApprovedItems`) used by BOTH the manual
  `queue/send` route and the scheduled drain. Claim CAS `claimOutreachQueueItem` (approved→sending)
  closes the double-send race.
- Provider seam: `lib/integrations/emailProvider.js` + `mockEmailProvider.js` — dry-run via
  `OUTREACH_DRY_RUN` or per-campaign `testMode` (never auto in prod; mirrors telephony).
- Scheduled sends: `POST /api/cron/outreach/drain` (bearer `OUTREACH_CRON_TOKEN`, host cron) over
  `listDueQueueItems`.
- **Follow-up drip:** a sent intro schedules an approved `step=1` row the drain later sends;
  stop-checks on reply/booked/opt-out + eager cancel in the events route.
- Queue lifecycle gained a **queued→approved** transition (`queue/approve` + "Pending Approval" UI);
  queued items were dead-ends before.
- Demo: `scripts/seed-outreach-demo.js` (`npm run seed:outreach-demo`). Tests: `tests/outreach-send.test.js`.

## Key files
- `lib/outreachSequence.js` — the engine:
  - Vocab: `outreachTemplateFields`, `campaignStatuses`, `outreachQueueStatuses`, `suppressionReasons`, `outreachEventTypes`, `defaultOutreachTemplates`.
  - Rendering: `renderOutreachTemplate`, `buildTemplateFields`, `buildFundingMergeFields`, `replaceMergeFields`.
  - Suppression: `findSuppression(ForLead)`.
  - Queue: `buildQueuePlan`, `canSendQueueItem` (enforces caps + suppression), `suggestFollowUpDate`.
  - Metrics: `buildOutreachMetrics`.
- `lib/outreach.js` — draft builders: `buildDraftEmail({tenant, lead, packageId})`, `buildFundingFollowUpDraft({lead})`.
- `lib/integrations/resend.js` — `validateResendConfig`, `sendResendEmail({from, to, subject, html, text})` (`RESEND_API_KEY`).
- UI: `components/admin/OutreachQueueBuilder.jsx`.
- API: `/api/admin/outreach/{templates,campaigns,queue,queue/approve,queue/send,events,suppressions}`, `/api/admin/drafts`; `/api/cron/outreach/drain`.
- Public: `/api/unsubscribe` (GET+POST — signed HMAC token via `lib/outreach/unsubscribe.js`, team/tenant-scoped suppression, RFC-8058 one-click; **H4/M3 fixed 07-04**). Sends carry `List-Unsubscribe` headers.

## Data (migrations 001 + 008)
`outreach_templates`, `outreach_campaigns` (`daily_send_cap=25`, `per_domain_daily_cap=1`, filters;
008 adds `follow_up_template_id`, `follow_up_delay_days`, `test_mode`), `outreach_queue` (status,
`scheduled_for`, `resend_message_id`; 008 adds `step`), `outreach_suppression_list`, `outreach_events`.
See [[13-Data-Model]].

## Send caps & compliance
- Per-campaign daily cap 25; per-domain daily cap 1; suppression list respected by `canSendQueueItem`.
- Sending requires `RESEND_API_KEY` **and** a verified Resend sender domain (SPF/DKIM/DMARC on dgtlmag.com). Without it, the queue shows but cannot send.

## Funding outreach
Dedicated funding sequence (intro / fit-summary / book-a-call) with funding merge fields
(`{{businessName}}`, `{{contactName}}`, `{{recommendedFundingLane}}`). See [[29-Funding-Program]].

## Canonical outbound engine (Phase 2, safe-by-default)
`lib/stage2/outreachService.js` adds the first canonical route beside V1; it does not rewrite V1.
Campaign cohorts require canonical Opportunity + Contact IDs. Personalization snapshots Company,
Contact, Opportunity, approach/offer, sourced Research, and campaign instructions. Campaign and exact
message content require owner/admin approval; material edits invalidate approval.

Canonical `messages` carry durable queue/lease/retry/idempotency/dead-letter/uncertain state plus the
exact approved sender/recipient envelope. PostgreSQL serializes claim capacity per team, then uses
`FOR UPDATE SKIP LOCKED`; `message_delivery_attempts` is written before the provider boundary.
Pre-attempt leases recover, but a post-attempt crash/timeout becomes manual-review
`delivery_uncertain` and is never automatically retried.

The deterministic adapter remains the default and makes no network calls. A production Resend
adapter reuses `lib/integrations/resend.js` but requires explicit mode, enabled flag, release ID,
release-bound authorization phrase, release-bound rate-policy approval, and API key. Rate policy is
provider-independent. `/api/webhooks/resend` requires a raw-body Svix signature and freshness window;
events are idempotent and update Activity/suppression or open an exception. No gate is enabled in
committed configuration.

Suppression reads both `contact_suppressions` and the legacy list. Provider events map to Activity and
suppression; reply correlation prefers provider IDs and sends ambiguity to `/operations/exceptions`.
No production inbound mailbox has been invented. Authenticated reply correlation and the signed
outbound-provider event webhook remain separate boundaries. Full contract:
`docs/architecture/dgtl-core-phase-2.md`.

Phase 3 adds `message_artifacts`: an operator may attach one approved, deployed Artifact version to a
canonical Message. The link snapshots Artifact ID, version, URL and checksum. Attachment is a material
message change, so the service returns the Message to draft and clears prior approval. Later Artifact
revisions never retarget historical Messages. See [[2E-Artifact-Automation]].

## ⚠️ Do not start yet
Real outreach sending **at volume** still needs an approved Resend domain (SPF/DKIM/DMARC). The
suppression/unsubscribe path is now signed + scoped (07-04), removing that blocker. [[34-Do-Not-Start-Yet]]

## Related
[[22-Lead-Pipeline]] · [[29-Funding-Program]] · [[64-External-Services]] · [[28-Telephony]]

Up: [[20-Modules-MOC]]
