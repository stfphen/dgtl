# dgtl-journal — the Influence Journal on `dgtlinfluence.com`

Static host for `journal/`, served by nginx in a container and fronted by the **Coolify** proxy
already running on the VPS. Mirrors `deploy/decks/`, with one structural difference: the Journal
serves at the **domain root**, not a subpath.

**Live URL pattern:** `https://dgtlinfluence.com/packs/<slug>/`

> **Do not use `deploy/vps/traefik/`.** Coolify's proxy already owns ports 80/443 on this host, and
> that compose file's own header says not to run it here. This resource attaches to Coolify's
> existing `coolify` network instead.

## Status: LIVE since 2026-08-01

`https://dgtlinfluence.com/` and `https://www.dgtlinfluence.com/` serve this container, with a
LetsEncrypt cert (`CN=dgtlinfluence.com`, issued 2026-08-01). Deployed by hand on the VPS with
`docker compose up -d --build`; Coolify's proxy picks the container up from the Traefik labels,
so no Coolify dashboard resource was needed.

### DNS (done)

```
A     @      37.27.198.189
A     www    37.27.198.189
```

Same VPS already serving `dgtlmag.com`. DNS is managed at **Hostinger** (nameservers
`ns1/ns2.dns-parking.com`).

> **The IP is `37.27.198.189` (Hetzner), not the `62.72.16.32` you will find in
> `deploy/LIVE-SETUP-RUNBOOK.md` and `DGTL-Domain-and-Deploy-Blueprint.md`.** Those describe the
> retired Hostinger box, offboarded 2026-07-21. `deploy/vps/README-VPS-DEPLOY.md` is the current
> runbook. Confirm with `dig +short dgtlmag.com A` before pointing anything.

Let DNS propagate before the first HTTPS hit, or LetsEncrypt's challenge fails and Traefik backs
off for a while. If a domain was previously parked, its old record can sit in resolver caches for
hours after you change it — check against the authority (`dig +short @ns1.dns-parking.com <domain>`)
rather than your own resolver before concluding something is broken.

### Deploy / redeploy

No Coolify dashboard resource is required — its proxy routes by container label, the same way
`deploy/decks/` is brought up in `deploy/vps/README-VPS-DEPLOY.md` §5:

```bash
ssh root@37.27.198.189
cd /opt/dgtl && git checkout main && git pull
cd deploy/journal && docker compose up -d --build
```

The build context is the repo root (`context: ../..`), which is why this runs from
`/opt/dgtl/deploy/journal` and not from a copy of this folder on its own.

One-liner from the Mac:

```bash
ssh root@37.27.198.189 'cd /opt/dgtl && git pull && cd deploy/journal && docker compose up -d --build'
```

**Optional — auto-deploy on push.** New Coolify resource → *Docker Compose* → this repo, branch
`main`, compose file `deploy/journal/docker-compose.yml`. Run `docker compose down` on the manual
container first, or both will claim the `dgtlinfluence.com` router.

**Rollback** (removes only the Journal; platform, decks and the proxy are untouched):

```bash
ssh root@37.27.198.189 'cd /opt/dgtl/deploy/journal && docker compose down'
```

## Build context — the one thing that trips people up

`journal/` lives at the repo root, and Docker cannot `COPY` from outside its build context. So the
context is the **repo root** and the Dockerfile is referenced by path:

```yaml
build:
  context: ../..
  dockerfile: deploy/journal/Dockerfile
```

Building by hand therefore also happens from the repo root:

```bash
docker build -f deploy/journal/Dockerfile -t dgtl-journal .
```

`Dockerfile.dockerignore` trims that root context down to `journal/` plus the two files this image
copies, so the build doesn't stream `platform/`, `brain/` and `sites/` to the daemon.

## Verify after deploy

```bash
curl -I http://127.0.0.1:8091/                      # on the VPS — expect 200
curl -I http://127.0.0.1:8091/packs/casper/         # expect 200
curl -I http://127.0.0.1:8091/nope/                 # expect 404 (branded)
curl -sI https://dgtlinfluence.com/ | grep -i -E 'x-content-type|referrer|x-frame'
```

The last one should show all three headers — `journal/_headers` is Netlify syntax that nginx does
not read, so `nginx.conf` reapplies those rules (plus `X-Frame-Options`) itself.

## Layout

| Path | What |
|---|---|
| `Dockerfile` | nginx:alpine + `journal/` as the web root |
| `Dockerfile.dockerignore` | trims the repo-root build context |
| `nginx.conf` | root serve, clean URLs, asset caching, security headers, branded 404 |
| `docker-compose.yml` | container + Traefik labels on the `coolify` network |
| `404.html` | branded 404 (a deploy artifact, so it lives here, not in `journal/`) |

## Known followup — canonical URLs

Pages that were already built for the old scheme still carry
`https://pitch.dgtlmedia.io/journal/creators/<slug>/` canonical and `og:url` values, and the older
`pack.json` files have empty `canonicalUrl`. Only `packs/casper/` points at `dgtlinfluence.com`.

Rewriting the rest is a **deliberate, separate decision** — Shane Boyer's pages may already be
indexed under the old URLs, and a blanket find-and-replace would change what Google has. Do that as
its own PR, with redirects from the old paths, once the domain is actually serving.
