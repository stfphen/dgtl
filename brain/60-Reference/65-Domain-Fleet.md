---
tags: [reference, domains, hosting]
updated: 2026-08-25
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
| **dgtlmag.com** | 2 · Platform | **2026-08-28** | **OFF — CRITICAL** | Platform app, admin, Stripe/Twilio webhooks, 5 tenant subs, `pitch.*` (still serving existing pitches), `deploy.*` (legacy portal hostname) | Stays on VPS. **Renew multi-year NOW** — the 2026-08-25 portal merge kept `pitch.dgtlmag.com` live rather than migrating its slugs, so client pitch links already sent die with this domain. |
| dgtlgroup.io | 1 · Brand hub | — | — | Live HELI-built marketing site | ⚠ Do NOT point at VPS — tenant-config collision (map finding). |
| dgtlinfluence.com | 3 · Publishing | 2027-01-17 | OFF | Journal (VPS); `join` sub → Hostinger intake | Turn auto-renew on. Root stays on VPS. |
| join.dgtlinfluence.com | — · Intake funnel | (sub) | — | **Live on Hostinger** (temp-domain site; DNS A → 147.93.42.96; awaiting domain account-move to connect) | Cutover when the ~4-day move lock clears. |
| on-homedecor.com | 5 · Client | 2028-01-22 | OFF | Paying client tenant host | Turn auto-renew on. |
| polishstone.ca / .com | 5 · Client | — | — | Client site in `sites/polishstone/` | Candidate for Hostinger fleet. |
| dgtlneon.com | — | 2026-10-02 | OFF | Unrouted | Decide keep/lapse before Oct. |
| dgtlai.io | — | — | on | Unrouted | Role TBD. |
| dgtlmedia.io | 5 · Retiring | — | — | Dead history (all `*.dgtlmedia.io` URLs retired) | Sunset. |
| dgtl.ltd | 0 · Corporate umbrella | — | on | The umbrella domain, three roles: **`os.dgtl.ltd`** is the DGTL OS canonical host (routed in `platform/docker-compose.yml`; cutover runbook `docs/operations/os-dgtl-ltd-migration-runbook.md`), **`deploy.dgtl.ltd`** is the publish portal (`deploy/publish-portal`), **`pitch.dgtl.ltd/<slug>/`** is corporate pitches (`deploy/publish-host`) — the replacement for `pitch.dgtlmag.com`. Apex stays the corporate placeholder. | VPS/Coolify — A records `os` + `deploy` + `pitch` → VPS. Apex: placeholder → `sites/dgtl-ltd/`. |
| dgtl.chat | 2 · Platform | — | on | **LIVE — DGTL OS internal alpha** on the VPS; stays as the OS/assistant entry point after the os.dgtl.ltd cutover | No placeholder site; the domain serves the app. |
| dgtl.wiki | 3 · Publishing | — | on | New, locked | Placeholder → `sites/dgtl-wiki/` |
| dgtl.gallery | 3 · Publishing | — | on | Apex = placeholder site on Hostinger (`2.57.91.91`); **`shoots.dgtl.gallery/<slug>/`** = shoot galleries on the VPS (`deploy/publish-host`) | Apex stays on Hostinger — do NOT repoint it. |
| dgtl.pics | 3 · Publishing | — | on | Apex = placeholder site on Hostinger (`2.57.91.91`); **`sets.dgtl.pics/<slug>/`** = photo sets on the VPS (`deploy/publish-host`) | Apex stays on Hostinger — do NOT repoint it. |
| dgtl.mov | 3 · Publishing | — | on | Apex = live site on the VPS; **`watch.dgtl.mov/<slug>/`** = video pages (`deploy/publish-host`) | Apex already serves — do NOT repoint it. |
| dgtl.report | 3 · Publishing | — | on | **Client reporting host** (`deploy/report-host`): status reports at `dgtl.report/<slug>/`, audits at `audit.dgtl.report/<slug>/`. Publishing moved to `deploy.dgtl.ltd` on 2026-08-25; `deploy.dgtl.report` is a legacy hostname on the same container. | VPS/Coolify — A records apex+www+audit+deploy → VPS. Live and verified 2026-08-25. |
| dgtl.rent | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-rent/` |
| dgtl.college | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-college/` |
| dgtl.at | 4 · Commercial | — | on | New, locked | Placeholder → `sites/dgtl-at/` |

## Placeholder builds

One brief per new domain in `sites/_briefs/<slug>.md` (shared rules in
`sites/_briefs/README.md`) — each hands one agent one `/dgtl-brand-kit` page
into `sites/<slug>/`, branch `feat/site-<slug>`. Honesty constraint: undefined
business lines get teaser copy, nothing invented.

## Publishing portal (2026-08-25)

One portal at **`deploy.dgtl.ltd`** publishes to every static destination, with a single
`DEPLOY_TOKEN`. Destinations are declared in `deploy/publish-portal/targets.json`, not in code.
It supersedes the separate `deploy.dgtlmag.com` and `deploy.dgtl.report` portals, which are now
legacy hostnames on the same container (served, not redirected — a 301 would break POSTs).
Only `pitch.dgtlmag.com` publishes a public index of its slugs; everything else is private-by-URL.
See `deploy/publish-portal/README.md`.

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
