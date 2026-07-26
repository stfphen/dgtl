# DGTL — Domain Tree & Self-Hosted Deploy Blueprint

*Author: setup session 2026-07-12 · VPS `62.72.16.32` (Hostinger, Ubuntu + Docker + Traefik)*

This is the plan for (1) a clean domain/subdomain tree across your brands, (2) how the sales
funnel connects end-to-end, and (3) a Netlify-replacement deploy system that lets you throw up
pitch decks on your own domain and edit/redeploy them with one command — all on the VPS you
already run.

> **Launch note (2026-07-12):** decks launch on **`pitch.dgtlmedia.io/{client}`**. Reason:
> `dgtlgroup.io`'s DNS is on Cloudflare (and its apex serves a live site), whereas `dgtlmedia.io`'s
> DNS is managed at Hostinger where we have direct access — so we ship on its subdomain now, the
> apex redirect untouched, zero risk. To brand decks under the hub later, add
> `CNAME pitch.dgtlgroup.io -> pitch.dgtlmedia.io` (DNS-only) in Cloudflare plus a matching
> `Host(pitch.dgtlgroup.io)` router — same container, no rebuild.

---

## 0. The one decision that shapes everything

Your live app (`dgtlmag.com`) is already fronted by a **hand-managed Traefik** on ports 80/443,
on the `traefik-public` Docker network, issuing LetsEncrypt certs (resolver name `letsencrypt`,
entrypoint `websecure`). **Coolify ships its own proxy that also wants 80/443.** You cannot point
two proxies at the same ports. So there are two ways to adopt Coolify, and the order matters
because one path touches your revenue app and one doesn't:

**Recommended sequencing (two phases):**

- **Phase 1 — Decks live tonight, zero risk.** Reuse the Traefik you already have. Pitch decks
  deploy as a tiny static container joined to `traefik-public` with routing labels for
  `dgtlgroup.io/pitch/{client}`. Nothing about the live app changes. This alone replaces Netlify
  for decks and is what the `decks/` folder in this bundle is ready to do.
- **Phase 2 — Coolify as the control plane, on a maintenance window.** Install Coolify to get
  git-push auto-deploys for *all* apps (including the funnel app, replacing the tar/scp dance).
  Because of the port conflict, you either (a) let Coolify take over 80/443 and migrate the app +
  Postgres + decks under it, or (b) keep the existing Traefik as edge and set Coolify's proxy to
  alt ports 5080/5443 as a build-only backend. (a) is cleaner long-term; do it in a window with a
  DB backup and a tested rollback.

You picked Coolify, and it's still the right long-term control plane — this just protects the
live app by not letting Coolify fight the existing proxy on night one. If you'd rather compress
to "Coolify owns everything now," say so and the runbook switches to the migration path.

---

## 1. Domain & subdomain tree

Principle: **one canonical brand hub, everything else hangs off it or redirects into it.**
`dgtlgroup.io` is the hub. Brand domains stay as recognizable front doors; apps and ops live on
subdomains so you never need new DNS to ship a feature.

### Tier 1 — Brand hub: `dgtlgroup.io`
| Host / path | Serves | Notes |
|---|---|---|
| `dgtlgroup.io`, `www` | Main marketing / agency site | canonical |
| `dgtlgroup.io/pitch/{client}` | **Pitch decks** (your chosen scheme) | static, git-deployed |
| `dgtlgroup.io/pitch` | Deck gallery (internal index) | protect or noindex |

