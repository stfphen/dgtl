---
tags: [reference, domains, hosting]
updated: 2026-08-10
---

# 65 · Domain Fleet & Hosting Map

The registrar portfolio, where each domain routes, and how its site deploys.
Source: the DGTL Web Architecture & Domain Map (2 Aug 2026, from repo @8bb1aac)
reconciled with the 3–4 Aug creator-intake deployment sessions. This note is
the working inventory for the Hostinger fleet build-out — update it as domains
move, sites attach, and locks expire.

## Hosting split (decided 2026-08-04)

- **Hetzner VPS `37.27.198.189`** (Coolify/Traefik): everything dynamic or
  already live — the platform on dgtlmag.com (+ tenant/pitch/funding subs),
  the Influence Journal on dgtlinfluence.com, DGTL OS, deploy portal.
- **Hostinger shared "Business" plan** (account `u111775448`, the *hosting*
  account): the static/light fleet — creator intake + the ten new `dgtl.*`
  placeholder properties. Human-click ceiling applies (site creation, domain
  attach, SSL, DB creation = hPanel only); deploys/DNS/DB automate after
  (see [[65-Domain-Fleet#Deploy pipeline]]).
- The **old Hostinger VPS is retired** — its IP must not appear in any doc;
  historical references are scrubbed to `[retired-vps]`.

## Registrar portfolio

Expiry/renewal as read 2026-08-02 — **verify after fixing auto-renewals.**

| Domain | Tier · role (map) | Expires | Auto-renew | Today | Plan |
|---|---|---|---|---|---|
| **dgtlmag.com** | 2 · Platform | **2026-08-28** | **OFF — CRITICAL** | Platform app, admin, Stripe/Twilio webhooks, 5 tenant subs, pitch.* | Stays on VPS. **Renew multi-year NOW.** |
| dgtlgroup.io | 1 · Brand hub | — | — | Live HELI-built marketing site | ⚠ Do NOT point at VPS — tenant-config collision (map finding). |
| dgtlinfluence.com | 3 · Publishing | 2027-01-17 | OFF | Journal (VPS); `join` sub → Hostinger intake | Turn auto-renew on. Root stays on VPS. |
| join.dgtlinfluence.com | — · Intake funnel | (sub) | — | **Live on Hostinger** (temp-domain site; DNS A → 147.93.42.96; awaiting domain account-move to connect) | Cutover when the ~4-day move lock clears. |
| on-homedecor.com | 5 · Client | 2028-01-22 | OFF | Paying client tenant host | Turn auto-renew on. |
| polishstone.ca / .com | 5 · Client | — | — | Client site in `sites/polishstone/` | Candidate for Hostinger fleet. |
| dgtlneon.com | — | 2026-10-02 | OFF | Unrouted | Decide keep/lapse before Oct. |
| dgtlai.io | — | — | on | Unrouted | Role TBD. |
| dgtlmedia.io | 5 · Retiring | — | — | Dead history (all `*.dgtlmedia.io` URLs retired) | Sunset. |
| dgtl.ltd | 0 · Corporate umbrella | — | on | New, in ~96h registration/move lock | Placeholder → `sites/dgtl-ltd/` |
| dgtl.chat | 2 · Platform | — | on | New, locked | Placeholder → `sites/dgtl-chat/` |
| dgtl.wiki | 3 · Publishing | — | on | New, locked | Placeholder → `sites/dgtl-wiki/` |
| dgtl.gallery | 3 · Publishing | — | on | New, locked | Placeholder → `sites/dgtl-gallery/` |
| dgtl.pics | 3 · Publishing | — | on | New, locked | Placeholder → `sites/dgtl-pics/` |
| dgtl.mov | 3 · Publishing | — | on | New, locked | Placeholder → `sites/dgtl-mov/` |
| dgtl.report | 3 · Publishing | — | on | **Client reporting host** (`deploy/report-host` + `deploy/report-portal`): status reports at `dgtl.report/<slug>/`, audits at `audit.dgtl.report/<slug>/`, portal at `deploy.dgtl.report` | VPS/Coolify — A records apex+www+audit+deploy → VPS. Supersedes the placeholder plan. |
| dgtl.rent | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-rent/` |
| dgtl.college | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-college/` |
| dgtl.at | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-at/` |

## Placeholder builds

One brief per new domain in `sites/_briefs/<slug>.md` (shared rules in
`sites/_briefs/README.md`) — each hands one agent one `/dgtl-brand-kit` page
into `sites/<slug>/`, branch `feat/site-<slug>`. Honesty constraint: undefined
business lines get teaser copy, nothing invented.

## Deploy pipeline

`.github/workflows/deploy-sites.yml` splits every `sites/<name>/` folder (and
`apps/creator-intake/site/`) into a `deploy/…` branch on each push to main;
Hostinger's per-site Git deployment pulls it via webhook. Full hookup runbook:
`sites/_briefs/DEPLOY-PIPELINE.md`. Secrets never ride the pipeline — per-site
`.env` lives above the webroot, uploaded once by hand.

## Day-of-unlock batch runbook (per domain, ~4 min)

1. Move domain into the hosting account (internal move; zone intact, no downtime).
2. hPanel: add website + connect domain → PHP version → SSL auto-issues.
3. Advanced → GIT: repo `https://github.com/stfphen/dgtl`, branch
   `deploy/site-<slug>`, dir empty → clone → add hPanel webhook URL to GitHub.
4. (Dynamic sites only) create DB + Remote MySQL, upload `.env` above webroot.
5. Record SFTP/DB/webhook credentials here ↓.

## Credential inventory (fill as sites attach)

| Site | SFTP user | DB | Webhook added | Notes |
|---|---|---|---|---|
| creator-intake (temp domain) | u111775448 (SSH `nologin` — support ticket pending) | u111775448_join_dgtl / u111775448_dgtl | not yet | `.env` above webroot; SMTP + R2 pending |

Up: [[60-Reference-MOC]] · Related: [[64-External-Services]], [[41-Deployment-Runbook]]
