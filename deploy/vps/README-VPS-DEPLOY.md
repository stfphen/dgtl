# Fresh VPS deployment — runbook

Target: one clean Ubuntu 22/24 VPS running the full DGTL stack behind Traefik.
Everything below assumes the current hostnames; if the domain plan changes, edit the
`Host()` labels in each compose file first (platform, decks, portal, os) — nothing else moves.

Inputs you need at hand: this repo, the `dgtl-offboard-20260721` bundle (data + old secrets),
a password manager with **rotated** values (see §8), and DNS control.

## 1 · DNS

Domain plan (2026-07-28): everything lives under **dgtlmag.com** — dgtlmedia.io is not under
our control, so all old `*.dgtlmedia.io` URLs are dead history. `dgtlinfluence.com` is reserved
for the Influence Journal (`journal/`) when it deploys.

Point A records at the VPS IP:

| Record | Serves |
|---|---|
| `dgtlmag.com`, `www.dgtlmag.com` | platform — root goes to /admin; tenant funnels at /t/[slug] |
| `funding.dgtlmag.com` | funded-growth tenant (built-in host routing) |
| `pitch.dgtlmag.com` | decks (pitch sites) |
| `deploy.dgtlmag.com` | the deploy portal, legacy hostname — same container as `deploy.dgtl.ltd` |
| `dgtl.report`, `www.dgtl.report` | client status reports (report-host) — apex is a placeholder, reports at `/<slug>/` |
| `audit.dgtl.report` | client audit pages (same report-host container) |
| `deploy.dgtl.report` | the deploy portal, legacy hostname — same container as `deploy.dgtl.ltd` |
| `deploy.dgtl.ltd` | **the deploy portal** — one portal, every destination (publish-portal) |
| `pitch.dgtl.ltd` | corporate pitches (publish-host) — the replacement for `pitch.dgtlmag.com` |
| `shoots.dgtl.gallery` | shoot galleries (publish-host) |
| `sets.dgtl.pics` | photo sets (publish-host) |
| `watch.dgtl.mov` | video pages (publish-host) |
| `terminal.dgtlmag.com` | DGTL OS |

The three creative hosts are **subdomains, not apexes**: `dgtl.gallery` and `dgtl.pics` serve their
own placeholder sites on Hostinger (`2.57.91.91`) and `dgtl.mov` serves a live site on this VPS —
repointing those apexes would take three live sites down.

`sites/polishstone` is **not** seeded to the pitch host: it uses root-absolute links and its own
sitemap/robots — it wants a domain root (the client's own domain, or `polishstone.dgtlmag.com`
with its own nginx/label block). Decide separately.

## 2 · Host prep

```bash
apt update && apt install -y docker.io docker-compose-v2 rsync git
ufw allow 22,80,443/tcp && ufw enable
mkdir -p /opt && cd /opt
git clone https://github.com/stfphen/dgtl.git dgtl
# scp the offboard bundle to /opt/offboard/dgtl-offboard-20260721
docker network create traefik-public
```

## 3 · Front proxy — Coolify (already running)

This VPS runs **Coolify**; its `coolify-proxy` container is Traefik and already owns 80/443.
**Do not start `deploy/vps/traefik/`** — every stack's labels now target Coolify directly:
network `coolify`, entrypoints `http`/`https`, certresolver `letsencrypt`, with per-host
http→https redirects built into the labels. There is nothing to start in this step.

Verify Coolify's names once (defaults shown are what our labels expect):

```bash
docker network ls | grep coolify                       # network "coolify" must exist
docker inspect coolify-proxy --format '{{json .Args}}' | tr ',' '\n' | grep -iE 'entrypoints|resolvers' | head
# expect: entrypoints.http / entrypoints.https and certificatesresolvers.letsencrypt
```

If you ever ran our traefik here, clean it up: `cd /opt/dgtl/deploy/vps/traefik && docker compose down -v`.

