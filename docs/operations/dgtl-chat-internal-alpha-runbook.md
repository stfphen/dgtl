# dgtl.chat Internal Alpha — production runbook (Stage 6.5)

Status: prepared. Every step that requires the production VPS, the registrar, or a live
credential is marked **[VPS]**, **[DNS]**, or **[SECRET]** — those are the external steps this
runbook exists to make exact. Nothing in this document contains a secret value.

## Architecture (the actual deployed topology)

```
dgtl.chat ── DNS A ──► 37.27.198.189 (Hetzner VPS "DGTLapps")
                             │  Coolify edge (coolify-proxy / Traefik, Let's Encrypt)
                             ▼
              content-checkout-funnel container (Next.js 15 standalone, port 3000)
                             │            /opt/content-checkout-funnel  (compose + .env)
                             ▼
              content-funnel-postgres container (postgres:17-alpine,
              internal-only docker network, volume content-funnel-postgres-data)
```

- `dgtlmag.com`/`www` already route to this container and keep serving the tenant funnel.
- `dgtl.chat` is routed by the new `dgtlchat` Traefik router labels to the **same container**;
  the root page host-resolves, no tenant claims `dgtl.chat`, so it lands on `/home` → login.
  This is regression-pinned by `platform/tests/stage6-5-internal-alpha.test.js`.
- One Node process per container → the Stage 6 in-process chat rate limit (10 turns/user/min)
  is a real guarantee in this topology. Scaling to multiple replicas invalidates it — that is a
  Stage 7 concern (shared limiter), not an alpha concern.

## Deployment matrix (audited 2026-08-15)

| Target | Compatible | Persistent Node | Env secrets | PostgreSQL | Worker support | Recommended |
|---|---|---|---|---|---|---|
| VPS Docker/Coolify stack (existing production) | yes | yes (container, `restart: unless-stopped`) | yes (`/opt/content-checkout-funnel/.env`, never in Git) | yes (postgres:17 container + volume) | yes (`docker compose run` one-shots + host cron) | **yes** |
| Hostinger Node slot | no evidence of platform support; only the PHP creator-intake runs on shared hosting | n/a | n/a | no managed PG documented | no | no |
| Static deploy stacks (`deploy/journal`, `deploy/report-*`) | no — nginx file servers | no | n/a | no | no | no |

## Current production reality (why this is a promotion, not a restart)

Production (`/opt/content-checkout-funnel`) last deployed `main@32c9f73` (2026-07-04) — before
DGTL Core Stages 1–6. Promoting to `main@239587e` therefore applies migrations **009–014** to the
production database. That is exactly why the fresh-backup gate below is hard.

## 0. Hard gates (in order — do not reorder)

1. Stage 6 merged (`main@239587e`), remote `Required DGTL Core checkpoint` green — verified 2026-08-15.
2. Ops fixes merged to `main` via the `ops/dgtl-chat-internal-alpha` PR (compose env passthrough
   + dgtl.chat router + healthcheck + release identity + security headers).
3. **[VPS] Fresh production backup** — `scripts/backup-db.sh` at `/opt/content-checkout-funnel`;
   record the timestamped filename under `backups/`; verify non-empty (`pg_restore --list`).
4. **[VPS] Isolated restore rehearsal** — restore that dump into a disposable database (never the
   live one), then from the new checkout run `npm run migrate` against the restore, run it a
   second time (repeat stability), and run the integrity queries in §7. Only a green rehearsal
   makes migrations 009–014 promotion-safe on real data.
5. Rollback prerequisites recorded (§9) — previous commit (`32c9f73` or whatever
   `git -C /opt/content-checkout-funnel rev-parse HEAD` reports), backup filename, DNS values.

## 1. DNS — audited state and cutover plan

Audited 2026-08-15 (from repo tooling; registrar UI must confirm authoritative records):

| Record | Current value | Intended value | Rollback |
|---|---|---|---|
| `dgtl.chat` A | `2.57.91.91` (registrar parking — consistent with Hostinger dns-parking) | `37.27.198.189` | `2.57.91.91` |
| `www.dgtl.chat` A | `2.57.91.91` (parking) | leave as-is for the alpha (no www requirement) | unchanged |
| MX / TXT / other | none observed for dgtl.chat; **verify in registrar UI** | untouched | untouched |

**[DNS]** Change ONLY the apex A record. Do not touch dgtlmag.com, funding./grants. subdomains,
MX/SPF/DKIM/DMARC anywhere, or any other zone. Note the TTL shown before changing (parking
records are often 300–3600 s); a low TTL shortens both cutover and rollback.

