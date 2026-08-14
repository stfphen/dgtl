# dgtl-report-host

Static nginx host for DGTL client reporting. Sibling of `../decks/` (pitch.dgtlmag.com), but
serving **two hostnames from one container** via an nginx `map` on `$host`:

| Host | Web root | Content |
|---|---|---|
| `dgtl.report` (+ `www`) | `/data/reports` | engagement status reports |
| `audit.dgtl.report` | `/data/audits` | client audit pages |

**Privacy model (decision 2026-08-10):** report URLs are private-by-URL. The apex (`/`) of both
hosts serves the baked-in `html/placeholder.html` — no directory of client slugs is ever exposed.
`robots.txt` disallows everything and every response carries `X-Robots-Tag: noindex, nofollow`.

Content is **not** in the image: `/opt/dgtl-report/site/{reports,audits}` on the VPS is
volume-mounted read-only. `../report-portal/` (deploy.dgtl.report) is the only writer.

Branded 404 at `html/404.html` catches slug typos.

## Run on the VPS

```bash
mkdir -p /opt/dgtl-report/site/{reports,audits}
cd /opt/dgtl/deploy/report-host && docker compose up -d --build
curl -H 'Host: dgtl.report' http://127.0.0.1:8092/          # placeholder
curl -H 'Host: audit.dgtl.report' http://127.0.0.1:8092/x/  # branded 404
```