> **Security note:** Docker-published ports bypass ufw. Coolify's dashboard (`:8000`) and the
> proxy API (`:8080`) are internet-reachable — set a strong Coolify admin password and, ideally,
> add a provider-level (Hetzner) firewall restricting 8000/8080/6001-6002 to your own IP.

## 4 · Platform (+ its Postgres, data restore)

```bash
cd /opt/dgtl/platform
cp ../deploy/vps/env-templates/platform.env.example .env   # fill with rotated values
docker compose up -d content-funnel-postgres               # DB first
../deploy/vps/restore-data.sh /opt/offboard/dgtl-offboard-20260721 /opt/dgtl   # restores content_funnel (+dgtlkb later re-run) + uploads
docker compose up -d --build                               # app (migrate is a no-op on restored schema)
docker compose exec content-funnel node scripts/migrate.js # confirm "up to date"
```

**Post-restore domain cleanup (required):** the July-21 dump's tenant rows still carry
old host claims (localhost, app.dgtlmedia.io, dgtlmag.com). The app root now sends unclaimed
hosts to `/admin` — a stale dgtlmag.com claim would resurrect the Content Day funnel on the
app's own root. Content Day is slug-only now (/t/dgtlmag). Fix:

```bash
docker exec -it content-funnel-postgres psql -U content_funnel -d content_funnel \
  -c "select slug, domains from tenants;" \
  -c "update tenants set domains = '[]' where slug = 'dgtlmag';"
```

Review the `select` output and strip `localhost`/`app.dgtlmedia.io` entries from any other row.

## 5 · Publishing stacks (one portal, every destination)

**One portal at `deploy.dgtl.ltd`, one `DEPLOY_TOKEN`.** It writes into the content dirs of
three nginx host containers; each host mounts only its own dirs read-only. The old
`deploy.dgtlmag.com` and `deploy.dgtl.report` portals are retired; the new container answers on
all three hostnames (not a 301 — a 301 downgrades POST to GET and would break skills that post
to the old host). Their *content* hosts (`decks`, `report-host`) stay up. Destinations live in
`deploy/publish-portal/targets.json`; see `deploy/publish-portal/README.md`.

```bash
# content dirs — the portal mounts all of these rw, each host mounts its own ro
mkdir -p /opt/dgtl-decks/site/pitch                    # pitch.dgtlmag.com   (public hub index)
mkdir -p /opt/dgtl-report/site/{reports,audits}        # dgtl.report, audit.dgtl.report
mkdir -p /opt/dgtl-publish/site/{pitch-ltd,gallery,pics,mov}   # the dgtl.ltd / creative hosts

# host containers (content only — no token, no write access)
cd /opt/dgtl && deploy/vps/seed-pitches.sh /opt/dgtl /opt/dgtl-decks/site/pitch
cd /opt/dgtl/deploy/decks        && docker compose up -d --build
cd /opt/dgtl/deploy/report-host  && docker compose up -d --build
cd /opt/dgtl/deploy/publish-host && docker compose up -d --build
docker ps --format '{{.Names}}\t{{.Status}}' | grep publish-host   # MUST be Up — see note below

# retire the old portals BEFORE starting the new one — they own Traefik routers on
# deploy.dgtlmag.com and deploy.dgtl.report, which publish-portal reclaims for its 301s
docker rm -f dgtl-deploy dgtl-report-deploy || true

# the portal — mint ONE fresh token, retire both old ones
cd /opt/dgtl/deploy/publish-portal
cp ../vps/env-templates/publish-portal.env.example .env
openssl rand -hex 32     # paste as DEPLOY_TOKEN in .env — the template ships CHANGE_ME,
                         # and the portal refuses to boot on it (docker logs says so)
docker compose up -d --build --force-recreate
docker exec dgtl-publish sh -c 'printf "%s" "$DEPLOY_TOKEN" | wc -c'   # expect 64

curl -sS https://deploy.dgtl.ltd/health                # {"ok":true,"targets":7}
curl -sS https://deploy.dgtl.report/health             # same app on the legacy hostname
```