### Tier 2 — Product / app subdomains (all A → `62.72.16.32`, Traefik-routed)
| Host | Serves | Why separate |
|---|---|---|
| `app.dgtlgroup.io` | The funnel + admin app | canonical app host (today it's `dgtlmag.com`) |
| `api.dgtlgroup.io` | Webhooks / API (Stripe, Twilio) | stable endpoint independent of app host |
| `*.dgtlgroup.io` (wildcard) | Tenant funnels | new client funnel = **no new DNS** (`getTenantForHost` maps host→tenant) |

### Tier 3 — Brand / vertical domains
| Domain | Recommended role |
|---|---|
| `dgtlmag.com` | Content / magazine brand **and** current app host — keep, or move app to `app.dgtlgroup.io` and make mag the content front |
| `dgtlmedia.io` | Media vertical → 301 to `dgtlgroup.io/media` or its own lander |
| `dgtlinfluence.com` | Influencer vertical → 301 to `dgtlgroup.io/influence` or its own lander |

### Tier 4 — Ops / infra subdomains (protected: auth + IP allowlist)
| Host | Serves |
|---|---|
| `deploy.dgtlgroup.io` | Coolify dashboard (Phase 2) |
| `status.dgtlgroup.io` | Uptime page (Uptime Kuma, optional) |
| `traefik.dgtlgroup.io` | Traefik dashboard (optional) |

### DNS records to add at Hostinger (for `dgtlgroup.io`)
```
A     @         62.72.16.32
A     www       62.72.16.32
A     app       62.72.16.32
A     api       62.72.16.32
A     *         62.72.16.32     # wildcard → tenant funnels, no DNS per client
A     deploy    62.72.16.32     # Phase 2 (Coolify)
A     status    62.72.16.32     # optional
```
TLS: Traefik issues a per-hostname LetsEncrypt cert on first request via HTTP-01 — the wildcard
**DNS** record works immediately without a wildcard cert. If you later want a single `*.dgtlgroup.io`
cert, switch that host to a DNS-01 challenge (needs a DNS API token). Existing `dgtlmag.com`
records (incl. `funding`/`grants`) stay as they are.

---

## 2. How the funnel connects (the system, not just the pages)

The decks aren't a side project — they're the **top of the funnel**, and the point is to wire
them into the machine you already built:

```
 Prospect ──▶ dgtlgroup.io/pitch/{their-company}   (tailored deck, on your domain)
                     │  CTA button
                     ▼
        app.dgtlgroup.io  →  checkout / booking     (?tenant=…&utm=pitch-{client})
                     │
                     ▼
        Lead pipeline → enrichment → outreach / telephony / funding review
                     │
                     ▼
              tenant-scoped, permissioned, audit-logged  (existing app)
```

Two concrete hooks that turn decks into pipeline:
1. **Every deck's CTA** links to `app.dgtlgroup.io/checkout` (or booking) with
   `?utm_source=pitch&utm_campaign={client}` so a deck view that converts is attributable.
2. **Deck slug = client slug.** Name the folder after the prospect (`/pitch/acme-corp`) and reuse
   that slug as the tenant/UTM tag, so the deck, the funnel, and the CRM record all line up.

---

## 3. The deck deploy system (Netlify replacement)

One Git repo, `dgtl-decks`, is the whole system. It mirrors your app's existing "GitHub is the
source of truth" pattern, so it behaves exactly like `deploy.sh` you already trust.

**Repo shape** (scaffolded in `decks/` in this bundle):
```
dgtl-decks/
  site/pitch/index.html            # gallery of all decks (internal)
  site/pitch/{client}/index.html   # one folder per deck  → dgtlgroup.io/pitch/{client}
  templates/deck-template/         # starting point for new decks
  Dockerfile                       # nginx:alpine, serves site/ as web root
  nginx.conf                       # clean URLs, per-deck index, 404
  docker-compose.yml               # 'dgtl-decks' on traefik-public + routing labels
  deploy.sh                        # VPS: git pull + rebuild (mirrors app deploy.sh)
  scripts/new-deck.sh              # scaffold a new deck folder
  scripts/preview.sh               # local preview at localhost:8080/pitch/
  scripts/build-index.sh           # regenerate the gallery from folders
```

**The workflow you wanted:**

*Make a deck:*
```bash
./scripts/new-deck.sh acme-corp        # creates site/pitch/acme-corp/ from template
# (or) drop a deck built by the dgtl-pitch-pages skill into site/pitch/acme-corp/index.html
./scripts/preview.sh                    # eyeball it at http://localhost:8080/pitch/acme-corp/
```
*Ship it (Phase 1 — one command, ~30s to live):*
```bash
git add . && git commit -m "deck: acme-corp" && git push
ssh root@62.72.16.32 'cd /opt/dgtl-decks && ./deploy.sh'
# live at https://dgtlgroup.io/pitch/acme-corp/
```
*Edit later:* change the file, `git push`, run `deploy.sh` again. Same as Netlify's redeploy,
on your own domain.

*Phase 2 (Coolify):* connect the `dgtl-decks` GitHub repo once; every `git push` auto-builds and
deploys — no SSH step at all. True git-push-to-live.

**Why a container and not just files:** it's identical infra to your app (Traefik + Docker),
so certs, HTTPS, and routing "just work" with the labels you already use, and it drops straight
into Coolify in Phase 2 with no rewrite.

---

## 4. Deck routing labels (drop-in, matches your app exactly)

The `decks/docker-compose.yml` uses your real conventions — network `traefik-public`, entrypoint
`websecure`, certresolver `letsencrypt` — on a dedicated subdomain so the live apex is never
touched:

```yaml
labels:
  traefik.enable: "true"
  traefik.docker.network: "traefik-public"
  traefik.http.routers.dgtl-decks.rule: "Host(`pitch.dgtlmedia.io`)"
  traefik.http.routers.dgtl-decks.entrypoints: "websecure"
  traefik.http.routers.dgtl-decks.tls.certresolver: "letsencrypt"
  traefik.http.services.dgtl-decks.loadbalancer.server.port: "80"
```

---

## 5. Live setup runbook (execute in this order)

See `LIVE-SETUP-RUNBOOK.md` for the exact copy-paste commands. Summary:

1. **DNS** — add `dgtlgroup.io` A records (Tier 1/2 above). `dig +short dgtlgroup.io` → `62.72.16.32`.
2. **Push the decks repo** — create GitHub repo `dgtl-decks`, push this `decks/` folder.
3. **First deploy on VPS** — `git clone` to `/opt/dgtl-decks`, `docker compose up -d --build`.
   Verify: `curl -I https://dgtlgroup.io/pitch/sample-client/` → `200`.
4. **(Phase 2, later, in a window)** — install Coolify, migrate app + decks under it for git-push
   auto-deploy.

**Rollback for Phase 1:** decks are a standalone container on a path — `docker compose down` on
`dgtl-decks` removes only the decks; the live app is untouched the entire time.

---

## 6. Open choices for you
- Keep the app on `dgtlmag.com`, or move it to `app.dgtlgroup.io` (recommended for a clean split
  between "content brand" and "product")?
- Phase 2 Coolify: take over 80/443 (clean) vs. run on alt ports behind existing Traefik (safest)?
- Deck gallery at `/pitch`: leave public, `noindex`, or password-protect via Traefik basic-auth?
```
