---
title: 40 · Operations MOC
type: moc
tags: [moc, ops]
updated: 2026-06-27
---

# ⚙️ Operations MOC

How to run, deploy, secure, and demo the app.

## Notes
- [[41-Deployment-Runbook]] — Hostinger VPS deploy (build → upload → env → migrate → up → verify).
- [[42-Go-Live-Plan]] — the 12-phase production plan (the master ops checklist).
- [[43-Environment-Variables]] — every env var and what it powers.
- [[44-Secrets-And-Rotation]] — key rotation + secrets hygiene runbook.
- [[45-Database-Backups]] — backup/restore procedure.
- [[46-Demo-Flow]] — the live demo script + provider QA.
- [[47-Git-Workflow]] — guardrails + the branch landscape.

## Key infra facts
- **VPS:** `root@37.27.198.189` (Hetzner, host `DGTLapps`, Ubuntu, Docker; **Coolify** owns 80/443 via its `coolify-proxy` Traefik on the `coolify` network, LetsEncrypt resolver `letsencrypt`). *The old Hostinger box `[retired-vps]` on `traefik-public` was offboarded 2026-07-21; it still appears throughout `deploy/LIVE-SETUP-RUNBOOK.md` and `deploy/DGTL-Domain-and-Deploy-Blueprint.md`, both now banner-marked superseded.*
- **Domain:** `dgtlmag.com` + `www` + `funding` + `grants` (all A → 37.27.198.189), plus `pitch.dgtlmag.com` (decks) and `dgtlinfluence.com` + `www` (Influence Journal, live 2026-08-01).
- **Repo on the VPS:** `/opt/dgtl` — decks and journal deploy with `docker compose up -d --build` from `deploy/<stack>/`.
- **Prod path:** `/opt/content-checkout-funnel` (live `.env` lives here, never in git).
- **Containers:** `content-checkout-funnel` (app, port 3000) + `content-funnel-postgres`.
- **One-command deploy:** `deploy.sh` (push from Mac → `./deploy.sh` on VPS).

Up: [[00-Home]]
