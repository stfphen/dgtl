# DGTL Artifact worker and staging runbook

Date: 2026-08-14
Status: local/test ready; production generation and deployment disabled

## Safety contract

- Core web routes never run Git, shell, skill, SSH, or deploy commands.
- A worker token is scoped to one server-configured team and worker identity.
- A job carries an immutable context snapshot, adapter identity/version, source commit, slug, and
  allowed path policy.
- Work executes in a temporary detached Git worktree. Never use the production checkout.
- Only a validated result may enter human review; only owner/admin approval creates an Artifact.
- Deployment is a second approval and claim. Unknown outcomes stop for review.
- `pitch.local-preview` is the only enabled deployment adapter.
- No commercial email is part of this worker.

## Configuration

Set these only in the Core server/worker secret store, never in the browser or repository:

```text
CORE_GENERATION_WORKER_TOKEN=<long random service token>
CORE_GENERATION_WORKER_TEAM_ID=<one team id>
CORE_GENERATION_WORKER_ID=<stable worker identity>
DGTL_SOURCE_COMMIT=<deployed repository commit>
CORE_ARTIFACT_PREVIEW_ROOT=<worker/Core shared staging preview volume>
```

The preview root defaults to an operating-system temporary directory for local acceptance. Use a
private shared volume with retention cleanup in staging; it is not an Artifact binary store and is
not a public static directory. Do not configure deploy-portal credentials for the local acceptance worker. Production pitch/report
adapters remain `disabled` in the registry and require a separate code/release review to enable.

## Scoped worker protocol

All requests use `Authorization: Bearer <CORE_GENERATION_WORKER_TOKEN>`.

1. `POST /api/core/generation-worker/jobs/claim`
2. `POST /api/core/generation-worker/jobs/<id>/heartbeat`
3. execute the registered skill at the job's recorded source commit in an isolated worktree;
4. submit either `POST .../<id>/result` or `POST .../<id>/fail`;
5. after owner/admin approval and a deployment request, claim via
   `POST /api/core/generation-worker/deployments/claim`;
6. submit the verified result to `POST .../deployments/<id>/result`.

The service resolves team and worker from environment, not headers or JSON. Lease durations are
bounded. An expired pre-result generation/deployment lease can be reclaimed. A deployment whose
remote outcome is unknown must be reported as `outcome: "unknown"`; it is quarantined and cannot be
blindly claimed again.

## Local release rehearsal

Use only a disposable localhost PostgreSQL database:

```bash
cd platform
CORE_MIGRATION_REHEARSAL_CONFIRM=isolated DATABASE_URL=postgres://.../postgres npm run validate:migrations
DATABASE_URL=postgres://.../dgtl_stage3 npm run migrate
STAGE3_REHEARSAL_CONFIRM=isolated DATABASE_URL=postgres://.../dgtl_stage3 npm run rehearse:stage3
node --test tests/stage3-artifact-automation.test.js
npm test
npm run build
```

`rehearse:stage3` refuses non-localhost databases and requires the explicit `isolated` confirmation.
It creates real temporary Git worktrees, uses the registered `dgtl-pitch-pages` template, writes a
manifest/registry entry, runs the repository link gate, commits candidates only inside those
worktrees, creates v1/v2 Artifact records, test-deploys to `preview.invalid`, and pins a test Message
to v1. It cleans the worktrees afterward.

## Staging checklist

1. Restore a current sanitized production-shaped snapshot into isolated PostgreSQL 16.
2. Record legacy/canonical counts and apply 009–012 under the migration advisory lock.
3. Validate all deferred `*_team_fkey` constraints and reconcile any historical violation.
4. Deploy the Core application with `pitch.local-preview` only.
5. Run one non-production Opportunity through brief approval, worker claim, generation, validation,
   sandboxed preview, Artifact approval, local preview deployment, and test Message attachment.
6. Kill the worker after claim and prove lease recovery. Submit an unknown deployment fixture and
   prove it remains quarantined.
7. Confirm production pitch/report adapters remain disabled and no deploy token exists in the web
   process.
8. Confirm no real email transport or prospect address is used.

## Future production deployment adapter gate

Before enabling `pitch.portal` or `report.portal`:

- implement the narrow token-auth HTTP call in the separate worker, not Core;
- use target-specific secrets and least-privilege egress;
- require owner/admin deployment approval tied to Artifact checksum and target;
- preserve the idempotency key across retries;
- verify the served URL, artifact checksum/version marker, hostname, and tenant before success;
- treat network loss after upload as unknown, inspect the remote target, and never retry blindly;
- record the provider reference/URL and emit Activity;
- exercise deployment and retirement on staging fixtures before any prospect content.

No DNS, live data, production asset, or external email operation is authorized by this runbook.
