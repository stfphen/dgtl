# dgtl-journal — the Influence Journal on `dgtlinfluence.com`

Static host for `journal/`, served by nginx in a container and fronted by the **Coolify** proxy
already running on the VPS. Mirrors `deploy/decks/`, with one structural difference: the Journal
serves at the **domain root**, not a subpath.

**Live URL pattern:** `https://dgtlinfluence.com/packs/<slug>/`

> **Do not use `deploy/vps/traefik/`.** Coolify's proxy already owns ports 80/443 on this host, and
> that compose file's own header says not to run it here. This resource attaches to Coolify's
> existing `coolify` network instead.

## Nothing here is applied yet

This folder is **configuration only**. Two things still have to happen by hand, both outside this
repo — see the checklist below.

### 1. DNS (registrar — the user has to do this)

```
A     @      62.72.16.32
A     www    62.72.16.32
```

Same VPS already serving `dgtlmag.com` (per `deploy/LIVE-SETUP-RUNBOOK.md`). Let these propagate
before the first HTTPS hit, or LetsEncrypt's challenge fails and Traefik backs off for a while.

### 2. The Coolify resource (Coolify dashboard or its API)

Either route works:

- **Git deploy (preferred).** New resource → *Docker Compose* → point it at this repo, branch
  `main`, and set the compose file to `deploy/journal/docker-compose.yml`. The build context is
  the repo root (`context: ../..`), which is what lets the image reach `journal/`. Every push then
  redeploys.
- **Paste.** New resource → *Docker Compose* → paste `docker-compose.yml`. Note this only works if
  Coolify also has the repo checked out, since the build needs `journal/` and the Dockerfile.

Then let Traefik issue the cert on the first HTTPS request.

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
