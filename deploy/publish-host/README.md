# DGTL Publish Host

One nginx container serving the publish destinations that live on new hostnames:

| Hostname | Root | Destination key |
|---|---|---|
| `pitch.dgtl.ltd/<slug>/` | `/data/pitch-ltd` | `pitch-ltd` |
| `shoots.dgtl.gallery/<slug>/` | `/data/gallery` | `gallery` |
| `sets.dgtl.pics/<slug>/` | `/data/pics` | `pics` |
| `watch.dgtl.mov/<slug>/` | `/data/mov` | `mov` |

Content is written by [`../publish-portal`](../publish-portal) and mounted here
read-only, the same split `report-host` uses.

**Subdomains, not apexes, on purpose.** `dgtl.gallery` and `dgtl.pics` serve their own
placeholder sites on Hostinger (`2.57.91.91`) and `dgtl.mov` serves a live site on this
VPS. Repointing those apexes would have taken three live sites offline.

Every host is **private by URL**: the apex serves the baked-in branded placeholder, the
`robots.txt` disallows all, and every response carries
`X-Robots-Tag: noindex, nofollow`. Published slugs are never listed. The one destination
that *does* publish an index of its slugs is `pitch.dgtlmag.com`, served by the older
[`../decks`](../decks) container.

```bash
sudo mkdir -p /opt/dgtl-publish/site/{pitch-ltd,gallery,pics,mov}
docker compose up -d --build
docker ps --format '{{.Names}}\t{{.Status}}' | grep publish-host    # confirm it STARTED
curl -sI http://127.0.0.1:8096/ -H 'Host: pitch.dgtl.ltd'
```

**Start this container before the portal, and check it actually started.** The portal
boots fine without it — it only needs the content directories to exist — so a
publish-host that failed to start looks like a healthy deploy right up until a page is
requested, at which point Traefik has no router for the hostname and answers on its
default self-signed cert.

The `127.0.0.1:8096` mapping is a **debug convenience only**; Traefik reaches this
container over the coolify network. On a port conflict, change it and move on:

```bash
PUBLISH_HOST_PORT=8097 docker compose up -d
```

It was 8093 originally, which `dgtl-clipvault` already held — the container failed to
start while `curl` against 8093 answered 200 from clipvault, i.e. the debug port
reported healthy for a container that was not running. Check with `ss -ltnp | grep
<port>` before picking one, and trust `docker ps` over a curl to localhost.

Adding a hostname: a `map` line in `nginx.conf`, a `Host()` in `docker-compose.yml`, a
volume in both this compose and the portal's, an entry in
`../publish-portal/targets.json`, and an A record → `37.27.198.189`.
