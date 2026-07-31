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
| `deploy.dgtlmag.com` | deploy portal |
| `terminal.dgtlmag.com` | DGTL OS |

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

## 3 · Traefik

```bash
cd /opt/dgtl/deploy/vps/traefik
echo "ACME_EMAIL=you@example.com" > .env
docker compose up -d
```

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

## 5 · Decks + portal (pitch hosting)

```bash
mkdir -p /opt/dgtl-decks/site/pitch                        # the served dir both stacks mount
cd /opt/dgtl && deploy/vps/seed-pitches.sh /opt/dgtl /opt/dgtl-decks/site/pitch
cd deploy/decks   && docker compose up -d --build          # override file mounts /opt/dgtl-decks/site/pitch
cd ../portal      && cp ../vps/env-templates/portal.env.example .env  # fresh DEPLOY_TOKEN
docker compose up -d --build
curl -X POST https://deploy.dgtlmag.com/api/reindex -H "x-deploy-token: $DEPLOY_TOKEN"  # builds hub index
```

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
- `https://pitch.dgtlmedia.io/` hub lists seeded sites; spot-open `escott/`, `the-climb/`, `gold/`.
- Portal: zip-deploy a `hello` test slug, then delete it via the portal UI.
- `https://terminal.dgtlmedia.io` behind basic-auth; `/api/status` shows engine + `rag:true`; one RAG query answers with brain content.
- Outreach: keep `OUTREACH_DRY_RUN=true` until Resend DNS (SPF/DKIM on dgtlmag.com) re-verified; then one real test send to yourself.
- Stripe/Twilio webhooks: re-point endpoint URLs in their dashboards to the new host; test one webhook each.

## 8 · Security before announcing

1. Rotate: Resend, Google Places (also update its IP restriction to the new VPS IP), Hunter,
   Apollo (all four appeared in old session logs), OS basic-auth password (old hash was public),
   `DEPLOY_TOKEN`, `OUTREACH_CRON_TOKEN`, `UNSUBSCRIBE_SECRET`.
2. Old VPS is dead but its `env/` values live in the bundle — treat every un-rotated key as burned.
3. Snapshot the VPS once §7 passes; then update `brain/` (timeline + 64-External-Services: mark
   re-host done, M2 build verified, new IP).

## Build note (M2)

`npm run build` needs outbound network for Google Fonts — it runs during `docker compose up
--build` on the VPS. If it fails there, the fonts fetch is the first suspect; everything else
compiled clean in dev during the 07-28 audit.
