# DGTL Publish Portal — `deploy.dgtl.ltd`

One drag-and-drop publishing portal for every DGTL static destination. Supersedes the
two single-purpose portals that used to run side by side:

| Retired | Was | Now |
|---|---|---|
| `deploy/portal` | `deploy.dgtlmag.com` → `pitch.dgtlmag.com` only | destination `pitch-mag` |
| `deploy/report-portal` | `deploy.dgtl.report` → `dgtl.report` + `audit.dgtl.report` | destinations `report`, `audit` |

Both old hostnames are **served by the same container** as `deploy.dgtl.ltd` — deliberately
not 301'd, because a 301 downgrades POST to GET and would silently break every skill that
posts to `/api/deploy` on the old host. There is now **one `DEPLOY_TOKEN`** instead of two,
and `deploy.dgtl.ltd` is the canonical name to use going forward.

## Destinations

Destinations are data, not code — see [`targets.json`](targets.json).

| Key | Publishes to | Listed publicly? | Served by |
|---|---|---|---|
| `pitch-ltd` *(default)* | `pitch.dgtl.ltd/<slug>/` | no | `deploy/publish-host` |
| `pitch-mag` | `pitch.dgtlmag.com/<slug>/` | **yes — public hub index** | `deploy/decks` |
| `report` | `dgtl.report/<slug>/` | no | `deploy/report-host` |
| `audit` | `audit.dgtl.report/<slug>/` | no | `deploy/report-host` |
| `gallery` | `shoots.dgtl.gallery/<slug>/` | no | `deploy/publish-host` |
| `pics` | `sets.dgtl.pics/<slug>/` | no | `deploy/publish-host` |
| `mov` | `watch.dgtl.mov/<slug>/` | no | `deploy/publish-host` |

The three creative destinations use **subdomains, not apexes**: `dgtl.gallery` and
`dgtl.pics` serve their own placeholder sites on Hostinger and `dgtl.mov` serves a live
site on this VPS. Taking the apexes would have knocked those three offline.

`hub: true` is the only behavioural fork in the server: that destination regenerates a
public index of its live slugs at its root on every write and delete. Every other
destination is **private by URL** — slugs are never listed, `robots.txt` disallows all,
and nginx sends `X-Robots-Tag: noindex, nofollow` (decision 2026-08-10).

### Adding a destination

1. Add an entry to `targets.json`.
2. Mount its dir read-write in `docker-compose.yml` (and read-only on whichever host container serves it).
3. Add the hostname to that host container's `nginx.conf` `map` and its Traefik `Host()` rule.
4. Add the A record.

No change to `server.js`. A destination whose dir is not mounted is skipped at boot and
simply does not appear in the portal, so domains can be routed one at a time.

## API

Every `/api/*` call needs `x-deploy-token: $DEPLOY_TOKEN`. `target` defaults to
`pitch-ltd` (the entry flagged `"default": true`).

```bash
# discover destinations
curl -s https://deploy.dgtl.ltd/api/targets -H "x-deploy-token: $TOKEN"

# publish a single-file page
curl -s -X POST https://deploy.dgtl.ltd/api/deploy \
  -H "x-deploy-token: $TOKEN" -H 'content-type: application/json' \
  -d "{\"target\":\"audit\",\"slug\":\"acme-corp\",\"html\":$(python3 -c 'import json,sys;print(json.dumps(open(sys.argv[1]).read()))' page.html)}"

# publish a project zip (index.html at the root, or inside one wrapping folder)
curl -s -X POST "https://deploy.dgtl.ltd/api/deploy-zip?target=pitch-ltd&slug=acme-corp" \
  -H "x-deploy-token: $TOKEN" --data-binary @project.zip

# list / delete
curl -s "https://deploy.dgtl.ltd/api/sites?target=audit" -H "x-deploy-token: $TOKEN"
curl -s -X DELETE "https://deploy.dgtl.ltd/api/sites/acme-corp?target=audit" -H "x-deploy-token: $TOKEN"
```

Add `&spa=1` (or ship a `_redirects` containing `/* /index.html 200`) for client-side
routing. Zips are capped at `MAX_ZIP_BYTES` (150 MB default); single-file HTML at 12 MB.

**Back-compat:** `/api/decks` is an alias for `/api/sites`, so callers written against
the old `deploy.dgtlmag.com` portal keep working. Note that such a caller omitting
`target` now lands on `pitch-ltd`, not `pitch.dgtlmag.com` — pass `target=pitch-mag`
explicitly if you mean the legacy host.

## Run it locally

```bash
mkdir -p /tmp/pub/{pitch-ltd,pitch-mag,reports,audits,gallery,pics,mov}
# point a copy of targets.json at those dirs, then:
DEPLOY_TOKEN=test PORT=8099 TARGETS_FILE=/tmp/targets.local.json node server.js
```

Zero npm dependencies — Node stdlib only. `brand.js` holds the inlined DGTL marks.

## The token

One `DEPLOY_TOKEN` for every destination, set in `.env` beside `docker-compose.yml`.
The portal **refuses to boot** if it is unset, a known placeholder (`CHANGE_ME` and
friends), or under 24 characters — `docker logs dgtl-publish` says which. Compose's
`${DEPLOY_TOKEN:?...}` only proves the variable is *set*, so without this check the
container starts happily on the template's published `CHANGE_ME` and the portal is
open to anyone who has read the repo.

`--force-recreate` on redeploy: a plain `up -d` sees no image or config change and can
leave the old container running with the old environment.

To check what the running container actually has, without printing the secret:

```bash
docker exec dgtl-publish sh -c 'printf "%s" "$DEPLOY_TOKEN" | wc -c; printf "%s" "$DEPLOY_TOKEN" | md5sum'
```

## Cutover (VPS)

Order matters: the old containers own Traefik routers on the hostnames being reclaimed.

```bash
# 1. content dirs for the new destinations
sudo mkdir -p /opt/dgtl-publish/site/{pitch-ltd,gallery,pics,mov}

# 2. serving host
cd /opt/dgtl/deploy/publish-host && docker compose up -d --build

# 3. retire the old portals (their content hosts — decks, report-host — stay up)
docker rm -f dgtl-deploy dgtl-report-deploy

# 4. the portal, with one freshly minted token
cd /opt/dgtl/deploy/publish-portal
cp /opt/dgtl/deploy/vps/env-templates/publish-portal.env.example .env
openssl rand -hex 32   # paste into .env as DEPLOY_TOKEN — the template ships CHANGE_ME
                       # and the portal refuses to start on it (see below)
docker compose up -d --build --force-recreate
docker exec dgtl-publish sh -c 'printf "%s" "$DEPLOY_TOKEN" | wc -c'   # expect 64

# 5. verify
curl -s https://deploy.dgtl.ltd/health
curl -s https://deploy.dgtl.report/health        # same app, old hostname still works
```

Only after this is green: delete `deploy/portal/` and `deploy/report-portal/` from the
repo, and hand the single new token to whoever holds the old two.
