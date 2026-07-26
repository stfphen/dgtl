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
- **VPS:** `root@62.72.16.32` (Hostinger, Ubuntu, Docker, Traefik 80/443, `traefik-public` network, LetsEncrypt resolver `letsencrypt`).
- **Domain:** `dgtlmag.com` + `www` + `funding` + `grants` (all A → 62.72.16.32).
- **Prod path:** `/opt/content-checkout-funnel` (live `.env` lives here, never in git).
- **Containers:** `content-checkout-funnel` (app, port 3000) + `content-funnel-postgres`.
- **One-command deploy:** `deploy.sh` (push from Mac → `./deploy.sh` on VPS).

Up: [[00-Home]]
