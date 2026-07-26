# Live Setup Runbook — DGTL decks + domain tree

Execute top to bottom. **Phase 1 does not touch the live app** — decks are a separate container on
a separate path. Phase 2 (Coolify) is optional and should run in a maintenance window.

Legend: `[MAC]` runs on your machine · `[VPS]` runs on `ssh root@62.72.16.32` · `[DNS]` Hostinger panel.

---

## Phase 1 — Decks live on your domain (zero risk, ~15 min)

### Step 1 — DNS `[DNS]`
`dgtlmedia.io`'s DNS is managed at **Hostinger** (where you have access). In hPanel → Domains →
`dgtlmedia.io` → DNS / Nameservers, add ONE record (the apex redirect stays intact):
```
A   pitch   62.72.16.32     # decks live at pitch.dgtlmedia.io
```
Verify (wait for propagation, usually minutes):
```bash
dig +short pitch.dgtlmedia.io    # -> 62.72.16.32
```
(`dgtlgroup.io` DNS lives on Cloudflare and is left untouched — we're not using it for launch.)

### Step 2 — Make it a repo `[MAC]`
```bash
cd ~/content-checkout-funnel/dgtl-deploy       # where this bundle is
mv decks ~/dgtl-decks && cd ~/dgtl-decks
chmod +x deploy.sh scripts/*.sh
git init && git add . && git commit -m "init dgtl-decks"
# create an empty GitHub repo named dgtl-decks, then:
git branch -M main
git remote add origin git@github.com:<YOUR_GH>/dgtl-decks.git
git push -u origin main
```

### Step 3 — First deploy `[VPS]`
```bash
ssh root@62.72.16.32
cd /opt && git clone git@github.com:<YOUR_GH>/dgtl-decks.git && cd dgtl-decks
chmod +x deploy.sh scripts/*.sh
docker compose up -d --build
docker ps | grep dgtl-decks                         # running
curl -I http://127.0.0.1:8090/sample-client/        # HTTP 200
```

### Step 4 — Verify HTTPS `[MAC]`
```bash
curl -I https://pitch.dgtlmedia.io/sample-client/   # 200 + valid TLS (Traefik auto-issued cert)
```
Open it in a browser. If you see the black+gold sample deck, the pipeline is live.

### Step 5 — Confirm the app is untouched `[MAC]`
```bash
curl -I https://dgtlmag.com/                         # still 200 — unchanged
```

**That's it for the everyday workflow.** From now on, per deck:
```bash
# [MAC]
./scripts/new-deck.sh "Client Name"      # or drop a dgtl-pitch-pages deck into site/pitch/<slug>/
./scripts/build-index.sh
git add . && git commit -m "deck: client-name" && git push
# [VPS]
cd /opt/dgtl-decks && ./deploy.sh        # ~30s -> live at pitch.dgtlmedia.io/client-name/
```

### Optional — one-liner deploy alias `[MAC]`
Add to `~/.zshrc` so a single command pushes and deploys:
```bash
alias deck-ship='git -C ~/dgtl-decks push && ssh root@62.72.16.32 "cd /opt/dgtl-decks && ./deploy.sh"'
```

### Troubleshooting
- `404` on the deck path → Traefik didn't match. Check `docker logs traefik --tail=50` and confirm
  the router rule host matches the DNS you pointed. Confirm the container is on `traefik-public`:
  `docker inspect dgtl-decks --format '{{range $k,$_ := .NetworkSettings.Networks}}{{println $k}}{{end}}'`.
- `502` → container down: `docker logs dgtl-decks --tail=50`, then `docker compose up -d --build`.
- Cert not issued → first HTTPS hit triggers it; retry after ~30s. Ensure ports 80/443 open and
  DNS resolves to the VPS.

### Rollback (Phase 1)
```bash
# [VPS] removes ONLY the decks; app + Traefik untouched
cd /opt/dgtl-decks && docker compose down
```

---

## Phase 2 — Coolify control plane (optional, maintenance window)

Goal: git-push auto-deploys for **all** apps (funnel app included), no more tar/scp/ssh.
Because Coolify's proxy also wants 80/443, pick ONE model:

**Model A — Coolify owns the edge (cleanest long-term).** Take a DB backup, install Coolify, let it
take 80/443, then migrate the app + Postgres + decks in as Coolify resources and retire the
hand-managed Traefik. Brief downtime during cutover.

**Model B — Coolify as build backend behind existing Traefik (safest).** Install Coolify but set its
proxy to alt ports so the current Traefik stays the edge:
```bash
# [VPS] after install, edit /data/coolify/proxy/docker-compose.yml: 80->5080, 443->5443, restart proxy
```
Apps Coolify builds attach to `traefik-public` with custom labels; the existing Traefik keeps routing.

### Install (either model) `[VPS]`
```bash
# Backup first
cd /opt/content-checkout-funnel && scripts/backup-db.sh
# Requirements: 2+ CPU, 2GB+ RAM free (Coolify itself uses ~1GB), 30GB disk, Ubuntu LTS.
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# Dashboard: http://62.72.16.32:8000  -> create admin, then point deploy.dgtlgroup.io at it.
```
Then in the UI: connect GitHub → add `dgtl-decks` as a Dockerfile app (auto-deploy on push) →
optionally import the funnel app the same way. Protect `deploy.dgtlgroup.io` with auth + IP allowlist.

> ⚠️ Do NOT run the Coolify installer casually on the live box without a backup and a rollback plan.
> If unsure, stay on Phase 1 (which already gives you Netlify-style deck deploys) and schedule
> Phase 2 deliberately.

---

## DNS quick-reference
```
# dgtlmedia.io (DNS at Hostinger) — add only:
A   pitch    62.72.16.32     # decks — the only record needed to go live now
# dgtlgroup.io (DNS at Cloudflare) — untouched for launch. To brand decks under the hub later,
#   add in Cloudflare (DNS-only/grey cloud):  CNAME pitch.dgtlgroup.io -> pitch.dgtlmedia.io
#   and a matching Host(`pitch.dgtlgroup.io`) router on the same container.
# dgtlmag.com — unchanged (@, www, funding, grants already set)
# dgtlinfluence.com — keep redirect, or A -> 62.72.16.32 for a branded lander
```