**Confirm `dgtl-publish-host` actually started.** The portal boots without it — it only needs the
content dirs — so a host container that failed to start (a port clash on its local debug mapping is
the likely cause; override with `PUBLISH_HOST_PORT=<free>`) presents as a fully healthy deploy until
a page is requested, when Traefik finds no router for the hostname and serves its default
self-signed cert. Trust `docker ps`, not a curl to the debug port: that port may be answered by
whichever container actually holds it.

Only `pitch.dgtlmag.com` publishes a hub index of its slugs. Every other destination is
private-by-URL: apex placeholder baked into the nginx image, `robots.txt` disallow-all,
`X-Robots-Tag: noindex, nofollow` (decision 2026-08-10). The portal regenerates the hub
automatically on write and delete, so there is no separate reindex step.

## 6 · DGTL OS (+ pgvector)

```bash
cd /opt/dgtl/apps/dgtl-os/local/deploy/docker
cp /opt/dgtl/deploy/vps/env-templates/os.env.example .env  # fill; keep dgtl/dgtlkb role+db
# replace __BASICAUTH__ in docker-compose.yml with a NEW htpasswd hash (DEPLOY-DOCKER.md §auth)
docker compose up -d --build
# knowledge: either restore the Jul-21 RAG dump (re-run restore-data.sh once dgtl-pgvector is up)
# or rebuild fresh from the brain:
rsync -a --delete /opt/dgtl/brain/ /opt/dgtl/apps/dgtl-os/local/knowledge/docs/brain/
docker compose exec dgtl-os node knowledge/ingest.mjs
```

## 7 · Smoke checklist

- `https://app.dgtlmedia.io` renders; `/admin` login works (`node scripts/create-owner.js` if needed); one tenant funnel `/t/<slug>` renders; leads table non-empty (restored).
- `https://pitch.dgtlmag.com/` hub lists seeded sites; spot-open `escott/`, `the-climb/`, `gold/`.
- Portal: `https://deploy.dgtl.ltd/` lists all seven destinations after the token is entered;
  zip-deploy a `hello` slug to `pitch-ltd` and to `audit`, open both, delete both.
- `https://deploy.dgtl.report/health` and `https://deploy.dgtlmag.com/health` answer from the
  same container as `deploy.dgtl.ltd`, with the same single token.
- `https://dgtl.report/`, `https://audit.dgtl.report/` and `https://pitch.dgtl.ltd/` show the
  placeholder (no slug listing) and return `X-Robots-Tag: noindex, nofollow`.
- `https://terminal.dgtlmedia.io` behind basic-auth; `/api/status` shows engine + `rag:true`; one RAG query answers with brain content.
- Outreach: keep `OUTREACH_DRY_RUN=true` until Resend DNS (SPF/DKIM on dgtlmag.com) re-verified; then one real test send to yourself.
- Stripe/Twilio webhooks: re-point endpoint URLs in their dashboards to the new host; test one webhook each.

## 8 · Security before announcing

1. Rotate: Resend, Google Places (also update its IP restriction to the new VPS IP), Hunter,
   Apollo (all four appeared in old session logs), OS basic-auth password (old hash was public),
   `DEPLOY_TOKEN` (now a single token for every publish destination — the two old portal tokens
   are retired), `OUTREACH_CRON_TOKEN`, `UNSUBSCRIBE_SECRET`.
2. Old VPS is dead but its `env/` values live in the bundle — treat every un-rotated key as burned.
3. Snapshot the VPS once §7 passes; then update `brain/` (timeline + 64-External-Services: mark
   re-host done, M2 build verified, new IP).

## Build note (M2)

`npm run build` needs outbound network for Google Fonts — it runs during `docker compose up
--build` on the VPS. If it fails there, the fonts fetch is the first suspect; everything else
compiled clean in dev during the 07-28 audit.
