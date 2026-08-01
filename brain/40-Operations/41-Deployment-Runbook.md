---
title: 41 · Deployment Runbook (Hetzner VPS)
type: runbook
tags: [ops]
status: stable
updated: 2026-08-01
source: DEPLOY_HOSTINGER.md, PRE_DEPLOY_CHECKLIST.md, RESUME_HERE.md
---

# Deployment Runbook — Hetzner VPS

> **Host changed 2026-07-21.** Target is now **`37.27.198.189`** (Hetzner, host `DGTLapps`), and the
> edge is **Coolify** — stacks attach to the `coolify` network, not `traefik-public`. The Hostinger
> box `62.72.16.32` is gone. For a from-scratch rebuild follow `deploy/vps/README-VPS-DEPLOY.md`;
> this note covers the app's own deploy loop.

Target: `dgtlmag.com` on VPS `37.27.198.189` (Ubuntu + Docker + Coolify). App = Next.js container +
private Postgres container, published through Coolify's `coolify` network.

## 0. Hard gate — do NOT deploy unless ALL true
1. `npm test` green. 2. `npm run build` succeeds locally. 3. DNS for `@`/`www` → `37.27.198.189`.
4. VPS `/opt/content-checkout-funnel/.env` has **real** secrets (diff before overwriting; never clobber).
5. Fresh Postgres dump exists (`scripts/backup-db.sh`). 6. Post-deploy `curl -I https://dgtlmag.com/` → **200**.

> ⚠️ **Deploy from a branch that contains the Funding Survey** — `main` historically did not. Merge it first or deploy the feature branch, or the survey/CTA/subdomains won't be in the build.

## 1. DNS (managed at Hostinger; hosting is Hetzner)
```
A   @         37.27.198.189
A   www       37.27.198.189
A   funding   37.27.198.189     # → funded-growth tenant
A   grants    37.27.198.189     # → funded-growth tenant
```
`getTenantForHost` resolves `funding.`/`grants.` to the `funded-growth` tenant ([[15-Multi-Tenancy]]).
Verify a host route: `curl -I -H "Host: funding.dgtlmag.com" http://127.0.0.1:8088/`.

## 2–5. Build → upload → env → deploy
```bash
# On Mac: clean bundle (excludes .git/node_modules/.next/data)
cd /Users/emery/content-checkout-funnel
COPYFILE_DISABLE=1 tar --exclude=".git" --exclude=".DS_Store" --exclude="._*" \
  --exclude="node_modules" --exclude=".next" --exclude="data" \
  -czf /tmp/content-funnel-clean.tgz .
scp /tmp/content-funnel-clean.tgz root@37.27.198.189:/root/content-funnel-clean.tgz

# On VPS
ssh root@37.27.198.189
mkdir -p /opt/content-checkout-funnel && cd /opt/content-checkout-funnel
# Create/update .env (preserved across deploys). Generate strong values:
umask 077; POSTGRES_PASSWORD="$(openssl rand -base64 32)"
# ...write .env with POSTGRES_*, OWNER_*, TEAM_SLUG=default, provider keys (see [[43-Environment-Variables]])

# Replace bundle but KEEP .env
find /opt/content-checkout-funnel -mindepth 1 -maxdepth 1 -not -name ".env" -exec rm -rf {} +
tar -xzf /root/content-funnel-clean.tgz -C /opt/content-checkout-funnel
docker compose config
docker compose build content-funnel
docker compose up -d content-funnel-postgres
docker compose run --rm --no-deps content-funnel npm run migrate
read -s -p "Owner password: " OWNER_PASSWORD; echo
docker compose run --rm --no-deps -e OWNER_PASSWORD="$OWNER_PASSWORD" content-funnel npm run create-owner
docker compose run --rm --no-deps content-funnel npm run seed:tenants        # all 5 tenant funnels as DB rows (dgtlmag, dmtv, elixr, on-home-decor, funded-growth)
docker compose run --rm --no-deps content-funnel npm run seed:funding-demo   # optional demo data
docker compose up -d --build
```

## 🔑 Team setup (critical, easy to miss)
Built-in tenants (default + funded-growth) register under internal **`team_default`**; funnel + funding
leads scope there. **Set `TEAM_SLUG=default`** so the owner joins that team — otherwise `/admin` shows
no built-in tenants or leads. Brand name is set by tenant config, not the team slug. See [[15-Multi-Tenancy]].

## 6. Verify
```bash
curl -I http://127.0.0.1:8088/                      # 200 (host 8088 → container 3000)
docker inspect content-checkout-funnel --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}'  # coolify
curl -I https://dgtlmag.com/                        # 200 + valid TLS
docker logs content-checkout-funnel --tail=80
docker logs coolify-proxy --tail=80
```

## 502 remediation (this has happened — see [[51-Timeline]])
A 502 from Traefik = proxy/DNS/TLS healthy but the app container is down/unreachable.
```bash
docker compose ps
docker logs content-checkout-funnel --tail=120      # look for boot crash
scripts/backup-db.sh                                # back up FIRST
docker compose up -d content-funnel-postgres
docker compose up -d --build content-funnel
curl -I http://127.0.0.1:8088/                      # want 200
```
Common causes: boot crash on missing/invalid env (`DATABASE_URL`/`SESSION_SECRET`); container not on
the `coolify` network; loadbalancer port label ≠ container port `3000`. **Root cause of the historical 502:**
Next.js 15 bound to the container-id hostname instead of `0.0.0.0` → fixed with `HOSTNAME=0.0.0.0` in `docker-compose.yml`.

## One-command deploys (after first setup)
`deploy.sh` is in the repo. Activate once (`chmod +x`, commit, push). Then: **push from Mac → `./deploy.sh` on VPS.**

## Sync an outdated VPS to GitHub (source of truth)
```bash
cd /opt/content-checkout-funnel
git restore docker-compose.yml      # drop redundant local edit (origin has HOSTNAME fix)
git merge --ff-only origin/main
scripts/backup-db.sh
docker compose build content-funnel
docker compose run --rm --no-deps content-funnel npm run migrate
docker compose up -d
```

Related: [[42-Go-Live-Plan]] · [[45-Database-Backups]] · [[43-Environment-Variables]] · [[46-Demo-Flow]]

Up: [[40-Operations-MOC]]
