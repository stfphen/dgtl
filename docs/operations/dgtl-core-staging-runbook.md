# DGTL Core staging release runbook

Status: prepared, not deployed. No dedicated platform staging target or staging DNS is defined in
the repository as of 2026-08-14. The production compose file is pinned to `dgtlmag.com` and its
production Postgres volume; it must not be reused as staging.

## Release boundary

Staging must be a separate application container, database, volume, hostname, Resend webhook
secret, and team. It may use the same built image/commit, but no production database connection,
provider credential, queue, or mounted upload directory.

Required safe values:

```dotenv
CORE_EMAIL_TRANSPORT=test
CORE_PRODUCTION_SEND_ENABLED=false
CORE_PRODUCTION_SEND_RELEASE_ID=
CORE_PRODUCTION_SEND_AUTHORIZATION=
CORE_RATE_POLICY_APPROVED=
CORE_WORKER_TEAM_ID=<staging-team-id>
CORE_PROVIDER_TEAM_ID=<staging-team-id>
OUTREACH_DRY_RUN=true
```

The canonical Core worker is one-shot and server-side:

```bash
cd platform
npm run worker:core
```

Schedule that command with the staging platform's process manager or cron. A browser request is
not responsible for draining bulk delivery. In staging the command resolves only the deterministic
test transport and performs no external email call.

## Before creating the environment

1. Obtain explicit authorization for the staging hostname/DNS and hosting resources.
2. Create a distinct Postgres database and persistent volume; never point at production.
3. Create a staging owner/team and set both server-owned Core team IDs to that team.
4. Keep `CORE_EMAIL_TRANSPORT=test`; do not copy production-send gate values.
5. If signed webhook fixtures will be exercised, use a staging-only `RESEND_WEBHOOK_SECRET`.
6. Restrict `/api/core/health` behind the existing admin session; the endpoint is not public.

## Promotion rehearsal

```bash
cd platform
npm ci
CORE_MIGRATION_REHEARSAL_CONFIRM=isolated DATABASE_URL=<localhost-disposable-db> npm run validate:migrations
DATABASE_URL=<staging-db> npm run migrate
STAGE2_REHEARSAL_CONFIRM=isolated DATABASE_URL=<localhost-disposable-db> npm run rehearse:stage2
npm test
npm run build
```

Before applying migrations to a staging copy of production data, take a new dump and prove its
restore into a disposable database. The migration runner serializes migrations with an advisory
lock and wraps each migration file in its own transaction. Migration 011's team-aware foreign keys
are `NOT VALID`: they protect new writes immediately, then should be explicitly validated on the
staging copy after reconciliation.

## Staging smoke path

1. Sign in and open `/companies`, `/contacts`, and `/opportunities`.
2. Upload a representative CSV at `/imports/new`; map, review, and approve it.
3. Create a canonical campaign and cohort, draft/approve messages, and queue them.
4. Run `npm run worker:core`; confirm the test transport records provider IDs.
5. Run it again; confirm no second delivery attempt is created.
6. Exercise a signed Resend fixture against `/api/webhooks/resend`; unsigned/tampered/replayed
   requests must return 400.
7. Confirm `/operations/outbox`, `/operations/exceptions`, and authenticated `/api/core/health`
   show expected state.
8. Confirm `productionTransportEnabled` is `false`.

## Production-send promotion (separate authorization)

Production Resend delivery is impossible from the default configuration. It requires all of:

- `CORE_EMAIL_TRANSPORT=resend`;
- `CORE_PRODUCTION_SEND_ENABLED=true`;
- a non-empty `CORE_PRODUCTION_SEND_RELEASE_ID`;
- `CORE_PRODUCTION_SEND_AUTHORIZATION=DGTL_CORE_PRODUCTION_SEND_AUTHORIZED:<release-id>`;
- `CORE_RATE_POLICY_APPROVED=<release-id>`;
- a configured `RESEND_API_KEY`, verified sender identity, reviewed rate values, signed webhook,
  monitoring, and explicit commercial-send authorization.

Enabling those values, changing DNS, deploying staging/production, or sending a real message is
outside this checkpoint.