Cut over **after** §5 shows the container healthy, because Traefik can only complete the
Let's Encrypt HTTP-01 challenge for dgtl.chat once DNS points at the VPS — expect the cert to
issue on first request after propagation; verify with §6.

## 2. Environment — exact variable inventory (names only)

Server-only, lives in `/opt/content-checkout-funnel/.env` (preserved across deploys; **diff, never
clobber**). Classification: R = required for the alpha, O = optional, I = intentionally unset,
S = secret.

| Variable | Class | Alpha value policy |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | R,S | existing production values, unchanged |
| `PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_URL` | R | `https://dgtlmag.com` at the time of this runbook. **Superseded:** these move to `https://os.dgtl.ltd` — see `os-dgtl-ltd-migration-runbook.md`, which keeps dgtlmag.com serving `/api/*` so already-sent unsubscribe links survive. |
| `OWNER_EMAIL` / `OWNER_NAME` / `TEAM_NAME` / `TEAM_SLUG` | R | existing; `TEAM_SLUG=default` (owner joins `team_default`) |
| `CORE_EMAIL_TRANSPORT` | R | `test` — **production email disabled intentionally** |
| `CORE_PRODUCTION_SEND_ENABLED` | R | `false`; and leave `CORE_PRODUCTION_SEND_RELEASE_ID`, `CORE_PRODUCTION_SEND_AUTHORIZATION`, `CORE_RATE_POLICY_APPROVED` empty (I) — all four gates must stay closed |
| `OUTREACH_DRY_RUN`, `OUTREACH_CRON_TOKEN`, `UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET` | O,S | existing values; sending stays gated regardless |
| `CORE_WORKER_TEAM_ID`, `CORE_WORKER_ID`, `CORE_PROVIDER_TEAM_ID` | O | set to the real team if the outbox worker cron is enabled; health shows "disabled intentionally" otherwise |
| `RESEND_API_KEY`, `RESEND_FROM` | O,S | may exist; cannot activate sending while the release gates above are closed (verified by Stage 2 tests) |
| `GOOGLE_PLACES_API_KEY`, `HUNTER_API_KEY`, `APOLLO_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY` | O,S | existing enrichment/telephony keys, unchanged |
| `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` | O,S | existing AI backend credentials; chat uses **only** `ANTHROPIC_API_KEY` (API-key path) |
| `TELEPHONY_*`, `TWILIO_*`, `STRIPE_*` | O,S | unchanged |
| `CORE_WORKLOG_BASE_URL` | O | `https://office.dgtl.at` **only** when §4's integration account exists; unset = bridge off (truthful "unconfigured" health) |
| `CORE_WORKLOG_EMAIL` / `CORE_WORKLOG_PASSWORD` | O,S | the dedicated integration account (§4) — never a personal login |
| `CORE_WORKLOG_TEAM_ID` | O | the one Core team the connector serves (`team_default` unless decided otherwise) |
| `CORE_CHAT_PROVIDER` | O | `anthropic` when `ANTHROPIC_API_KEY` is present and the read-only smoke (§8) is intended; unset otherwise → /chat shows its bounded unavailable state and everything else works |
| `CORE_CHAT_MODEL` | O | unset (defaults to `claude-sonnet-5`) |
| `CORE_GENERATION_WORKER_TOKEN` / `_TEAM_ID` / `_ID` | I,S | leave unset for the alpha → GenerationJobs queue truthfully with no worker (Alpha mode A); configuring a persistent worker is a separate, deliberate step per `dgtl-artifact-worker-runbook.md` |
| `CORE_RELEASE_SHA` | R | set to the deployed Git SHA at each deploy (e.g. `git rev-parse --short HEAD`); surfaced by authenticated `/api/core/health` |

## 3. Alpha capability policy (what this configuration yields)

Enabled: HOME, Core CRM, imports, campaigns (draft/approve), search/⌘K, DGTL.chat READ +
proposals + confirmation boundary, Message draft creation, GenerationJob requests (queued),
Worklog read-through + handoff preparation (once §4 done), native approval flows.
Disabled: commercial email (transport `test` + four closed gates), autonomous send, production
Artifact deployment (only `pitch.local-preview` adapter exists), autonomous Worklog execution
(draft operations still need owner/admin approval + execute), any shell/SQL/HTTP tool (never
existed). Anonymous access: blocked by session auth on every core surface.

## 4. Worklog integration account **[SECRET]**

