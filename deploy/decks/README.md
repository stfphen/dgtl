# dgtl-decks

Self-hosted pitch decks on your own domain. Replaces Netlify. Static HTML served by nginx in a
Docker container, fronted by the Traefik you already run on the VPS.

**Live URL pattern:** `https://pitch.dgtlmedia.io/{client}/`

> This is a **standalone repo**. It currently lives inside the app repo under `dgtl-deploy/decks/`
> for convenience. Before first use, move it out and give it its own git history:
> ```bash
> mv dgtl-deploy/decks ~/dgtl-decks && cd ~/dgtl-decks
> git init && git add . && git commit -m "init dgtl-decks"
> # create the GitHub repo, then:
> git branch -M main && git remote add origin git@github.com:<you>/dgtl-decks.git && git push -u origin main
> ```
> (Or keep it here and add `dgtl-deploy/` to the app repo's `.gitignore`.)

## Make a deck
```bash
chmod +x deploy.sh scripts/*.sh        # first time only
./scripts/new-deck.sh "Acme Corp"      # -> site/pitch/acme-corp/index.html
./scripts/build-index.sh               # refresh the /pitch gallery
./scripts/preview.sh                   # http://localhost:8080/pitch/
```
For a real, polished deck, generate it with the **dgtl-pitch-pages** skill and save the output as
`site/pitch/<slug>/index.html` instead of the scaffold.

## Ship it (Phase 1 — one command)
```bash
git add . && git commit -m "deck: acme-corp" && git push
ssh root@62.72.16.32 'cd /opt/dgtl-decks && ./deploy.sh'
# live: https://pitch.dgtlmedia.io/acme-corp/
```

## First-time VPS setup
```bash
ssh root@62.72.16.32
cd /opt && git clone git@github.com:<you>/dgtl-decks.git && cd dgtl-decks
chmod +x deploy.sh scripts/*.sh
docker compose up -d --build
curl -I http://127.0.0.1:8090/sample-client/   # expect 200
```
Requires DNS `A pitch.dgtlmedia.io -> 62.72.16.32` and the external `traefik-public` network
(already present from the app). Traefik issues the LetsEncrypt cert automatically on first HTTPS
hit. The apex `dgtlgroup.io` is untouched — decks live on their own subdomain.

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
