# dgtl-decks

Self-hosted pitch decks on your own domain. Replaces Netlify. Static HTML served by nginx in a
Docker container, fronted by the Traefik you already run on the VPS.

**Live URL pattern:** `https://pitch.dgtlmag.com/{client}/`

> **Updated 2026-08-01.** This folder is **not** a standalone repo any more — it ships inside
> `stfphen/dgtl` and deploys from `/opt/dgtl/deploy/decks` on the VPS (see
> `deploy/vps/README-VPS-DEPLOY.md` §5). The old "move it out and `git init`" instructions, the
> `pitch.dgtlmedia.io` host, and the IP `62.72.16.32` are all dead — `dgtlmedia.io` is no longer
> ours and that Hostinger box was offboarded 2026-07-21. The compose file here already routes
> `pitch.dgtlmag.com` on Coolify's `coolify` network.

## Make a deck
```bash
chmod +x deploy.sh scripts/*.sh        # first time only
./scripts/new-deck.sh "Acme Corp"      # -> site/pitch/acme-corp/index.html
./scripts/build-index.sh               # refresh the /pitch gallery
./scripts/preview.sh                   # http://localhost:8080/pitch/
```
For a real, polished deck, generate it with the **dgtl-pitch-pages** skill and save the output as
`site/pitch/<slug>/index.html` instead of the scaffold.

## Ship it (one command)
```bash
git add . && git commit -m "deck: acme-corp" && git push
ssh root@37.27.198.189 'cd /opt/dgtl && git pull && cd deploy/decks && docker compose up -d --build'
# live: https://pitch.dgtlmag.com/acme-corp/
```

Note the served directory is `/opt/dgtl-decks/site/pitch`, mounted read-only by
`docker-compose.override.yml` — `deploy/vps/seed-pitches.sh` populates it from `pitches/`.

## First-time VPS setup
```bash
ssh root@37.27.198.189
cd /opt/dgtl/deploy/decks
docker compose up -d --build
curl -I http://127.0.0.1:8090/sample-client/   # expect 200
```
Requires DNS `A pitch.dgtlmag.com -> 37.27.198.189` and Coolify's external `coolify` network
(already present). Coolify's Traefik issues the LetsEncrypt cert automatically on the first HTTPS
hit. The apex `dgtlmag.com` is untouched — decks live on their own subdomain.

## Phase 2 — Coolify (later)
Connect this repo in Coolify as a **Dockerfile** app; every `git push` then auto-deploys with no
SSH step. Keep the same Traefik labels or let Coolify manage the domain. See the blueprint.

## Layout
| Path | What |
|---|---|
| `site/pitch/{client}/index.html` | one deck = one folder |
| `site/pitch/index.html` | internal gallery (noindex) |
| `site/pitch/404.html` | branded 404 |
| `templates/deck-template/` | scaffold used by new-deck.sh |
| `Dockerfile`, `nginx.conf` | nginx static host |
| `docker-compose.yml` | container + Traefik routing labels |
| `deploy.sh` | VPS: pull origin/main + rebuild |
| `scripts/` | new-deck, preview, build-index |
