---
title: 61 · Security Review (pre-go-live)
type: reference
tags: [reference, security]
status: snapshot
updated: 2026-06-27
source: docs/SECURITY_REVIEW.md (reviewed 2026-06-21)
---

# Security Review (pre-go-live)

Read-only pre-launch audit for `dgtlmag.com`, reviewed **2026-06-21**. Actionable items are tracked in
[[53-Known-Issues]]; this note is the fuller picture.

## ✅ Verified solid
- bcrypt cost **12**; DB-backed session tokens (32 bytes entropy, stored only as SHA-256).
- Correct `httpOnly`/`secure`/`sameSite` cookies.
- Parameterized SQL throughout (no injection found).
- Verified **Stripe** + **Twilio** webhook signatures.
- Server-resolved pricing (client can't set prices).
- Human-approved-only outreach.
- Audit-log secret redaction.
- **28/30 admin routes enforce `requireRole`.** No `dangerouslySetInnerHTML`.

## 🔴 Critical
- **C1** — Live API keys in plaintext `.env` (Resend/Google/Hunter/Apollo) exposed during work → rotate all four.
- **C2** — **SSRF** in `lib/enrichment/website.js:370-382` (`fetchPage`): follows redirects, no scheme allowlist, no block on localhost/127.0.0.1/169.254.169.254/RFC-1918. `websiteUrl` is attacker-controllable via public unauthenticated `POST /api/leads` and `POST /api/funding/survey`.

## 🟠 High
- **H1** — No rate limiting anywhere (no `middleware.ts`); unthrottled bcrypt on `POST /api/admin/login` → brute-force/DoS.
- **H2** — Cross-tenant **IDOR** in `app/api/admin/leads/enrich/route.js:7-13` and `enrich-batch/route.js:9-20` (bare `getAdminSession()`, no `teamId` scoping).
- **H3** — Weak prod DB password `content_funnel`.

## 🟡 Medium
- **M1** — Public endpoints let the client set internal lead fields (`pipelineStatus`, `leadScore`, `assignedTo`, `tenantId`, `teamId`).
- **M2** — `tenantId`/`teamId` trusted from anonymous callers (`lib/store.js:785`).
- **M3** — Unsubscribe is unauthenticated GET, not team-scoped (`app/api/unsubscribe/route.js:5-16`).

## 🟢 Low
- **L1** — `permissionDeniedResponse` returns 303 redirect even on JSON APIs (`lib/permissions.js:67-69`).
- **L2** — `SESSION_SECRET` referenced in docs/`.env.example` but never read in code.
- **L3** — historic `.env.example` shipped `ADMIN_PASSWORD=change-this-password` placeholder.

## Top-5 fixes (priority order)
1. Rotate keys + strong DB password. 2. SSRF guard. 3. Rate limiting. 4. Fix the two enrich routes. 5. Lock down public lead creation.

> `status: snapshot` — re-run a security review before each major release; update [[53-Known-Issues]] as fixes land.

Related: [[53-Known-Issues]] · [[24-Enrichment]] · [[21-Admin-Shell]] · [[44-Secrets-And-Rotation]]

Up: [[60-Reference-MOC]]
