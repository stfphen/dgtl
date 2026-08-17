# Moving the app's canonical host to os.dgtl.ltd

Status: code prepared, not cut over. The app currently answers on
`dgtlmag.com` (canonical) and `dgtl.chat` (OS alias). This runbook adds
`os.dgtl.ltd` as the canonical host without breaking either.

## Why this is not just a DNS change

`PUBLIC_APP_URL` is the app's identity for links that **leave the process**, and
some of those links are already in other people's inboxes and in other
companies' dashboards:

| Outbound link | Lives in | Consequence of breaking it |
|---|---|---|
| `…/api/unsubscribe?token=…` | delivered email bodies **and** the RFC 8058 `List-Unsubscribe` header Gmail/Outlook render as a one-click button | CASL / CAN-SPAM failure, not a broken link |
| Stripe `success_url` / `cancel_url` | live checkout sessions (~24 h) | buyer lands nowhere after paying |
| Twilio `statusCallback` / `recordingStatusCallback` | registered per call, and in the Twilio console | calls stop logging; recordings and transcriptions silently dropped |
| Resend webhook endpoint | the Resend dashboard | delivery/bounce events stop being recorded |

The design that follows keeps **every one of those URLs working unchanged**, by
never taking `dgtlmag.com` out of service — only demoting it.

## Target end state

```
os.dgtl.ltd     canonical app host       PUBLIC_APP_URL, new outbound links
dgtl.chat       alias, same container    stays as the OS/assistant entry point
dgtlmag.com     /api/* served forever    everything else 301 → os.dgtl.ltd
dgtl.ltd        NOT routed here          free for the corporate placeholder site
*.dgtlmag.com   unchanged                funding./grants./dmtv./elixr. tenant funnels
```

## B0 — prerequisites

1. **Renew `dgtlmag.com`.** `brain/60-Reference/65-Domain-Fleet.md` records it as
   expiring **2026-08-28 with auto-renew OFF**. Every unsubscribe link ever sent
   depends on that domain resolving. Renew multi-year and turn auto-renew on
   before anything below. This is unrelated to the migration and more urgent
   than it.
2. Prove the new host is not tenant-claimed, against the live database:
   ```bash
   docker compose exec content-funnel-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c "select slug from tenants where domains::text ilike '%dgtl.ltd%';"
   ```
   Must return **0 rows**. (Source and built-in tenants are already proven clean
   by `tests/stage6-5-internal-alpha.test.js`; this checks seeded DB rows.)

## B1 — code (already prepared)

Shipped on `ops/os-dgtl-ltd-migration`: `PUBLIC_APP_URL` made overridable in
compose, the `os.dgtl.ltd` Traefik router added (inert without DNS), all admin
redirects made host-preserving, Stripe returns preferring the request origin,
and the guard test widened to the whole admin route family.

## B2 — dual-run (both hosts live)

**[DNS]** Add one record. `os.dgtl.ltd` currently resolves to the parking IP
`2.57.91.91`; record it and the TTL before changing.

```
A   os.dgtl.ltd   37.27.198.189
```

Do **not** touch the `dgtl.ltd` apex, `www`, or anything in the `dgtlmag.com`
zone.

Deploy and verify on the VPS *before* trusting the new host:

```bash
cd /opt/dgtl && git fetch origin main && git merge --ff-only origin/main
cd platform
sed -i "s/^CORE_RELEASE_SHA=.*/CORE_RELEASE_SHA=$(git -C /opt/dgtl rev-parse --short HEAD)/" .env
docker compose build content-funnel && docker compose up -d content-funnel
sleep 35 && docker inspect content-checkout-funnel --format 'health={{.State.Health.Status}}'
# host routing, before DNS has even propagated:
curl -sI -H "Host: os.dgtl.ltd"  http://127.0.0.1:8088/ | head -2   # 307 -> /home
curl -sI -H "Host: dgtl.chat"    http://127.0.0.1:8088/ | head -2   # 307 -> /home
curl -sI -H "Host: dgtlmag.com"  http://127.0.0.1:8088/ | head -2   # 307 -> /home (unchanged)
```

Then externally, once DNS resolves: valid certificate, `http` → `https`,
anonymous `/home` and `/chat` bounce to login, and an authenticated round trip
that **submits an admin form and stays on `os.dgtl.ltd`** — that last one is
what the B1 redirect fix buys.

> Never source `.env` in a shell you later run `docker compose up` from.
> Exported variables outrank the file, silently. (This cost an hour during the
> dgtl.chat cutover.)

## B3 — flip canonical

One `.env` change, then recreate:

```
PUBLIC_APP_URL=https://os.dgtl.ltd
NEXT_PUBLIC_APP_URL=https://os.dgtl.ltd
```

**Deliberately unchanged: `TELEPHONY_WEBHOOK_BASE_URL` stays
`https://dgtlmag.com`.** Twilio HMACs the full callback URL, so this value and
the Twilio console must match byte-for-byte or every inbound webhook fails
signature verification. Because `dgtlmag.com` keeps serving `/api/*` (B4),
leaving both alone is correct and requires no Twilio reconfiguration. The same
reasoning protects the Stripe and Resend webhook endpoints. Moving the webhook
base is a separate, deliberate change.

New unsubscribe links now point at `os.dgtl.ltd`. Old ones keep working — see B4.

## B4 — demote the old host

Traefik on `dgtlmag.com` + `www.dgtlmag.com`:

- `PathPrefix(/api/)` → **serve directly, no redirect.** RFC 8058 one-click
  unsubscribe sends a **POST**, and a 301/302 may be downgraded to GET by
  browsers and mail clients. Serving the path avoids the question entirely, and
  keeps the Stripe/Resend/Twilio endpoints alive at their registered URLs.
- everything else → **301 to `https://os.dgtl.ltd`**, preserving path and query.

The unsubscribe token is an HMAC over `{email, tenantId, teamId}` with no host
component (`platform/lib/outreach/unsubscribe.js`), so old tokens verify
identically wherever they land — no re-signing needed.

Verify with a real signed token:

```bash
curl -i "https://dgtlmag.com/api/unsubscribe?token=<token>"   # 200, not a redirect
curl -sI https://dgtlmag.com/admin | grep -i location          # 301 -> os.dgtl.ltd
```

## Rollback

| Step | Undo |
|---|---|
| B1 | ordinary revert; nothing about live hosts changed |
| B2 | DNS `os.dgtl.ltd` back to `2.57.91.91` |
| B3 | `.env` back to `https://dgtlmag.com`, recreate container |
| B4 | remove the redirect labels |

No migration, no schema change, nothing to unwind in the database.

## After the cutover

`dgtlmag.com` is then only: the tenant funnels on its subdomains, the `/api/*`
compatibility surface, and a redirect. It stays renewed indefinitely because of
the unsubscribe obligation — treat letting it lapse as a compliance incident,
not a cost saving.