Stage 4 expects a dedicated identity, admin role (project creation requires it), on
`office.dgtl.at`. Manual step (Worklog has no self-serve API for this): an existing Worklog admin
creates e.g. `core-bridge@dgtl.at` with a strong unique password, then set the four
`CORE_WORKLOG_*` values in `.env` and `docker compose up -d` to reload. Worklog revokes sessions
on password change — rotate the env in the same step. First smoke is read-only: connector health
on `/operations/worklog`, client/project lookups, digest. No writes; project/task creation stays
behind the normal draft → approve → execute chain.

## 5. Deploy sequence **[VPS]**

```bash
cd /opt/content-checkout-funnel
git fetch origin main && git log --oneline -1 origin/main    # expect the post-ops-merge SHA
scripts/backup-db.sh                                          # hard gate §0.3
# §0.4 isolated restore rehearsal happens BEFORE this point, on a disposable DB
git merge --ff-only origin/main
diff <(git show HEAD:platform/docker-compose.yml) platform/docker-compose.yml || true  # sanity
# update .env: add CORE_RELEASE_SHA=$(git rev-parse --short HEAD) and any §2 additions; NEVER overwrite existing secrets
cd platform
docker compose config                                         # env interpolation sanity
docker compose build content-funnel
docker compose up -d content-funnel-postgres
docker compose run --rm --no-deps content-funnel npm run migrate   # applies 009-014, advisory-locked, per-file transactions
docker compose up -d content-funnel
curl -I http://127.0.0.1:8088/admin/login                     # 200 before any DNS change
docker inspect content-checkout-funnel --format '{{.State.Health.Status}}'   # healthy
docker compose logs content-funnel --tail=50                  # no boot errors
# app-host sanity BEFORE cutover:
curl -sI -H "Host: dgtl.chat" http://127.0.0.1:8088/ | head -3          # 307/308 → /home
curl -sI -H "Host: dgtlmag.com" http://127.0.0.1:8088/ | head -3        # 200 tenant funnel
# tenant-claim safety on real data:
docker compose exec content-funnel-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select slug from tenants where domains::text ilike '%dgtl.chat%';"   # MUST return 0 rows
```

Then §1 DNS cutover, then §6.

## 6. Post-cutover verification **[VPS or any external network]**

```bash
curl -I https://dgtl.chat/                 # 200/redirect, valid LE cert, no loop
curl -I http://dgtl.chat/                  # 301/302 → https
curl -sI https://dgtl.chat/home | grep -i location            # anonymous → login redirect
curl -s -o /dev/null -w "%{http_code}" https://dgtl.chat/api/core/search?q=x   # 401
curl -s -o /dev/null -w "%{http_code}" https://dgtl.chat/api/core/chat/threads # 401
curl -sI https://dgtl.chat/ | grep -iE "x-content-type-options|referrer-policy|x-frame-options"
curl -I https://dgtlmag.com/               # unchanged funnel — regression check
```

Authenticated (browser): login → HOME renders real sections truthfully (empty states are
truthful; do not seed fake data) → search a known company → open Company/Opportunity → `/chat`
(unavailable state if provider unset; otherwise §8) → `/api/core/health` shows `release` equal to
the deployed SHA, transport `test`, `productionTransportEnabled: false`. Mobile: repeat login,
HOME, /chat on a phone viewport.

## 7. Production data integrity checks (on the §0.4 restore, and post-migrate spot-check)

Aggregate counts only — no contact details in logs:

```sql
select 'teams', count(*) from teams union all
select 'tenants', count(*) from tenants union all
select 'companies', count(*) from companies union all
select 'contacts', count(*) from contacts union all
select 'opportunities', count(*) from opportunities union all
select 'research', count(*) from research_records union all
select 'campaigns', count(*) from campaigns union all
select 'messages', count(*) from messages union all
select 'artifacts', count(*) from artifacts union all
select 'generation_jobs', count(*) from generation_jobs union all
select 'external_links', count(*) from external_links union all
select 'integration_operations', count(*) from integration_operations union all
select 'legacy_leads', count(*) from leads;
-- cross-team orphan checks (all must be 0):
select count(*) from contacts c left join companies co on co.id=c.company_id where c.company_id is not null and (co.id is null or co.team_id<>c.team_id);
select count(*) from opportunities o left join companies co on co.id=o.company_id where o.company_id is not null and (co.id is null or co.team_id<>o.team_id);
select count(*) from messages m left join contacts c on c.id=m.contact_id where m.contact_id is not null and (c.id is null or c.team_id<>m.team_id);
-- after migrate, migration 011's NOT VALID team FKs should be VALIDATEd on the restore first.
```

