# Handoff prompt: build DGTL Pass

Paste everything below the line into a fresh Claude Code session opened at the repo root
(`stfphen/dgtl`). It is written for an agent with full repo, shell and test access. Run one phase
per session if context gets tight. The prompt is phase-addressable.

---

You are the lead engineer building **DGTL Pass**, a pass/ticket issuing and verification module
for the DGTL Growth Platform in this monorepo. The design is finished and the core logic is already
written and tested. Your job is to build it into `platform/`, phase by phase, to a working MVP.

## Read first, in this order

1. `CLAUDE.md`: the repo rules. They override everything here. Note especially: tenant-generic
   (DGTL is a default, never hardcoded), brand values come from tokens, the verification table
   (`cd platform && npm test` **and** `npm run build`, with output shown), small branches, never
   force-push, never commit a key.
2. `engine/dgtl-brand-kit/SKILL.md` and its `references/` (brand-tokens, ui-components,
   application-guide and **repo-surfaces**): every pass surface follows this kit. Inside
   `platform/` the gold accent is `var(--blue)`, never `var(--gold)`. The design targets in
   `docs/specs/dgtl-pass/previews/` (emails, `wallet.html`, `pass-page.html`, `scanner.html`,
   `admin.html`) are what to build. Match them.
3. `docs/specs/dgtl-pass/README.md`: the package index and the decisions already made. **Do not
   re-open those decisions.** If you find a real reason one is wrong, stop and say so with
   evidence instead of silently diverging.
4. `docs/specs/dgtl-pass/13-build-plan.md`: your task list and gates.
5. The spec file for whichever phase you're on (the build plan links them).
6. `brain/00-Index/00-Home.md`, then `brain/50-Audit-Log/53-Known-Issues.md` (file-store race,
   release gate).

## What already exists and is proven

- `docs/specs/dgtl-pass/reference/`: dependency-free modules with 72 unit tests (credentials,
  validity windows, the verify decision, brand kit, tiers, Apple `pass.json` + Wallet art, five
  email variants + SMS) and a `repository.js` with the issue/verify/revoke transactions, proven by 9 SQL
  integration tests against platform migrations 001–008 + the draft 009 in PGlite.
- `docs/specs/dgtl-pass/migration/009_passes.sql`: the draft migration.
- `docs/specs/dgtl-pass/previews/`: brand-kit design targets for every surface (emails, Wallet,
  pass page, scanner, admin), generated from the reference code. `assets/dgtl-wordmark@4x.png` is
  the email/Wallet logo.
- `.github/workflows/platform-ci.yml`: the Phase 0 release gate (written; pushing it and marking
  both checks required on `main` is Stephen's step).

**Port these modules. Don't rewrite them.** Change import paths, swap `brand.js`'s
`readableForeground` for the one in `platform/lib/branding.js` (export it), and keep every test
passing in `platform/tests/`. If a ported test fails, the port is wrong, not the test. Stop and
diff.

## How to work

- Branch `feature/dgtl-pass` from `main`. One short-lived branch per build-plan task
  (`feat/pass-p1-roles`, …), merged into it. Run `git status --short --branch` before editing.
- Follow the existing platform idioms exactly. Plain JS/JSX, `pg` with raw SQL, text ids with
  prefixes, `requireRole` → team from session → team-scoped query → `logAudit` →
  `permissionDeniedResponse`. Admin mutation ids go in the body. Off-default admin panels load
  through `lazyPanels.jsx`. Integrations degrade to "not configured" or mock.
- **Passes are Postgres-only.** Never add a file-store branch for them.
- **Mock first.** `PASSES_DRY_RUN=true` and the mock email/SMS providers until the phase gate
  says otherwise. No test may send a real message.
- **Secrets:** env only. Add placeholders to `platform/.env.example`. Never print a secret, a
  credential, or a `/p/<credential>` URL of a real holder into logs or chat.
- Keep `brain/` current as you go: a timeline bullet per phase, decisions in the decision log,
  env vars in `43-Environment-Variables.md`, routes in `14-Routes-Map.md`, tables in
  `13-Data-Model.md`. Create the module note `brain/20-Modules/2E-Passes.md` in Phase 1 (a stub
  exists; flip its status as phases land).

## Phases

Do them in order. Each ends at the gate in `13-build-plan.md`. At each gate, **stop and report**:
the commands you ran and their real output, what you demonstrated, and anything you couldn't
verify and why.

- **P0 Prerequisites:** required CI (`platform` test + build) and a Postgres CI job. You can write
  the workflow. The external accounts (Apple, Twilio, Google, Resend, DNS) are Stephen's, so list
  exactly what you need from him and continue with mocks.
- **P1 Foundation:** migration 009, ported pure modules + tests, `issuer`/`verifier` roles and
  capabilities, Google OIDC (invite-only, `jose`), password-less staff, verifier → `/scan`
  redirect, `lib/passes/config.js`.
- **P2 Pass engine:** `lib/passes/store.js` (from `repository.js`), tenant `passes` config +
  editor section, tier tokens into both CSS token files with a drift test, pass types
  API + editor, issue / action / list / detail / overview / preview routes, QR + Code 128 images,
  holder pass page, the Passes tab.
- **P3 Scanner ★:** `/api/scan/verify` + `/api/scan/session`, the `/scan` PWA with self-hosted
  `zxing-wasm`, verdict screens, manual entry, the ledger view, and the **real-Postgres
  concurrency test T-C1**. This gate is the product milestone.
- **P4 Delivery:** email renderer port, SMS seam, `deliver.js` with gates + retries + CAS drain,
  consent capture, preferences + one-click unsubscribe, CSV import, cron route, webhooks.
- **P5 Apple Wallet:** `passkit-generator`, per-tier images, the `.pkpass` route, badge. Needs
  Stephen's certificates. Build and unit-test against a self-signed test cert, and mark the
  device check as pending until the real cert exists.
- **P5b** (may follow launch): Wallet web service + APNs push.
- **P6 Hardening:** `/security-review`, log redaction, load check, backups, door-staff one-pager,
  brain to *live*.

## Non-negotiables (from the spec; each has a test)

1. The scanner never admits on error, timeout, 401, or unknown status. It fails closed.
2. A single-use pass admits exactly once under concurrency (T-C1).
3. A foreign team's pass reads `not_found` and leaks no holder data (T-I4).
4. A `verifier` session gets 403 from every `/api/admin/*` route (T-R1, enumerated from the
   route tree).
5. Only `sha256(credential)` is stored. Credentials are derived, never persisted.
6. Every email carries sender identification (postal address) and a preferences link, or it is
   not sent. The VIP offer renders only with marketing consent.
7. No hardcoded brand values in components. Colors come from the brand kit and tokens. Gold is
   rationed per the kit: one primary action per view, active states, THE number, VIP. Run the
   kit's verification checklist (desktop + 390 px screenshots) on every UI phase gate.
8. `npm test` and `npm run build` pass in `platform/` at every gate. Report the counts.

## When to stop and ask Stephen

- The pass host (before the first non-test pass; it's permanent once QR codes exist).
- Anything that sends a real email or SMS, publishes, deploys, or touches production data.
- Any change to an existing module's behaviour outside what the build plan lists.
- Any decision in the README's list that the evidence says is wrong.
