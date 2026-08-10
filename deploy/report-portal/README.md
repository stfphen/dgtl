# Report deploy portal — deploy.dgtl.report

Token-auth html/zip deploy service for the **client reporting host**. Sibling of
`../portal/` (deploy.dgtlmag.com → pitch.dgtlmag.com), adapted for two targets from one UI/API:

| Target | Publishes to | Content |
|---|---|---|
| `report` (default) | `https://dgtl.report/<slug>/` | engagement status reports (`/dgtl-worklog-status-report`) |
| `audit` | `https://audit.dgtl.report/<slug>/` | client audit briefs/pitch pages (`/dgtl-client-audit`) |

Differences from `../portal/`:

- **No hub index is ever generated.** Client report URLs are private-by-URL; the apex of both
  hosts serves a static branded placeholder baked into `../report-host/` — this portal never
  writes an `index.html` at the content root and never lists slugs publicly.
- API paths are `/api/sites…` with a `?target=report|audit` param (default `report`):
  - `GET /api/sites?target=…` — list deployed slugs for a target (token required)
  - `POST /api/deploy` — JSON `{target, slug, html}` single-page deploy
  - `POST /api/deploy-zip?target=…&slug=…[&spa=1]` — zip body, slug-validated unpack
  - `DELETE /api/sites/<slug>?target=…`
- SPA fallback flagging works as before (`.spa` marker / `_redirects`), though report pages are
  static single files in practice.

Env: `DEPLOY_TOKEN` (required — **new token, do not reuse the dgtlmag one**), `REPORT_DIR`
(default `/data/reports`), `AUDIT_DIR` (default `/data/audits`), `REPORT_BASE`, `AUDIT_BASE`,
`MAX_ZIP_BYTES`, `PORT`. Template: `../vps/env-templates/report-portal.env.example`.

Writes the same dirs that `../report-host/` (nginx) mounts read-only:
`/opt/dgtl-report/site/{reports,audits}` on the VPS.

## Deploy from CLI

```bash
# status report (single html)
curl -sS https://deploy.dgtl.report/api/deploy \
  -H "x-deploy-token: $TOKEN" -H 'content-type: application/json' \
  --data "$(jq -n --arg s acme-corp --rawfile h report.html '{target:"report",slug:$s,html:$h}')"

# audit (zip)
curl -sS "https://deploy.dgtl.report/api/deploy-zip?target=audit&slug=acme-corp" \
  -H "x-deploy-token: $TOKEN" -H 'content-type: application/zip' \
  --data-binary @audit.zip
```
