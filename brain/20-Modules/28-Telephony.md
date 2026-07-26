---
title: 28 · Telephony
type: module
tags: [module, telephony]
status: stable
updated: 2026-06-27
source: TELEPHONY.md, docs/TELEPHONY_CALL_FORWARDING.md, docs/TELEPHONY_DEMO_BUILD_PLAN.md
---

# Telephony

## Purpose
Provider-neutral phone layer: route inbound calls to the right rep, click-to-call from admin, log
every call against the lead, and (newer) record + transcribe + AI-summarize calls.

> **Rule:** all Twilio SDK access goes through `lib/telephony/`. Routes/UI never import `twilio`.
> Secrets live in env only. With no `TWILIO_*` the layer reports "not configured" and the app is unaffected.

## Architecture (`lib/telephony/`)
| File | Role |
|---|---|
| `constants.js` | Enums + tenant config defaults: `telephonyProviders`, `callDirections`, `callStatuses`, `callOutcomes`, `routingModes`, `recordingConsentModes`, `repRoles`, `availabilityStatuses`, `defaultTenantTelephony`, `normalizeTenantTelephony`. |
| `index.js` | Service layer. `getProvider()` switches on `TELEPHONY_PROVIDER` (mock = explicit opt-in; telnyx; default twilio). `isConfigured`, `createOutboundCall`, `maybeSimulateCall`, `buildInboundResponse`, `createRecordingTranscript`, `fetchTranscriptText`, `handleCallStatusUpdate`, `verifyWebhook`, `getTenantNumber`, `logCallEvent`. |
| `routing.js` | `decideRoute(lead, tenantTelephony, reps)` — pure routing. |
| `twilioProvider.js` | Real Twilio impl (lazy SDK import); bridge TwiML, status normalizer, signature verify. |
| `telnyxProvider.js` | Telnyx stub (future). |
| `mockProvider.js` | Mock provider (`isConfigured` always true); `MOCK_RECORDING_URL`. |
| `mockSimulator.js` | `scheduleMockCallLifecycle`, `runMockCallLifecycle` (ringing→in_progress→completed). |
| `transcribeRecording.js` | Deepgram primary (`DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL` default `nova-3`) + OpenAI Whisper fallback; Claude summary. |
| `callSummary.js` | `summarizeCallTranscript(transcript)` via Claude. |
| `followups.js` | `createMissedCallTask(context)` → `tasks` table. |
| `outboundGuards.js` | `checkOutboundLead({lead, teamId, tenant})` (do-not-call/contact + valid +1 guard). |
| `metrics.js`, `phone.js`, `webhookRequest.js`, `webhookUrl.js`, `types.js` | metrics, E.164 helpers, webhook parsing/URL building. |
- Call activity store: `lib/store.js` (`createCall`, `updateCall`, `getCallsForLead`, `addCallEvent`, `getCallByProviderId`, `getTenantByPhoneNumber`, `getTenantTelephony`).
- UI: `LeadCallPanel.jsx` (Call Lead), `DialPad.jsx` (ad-hoc Calls tab), `RecordingButton.jsx` (play/transcribe), `CallsTable.jsx`.

## Routing (the current reality)
- **Only `single_rep` is implemented.** `round_robin` / `team_ring` / `availability_based` are TODO stubs that fall back to single_rep; admin dropdown labels them "(soon)".
- `decideRoute` precedence: **assigned rep → default rep (single_rep) → fallback number → voicemail/reject.** Returns ONE `destinationNumber`; TwiML dials one `<Number>`.
- 🔜 **"Ring ALL team members" is NOT built.** Proposed: `decideRoute` returns a list; TwiML emits one `<Dial>` with multiple `<Number>` children (parallel ring, first wins).

## API routes (`app/api/telephony/`, +1/US-Canada only)
- `POST inbound` — Twilio webhook; **signature must verify or 403**; finds tenant by dialed `To` (`getTenantByPhoneNumber`), finds/creates lead (`inbound_call`), routes, creates `ringing` Call + CallEvent, returns TwiML.
- `POST status` — Twilio status callback; **403 if unsigned**; updates Call by `providerCallId`; on final `missed` → `createMissedCallTask`. Returns 200.
- `POST outbound` — authenticated (`requireRole(["owner","admin","sales"])`); rejects `doNotCall`/`doNotContact` (409); bridges rep→lead with tenant number as caller ID; `statusCallback`→`/status`.
- `recording`, `recordings/[callId]`, `transcription`, `dial` — recording proxy (authenticated, so Twilio recordings play in-browser) + in-app transcription.

## Per-tenant config (`tenant.config.telephony`)
Set in admin → Tenants → Phone Settings (`POST /api/admin/tenants/telephony`, owner/admin only):
`enabled`, `provider`, `phoneNumber` (E.164), `routingMode`, `defaultRepId`, `fallbackNumber`,
`voicemailEnabled`, `recordingEnabled` (**keep OFF until consent handling is in place**),
`recordingConsentMode` (disabled / one_party / two_party_notice / play_disclaimer).

## Recording & consent (built in the demo-build plan)
Consent announcement TwiML branches on `recordingConsentMode`; `record: "record-from-answer-dual"`;
recording webhook captures `recordingUrl`/`transcript`/`aiSummary`. In-app transcription = Deepgram → Whisper fallback → Claude summary.

## Going live (Twilio console)
1. Buy/port a **+1** voice-capable number.
2. Voice "A call comes in" → `POST {TELEPHONY_WEBHOOK_BASE_URL}/api/telephony/inbound`.
3. Status callback → `POST {TELEPHONY_WEBHOOK_BASE_URL}/api/telephony/status`.
4. Set `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`.
5. ⚠️ Signature verify uses the **exact** webhook URL — must match `TELEPHONY_WEBHOOK_BASE_URL` byte-for-byte (scheme/host/path/trailing slash) or it fails.
6. Admin → Phone Settings: enable, set number, routing mode, default rep, fallback.
7. Keep `recordingEnabled=false` until consent handling is verified.

## Env
`TELEPHONY_PROVIDER` (twilio default; mock/telnyx), `TELEPHONY_WEBHOOK_BASE_URL` (falls back to `NEXT_PUBLIC_APP_URL`), `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` (auth token also drives signature verify), reserved `TWILIO_API_KEY`/`SECRET`/`WEBHOOK_SECRET`, `DEFAULT_COUNTRY_CODE=CA`, `DEFAULT_TIMEZONE=America/Toronto`, `DEEPGRAM_API_KEY`/`DEEPGRAM_MODEL`. See [[43-Environment-Variables]].

## Tests
`tests/telephony.test.js` (23KB): E.164, defaults/persistence, `getTenantByPhoneNumber`, routing precedence, status mapping, TwiML, signature reject/accept, inbound logging + timeline, status updates, missed-call task, outbound auth guard, outcome→lead updates. Runs against an isolated temp JSON store; no live Twilio needed.

## Related
[[22-Lead-Pipeline]] · [[2B-AI-Backend]] (Claude summary) · [[42-Go-Live-Plan]] (Phase 7) · [[63-Tenants-Catalog]]

Up: [[20-Modules-MOC]]