## 8. Chat provider smoke (read-only) **[SECRET if key must be added]**

With `CORE_CHAT_PROVIDER=anthropic` and the existing `ANTHROPIC_API_KEY`: as the owner, ask
exactly: "What needs my attention today?", "What is happening with <known real company>?",
"Which opportunities need follow-up?". Verify grounded answers, SourceRef chips resolving to real
routes, tool summary shows only READ tools, DevTools network shows no key material, and nothing
was created (`/campaigns`, `/generation-jobs`, `/operations/worklog` unchanged). One proposal
test afterwards: "Prepare a follow-up for <company>, but don't create anything yet" — card
appears, **do not confirm**. Provider failure isolation was proven in the Stage 6 staging
acceptance (unconfigured server: /chat degraded, HOME/CRM/search fine) — do not re-prove it by
breaking production.

## 9. Rollback

Record at deploy time: previous commit SHA, new SHA, backup filename
(`backups/<db>_<UTC>.dump`), DNS old value (`2.57.91.91`), TTL observed.

- **Application rollback:** `git -C /opt/content-checkout-funnel checkout <previous-sha> &&
  cd platform && docker compose build content-funnel && docker compose up -d content-funnel`.
  Note: the pre-Core build ignores the new tables entirely, so app rollback alone is safe after
  migration — migrations 009–014 are additive.
- **Database rollback:** migrations are **not** designed to be reversed. Restoring means
  `RESTORE_CONFIRM="restore <db>" scripts/restore-db.sh backups/<file>.dump` — this **discards
  everything written after the backup**; it is the disaster path, not the routine path.
- **DNS rollback:** apex A back to `2.57.91.91` (or simply to nothing — the app host going dark
  does not affect dgtlmag.com).
- Rehearsal: the §0.4 isolated restore IS the rollback rehearsal — the same dump, the same
  restore script, proven before anything touched production.

## 10. Operations after launch

- **Where to look when something fails:** `docker compose ps` → app/DB up;
  `docker logs content-checkout-funnel --tail=120` → boot/runtime errors;
  `docker logs coolify-proxy --tail=80` → routing/cert; authenticated `/api/core/health` →
  outbox/exceptions/transport/release; `/operations/worklog` → connector health;
  HOME System Health → per-section truth (disabled-intentionally ≠ error).
- **Backups:** run `scripts/backup-db.sh` before every deploy/migration (existing rule) and add a
  daily cron on the VPS (`0 9 * * * cd /opt/content-checkout-funnel && scripts/backup-db.sh`,
  09:00 UTC ≈ 05:00 Toronto); prune to ~14 days; the §0.4 restore satisfies "a backup that has
  never been restored is not validated".
- **Secret rotation:** DB password (`.env` + `docker compose up -d` both containers — connections
  re-establish), `ANTHROPIC_API_KEY` (rotate at provider, update `.env`, `up -d`),
  `CORE_WORKLOG_PASSWORD` (change in Worklog **and** `.env` in one step — sessions revoke),
  `UNSUBSCRIBE_SECRET`/`OUTREACH_CRON_TOKEN` (regenerate, update `.env`), worker bearer token
  (unset in alpha). Secrets never appear in images — compose interpolates at runtime.
- **Logging:** stdout via `docker logs` (bounded by Docker's default json-file rotation — confirm
  `log-driver` opts on the VPS; add `max-size` if unbounded). Application logs no secrets; the
  Stage 6 provider metadata is operational only.
- **First-week checklist:** daily — HOME attention triage, `/operations/exceptions` empty-or-known,
  `/api/core/health` green + right `release`, backup cron produced a dump; before any approval —
  read the proposal card, confirm only what you mean; never flip the four send gates casually.

## Legacy DGTL OS AI proxy (Stage 6.5 disposition)

`apps/dgtl-os/api/worker.js` (Cloudflare) and `api/llm.js` (Vercel) are legacy demo proxies. As
of this stage both **deny all origins unless `ALLOWED_ORIGINS` is configured** — an unconfigured
deploy can no longer spend the API key for arbitrary sites. No `wrangler.toml` exists in the
repo; whether a copy is live on the Cloudflare account cannot be verified from the repository.
**[SECRET] Manual check:** `wrangler deployments list --name dgtl-os-llm` (or the Cloudflare
dashboard) — if a deploy exists, either delete it or redeploy this hardened version with an
explicit allowlist. Core's `/chat` never touches these proxies in any configuration.
