# 17 · Status, launch timeline and production checklist

**As of Friday 2026-10-02 (Phases 2–3 built for the iPhone demo; Wallet without an Apple account).** This is the canonical record. Update the status column as items land,
and log dates in `brain/50-Audit-Log/51-Timeline.md`.

## Status at a glance

**Design and specification are complete. Phases 1–3 (foundation, pass engine, scanner) are built and tested on branches and demo on a real iPhone over Wi-Fi (`npm run demo:passes`, [18](18-iphone-demo.md)). Nothing is deployed.**

| Workstream | Status | Evidence |
|---|---|---|
| Product spec, architecture, API, data model, security, build + test plans | ✅ Done | 17 docs in `docs/specs/dgtl-pass/` + `HANDOFF-PROMPT.md` |
| Reference core (credentials, validity, verify, brand kit, tiers, Wallet JSON + art, emails, SMS, issue/scan transactions) | ✅ Done, tested | 75/75 unit + 9/9 SQL integration tests |
| Database migration `015_passes.sql` | ✅ Drafted, validated | Applies on 001–014 (incl. Core) in PGlite; every migration re-runs cleanly |
| Brand + UI design (branded DGTL card system, 4 tier colours) | ✅ Done | 12 design targets in `previews/`, built to `engine/dgtl-brand-kit` |
| Phase 0: release-gate CI | 🟡 Exists on `main` (`core-release-gate.yml`); was red, **fix in [PR #44](https://github.com/stfphen/dgtl/pull/44): green on GitHub (4/4), awaiting merge** | Locally 536/536 tests, build 63/63, audit 0. My separate `platform-ci.yml` retired as redundant |
| Phase 1: foundation | ✅ Built, in review | `feat/pass-p1-foundation`: 613/613 tests (536 + 77 new), build 63/63, audit 0, migrate 001–015 twice, browser e2e (verifier → `/scan`, refused by `/home`, `/admin`, workspace APIs). Live Google round trip waits on the OAuth client (P0.6) |
| Phase 2: pass engine + holder page | 🟡 Built for the demo | `feat/pass-p2-p3-demo`: Core `/passes` (issue, open-on-phone QR, revoke, live feed), `/p/[credential]` in all four tier colours, migration 016. Open: pass-type editor, suspend/rotate/extend, Code 128, tenant editor section |
| Phase 3: scanner | 🟡 Works end to end | `/scan`: zxing-wasm (self-hosted), verdict screens, manual entry, photo fallback for http. **T-C1 on real Postgres: 20 parallel scans → 1 admit.** Open: HTTPS device matrix, PWA manifest, Worker decode |
| Apple Wallet | 🟡 Built via WalletWallet (no Apple Developer account) | Free plan = colour preset + text; needs Stephen's free key in `platform/.env`. Own certificate (P5) still the launch recommendation |
| Phases 4–6: delivery, own-cert Wallet, hardening | ⬜ Not started | — |
| External accounts (Apple, Twilio, Google, Resend, DNS) | ⬜ Not started | Stephen's |
| Repo: local `main` vs GitHub `main` | ✅ Reconciled + pushed | Merge `5de31e0`; no regressions (535/536 = the pre-existing stale test, fixed in #44) |
| Platform: production advisories | 🟡 Fixed in #44, pending merge | The Aug 14 overrides had fixed the old three. New ones since (critical Next RCE, axios, sharp/libheif…) are patched to Next 15.5.27 and sharp 0.35.5; no Next 16 needed |

`main` is pushed and in sync with GitHub. `feature/dgtl-pass` and PR #44 (`fix/release-gate-advisories`) are pushed too.

## Critical path

```
reconcile main ─ push + CI required ─ P1 ─ P2 ─ P3 ★ ─ P4 ─ P5 ─ P6 ─ UAT ─ go/no-go ─ pilot
                                                        │      │
                                   Twilio approval ─────┘      └──── Apple Pass Type ID certificate
```

The two external approvals are the real schedule risk: Twilio A2P 10DLC / toll-free
verification (1–3 weeks) and Apple Developer organisation enrolment (days to 2 weeks if a D-U-N-S
number is needed). **Start both by Friday Oct 2.**

**Update 2026-10-02:** Apple Wallet no longer blocks the demo or the pilot. WalletWallet signs
with its own Pass Type ID (free, 1,000 passes a month). The Apple enrolment moves from the
critical path to a launch-quality upgrade: full DGTL art in Wallet, holder data kept
first-party, and $99/year instead of $39/month for branded Pro.

## Timeline

Assumes one full-time build agent or engineer working the phases in order, with Stephen reviewing
each gate the same day. Monday Oct 12 is Canadian Thanksgiving (no work scheduled).

| Dates (2026) | Work | Exit gate | Needs from Stephen |
|---|---|---|---|
| **Thu Oct 1 – Fri Oct 2** | **P0** finish: reconcile `main`, push, CI green on GitHub, mark checks required | CI required + green on `main` | Approve the `main` reconciliation; start Apple, Twilio, Google, Resend, DNS |
| ~~Mon Oct 5 – Tue Oct 6~~ **done Thu Oct 1** | **P1** Foundation: migration 015, roles, Google sign-in, verifier routing | Gate P1 ✅ (bar the live Google login) | Google OAuth client |
| Wed Oct 7 – Fri Oct 9 | **P2** Pass engine: pass types, issue/revoke, QR, holder pass page, Passes tab | Gate P2 (+ brand-kit visual check) | Pass host confirmed (`pass.dgtl.ltd`) |
| Tue Oct 13 – Thu Oct 15 | **P3** Scanner ★ on iPhone + Android, ledger, real-Postgres double-scan test | **★ Product milestone:** issue → scan → admit/refuse → logged | HTTPS staging host |
| Fri Oct 16 – Tue Oct 20 | **P4** Delivery: 5 emails + SMS, consent, unsubscribe, CSV bulk, webhooks | Gate P4 | Resend domain verified; Twilio approved (else SMS stays in dry-run) |
| Wed Oct 21 – Thu Oct 22 | **P5** Apple Wallet: signed `.pkpass`, branded art, official badge | Gate P5 (5 presets install on a real iPhone) | Pass Type ID certificate |
| Fri Oct 23 – Mon Oct 26 | **P6** Hardening: security review, log redaction, load check, backups, runbooks | Gate P6 | — |
| Tue Oct 27 – Thu Oct 29 | **UAT on staging:** device matrix, email-client matrix, pilot tenant setup, door-staff training | Launch acceptance checklist complete | Pilot tenant details + VIP offer copy |
| **Fri Oct 30** | **Go / no-go: production-ready** | Signed checklist | Decision |
| Week of Nov 2 | **Pilot launch** with the first venue; P5b Wallet live updates | First real scans in the ledger | — |
| Nov 2 – Nov 13 | Two-week monitored pilot | Zero false admits, ≥ 98% email delivery | Daily ledger review |
| ~Mon Nov 16 | General availability for more tenants; start roadmap R1 (selling passes via Stripe) | — | Pricing |

**Range:** production-ready **Oct 30** if the externals land on time. Expect **~Nov 4** with
normal review slippage. The two approvals degrade the launch rather than stop it:

- **Twilio late:** launch with email + Wallet; SMS follows on approval.
- **Apple late:** launch with email + the pass page QR, which verify identically, and Wallet
  follows. Stephen decides by Oct 20 whether either is acceptable for the pilot.

## Production readiness checklist

Owner: **S** = Stephen · **B** = build agent/engineer. Status: ✅ done · 🟡 in progress · ⬜ not
started · ⛔ blocker.

### A. Repository and release gate
| | Item | Owner |
|---|---|---|
| ✅ | Spec, reference core, migration draft, design targets committed (`4e091e2`, `b6d341b`, `a706dd6`) | B |
| ✅ | Release-gate workflow written and verified by a clean local CI simulation (`ffa2a75`) | B |
| ✅ | Reconcile local `main` with GitHub `main`: merged (`5de31e0`) and pushed; `feature/dgtl-pass` brought up to date | S approved · B executed |
| 🟡 | Merge PR #44 so the release gate is green on `main`; then open the passes PR against it | S · B |
| ⬜ | Mark `Required DGTL Core checkpoint` required on `main` (branch protection is currently off) | S |
| 🟡 | Production advisories at 0: patched in PR #44 (Next 15.5.27, sharp 0.35.5) | B |
| ⬜ | Self-host or pin the Google fonts the build downloads (build reproducibility) | B |
| ⬜ | Triage the 12 open PRs with no CI (not blocking, but they hide real failures) | S |

### B. Build phases (each gate per `13-build-plan.md`)
| | Item | Owner |
|---|---|---|
| 🟡 | P1 Foundation (migration, roles, Google OIDC, verifier → `/scan`): built and gated; merge after #44; live Google login after P0.6 | B |
| ⬜ | P2 Pass engine + Passes tab + holder pass page, matching `previews/` | B |
| ⬜ | P3 Scanner ★ + T-C1 double-scan test on real Postgres | B |
| ⬜ | P4 Delivery: emails, SMS, consent, unsubscribe, bulk, webhooks | B |
| ⬜ | P5 Apple Wallet: signed `.pkpass` + branded art via `sharp` | B |
| ⬜ | P6 Hardening | B |
| ⬜ | P5b Wallet live updates (may follow launch) | B |

### C. External accounts and infrastructure
| | Item | Owner | Lead time |
|---|---|---|---|
| ⬜ | Confirm pass host (`pass.dgtl.ltd`, beside `os.dgtl.ltd`); DNS record, Coolify/Traefik label, HTTPS | S | hours |
| ⬜ | Apple Developer organisation membership → Pass Type ID → certificate → PEMs into secrets | S | days–2 wks |
| ⬜ | Download the official "Add to Apple Wallet" badge | S | minutes |
| ⬜ | Twilio Messaging Service (Advanced Opt-Out) + A2P 10DLC or toll-free verification | S | 1–3 wks |
| ⬜ | Google OAuth client + consent screen (redirect URIs for dev, staging, prod) | S | 1 hour |
| ⬜ | Resend: verify the sending domain (SPF, DKIM), DMARC `p=none` + reports, webhook | S | DNS hours |
| ⬜ | Generate production secrets (`PASS_CREDENTIAL_SECRETS`, `OAUTH_STATE_SECRET`, `PASSES_CRON_TOKEN`) and store them on the VPS; never in the repo | S | minutes |
| ⬜ | Staging environment on HTTPS for UAT | S/B | 1 day |

### D. Security and compliance
| | Item | Owner |
|---|---|---|
| ⬜ | `/security-review` over the full branch diff; all highs fixed; logged in `61-Security-Review.md` | B |
| ⬜ | Tests green: T-R1 verifier sweep, T-I1–I7 isolation, T-C1–C3 concurrency, T-S1–S6 public surface | B |
| ⬜ | Request logs redact `/p/<credential>` | B |
| ⬜ | Counsel reviews the VIP offer, the consent checkbox wording and the footer identification (CASL) | S |
| ⬜ | Holder data retention + erasure procedure confirmed (`03-data-model.md` § Retention) | S |
| ⬜ | Secrets inventory added to `44-Secrets-And-Rotation.md` with the Apple certificate expiry | B |

### E. Brand and content
| | Item | Owner |
|---|---|---|
| ✅ | Branded DGTL card system: DGTL⚡ PASS lockup, gold spark, 4 tier colours, design targets for every surface | B |
| ⬜ | Tier tokens added to the three token files with a drift test (P2.3) | B |
| ⬜ | DGTL wordmark PNG uploaded to the media library; DGTL tenant `walletLogoText: "PASS"` | B |
| ⬜ | Pilot tenant config: legal postal address, support email, timezone, day cutoff, gates, VIP offer, sign-off person | S |
| ⬜ | Brand-kit visual checklist passed on every surface vs its design target (desktop + 390 px) | B |

### F. Operations
| | Item | Owner |
|---|---|---|
| ⬜ | Uptime monitor on the app host and the pass host (Go-Live Plan phase 12) | S |
| ⬜ | **Scheduled** database backups plus one tested restore (today `scripts/backup-db.sh` is manual) | S/B |
| ⬜ | VPS crontab: `/api/cron/passes/drain` every 2 minutes | B |
| ⬜ | Error alerting / daily log review routine for the pilot | S |
| ⬜ | Rollback runbook (previous image tag + migration notes) | B |
| ⬜ | Expiry reminders: Apple Pass Type ID certificate, TLS auto-renew confirmed | S |

### G. Launch
| | Item | Owner |
|---|---|---|
| ⬜ | Device matrix passed: iPhone Safari, iPhone home-screen app, Android Chrome | B |
| ⬜ | Two phones, one single-use pass, same second: exactly one admit (video in the PR) | B |
| ⬜ | Email-client matrix: Gmail web, Gmail iOS, Apple Mail iOS/macOS, Outlook web | B |
| ⬜ | All five presets install in Apple Wallet on a real iPhone | B |
| ⬜ | Door-staff one-pager printed + a 15-minute walkthrough at the pilot venue | S |
| ⬜ | Go / no-go sign-off (Fri Oct 30) | S |
| ⬜ | Pilot: daily ledger review for two weeks; zero false admits | S/B |

## Decisions needed from Stephen

| # | Decision | Needed by | Recommendation |
|---|---|---|---|
| 1 | ~~Approve reconciling `main`~~ | done Oct 1 | Merged and pushed |
| 2 | Start Apple Developer + Twilio registration | **Fri Oct 2** | Twilio today (critical path). Apple: still recommended for launch, no longer blocking (WalletWallet covers Wallet until then) |
| 2b | Sign up for a free WalletWallet key, put it in `platform/.env` | before the demo | Yes: 2 minutes, turns on "Add to Apple Wallet" ([18](18-iphone-demo.md)) |
| 3 | `sales` role: issue + scan passes? | Mon Oct 5 | Yes (current default) |
| 4 | Pass host | Tue Oct 6 | `pass.dgtl.ltd`; it's permanent once QR codes ship |
| 5 | Merge PR #44 (release-gate fix) | **Fri Oct 2** | Merge once its checks are green |
| 6 | Pilot tenant + content (address, offer, sign-off) | Mon Oct 19 | One venue, one event night |
| 7 | Launch without SMS or Wallet if approvals lag? | Tue Oct 20 | Yes for the pilot; verification doesn't depend on either |
