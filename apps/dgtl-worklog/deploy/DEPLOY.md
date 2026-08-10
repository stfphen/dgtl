# Deploying DGTL Worklog

The app is one Node process with no dependencies and a SQLite file. Two supported routes:

- **[Hostinger shared hosting](#hostinger-shared-hosting-nodejs-app)** — the `office.dgtl.at`
  deploy. Uses hPanel's Node.js app support; no server to run.
- **[VPS + systemd + Caddy](#vps--systemd--caddy)** — below. More control, more upkeep.

---

# Hostinger shared hosting (Node.js app)

Hostinger's Node.js app runner offers Node **18, 20, 22 and 24**. This app needs
**22.5+** for the built-in `node:sqlite`, so **pin Node 24** — do not let it auto-detect,
because `engines: >=22.5.0` can resolve to a 22.0–22.4 build that has no `node:sqlite`.

### 1. Point a subdomain at the hosting

In hPanel: **Websites → Add Website → dgtl.at**, then **Subdomains → create `office`**.
DNS is already on Hostinger's nameservers, so the record is created for you.

### 2. Put the database OUTSIDE the deploy directory

This is the one step that, skipped, loses everyone's hours. A redeploy replaces the
application directory — anything inside it goes with it. Create a sibling directory that
deploys never touch and that is **not** under `public_html`:

```
/home/<user>/worklog-data/
```

Then point `DB_PATH` at it (below). Outside `public_html` also means the raw SQLite file
can never be requested over the web.

### 3. Environment

Set these in the Node.js app's environment (hPanel), or upload a `.env` next to
`package.json`. Real environment variables win over `.env`, so either is fine.

```ini
HOST=0.0.0.0
DB_PATH=/home/<user>/worklog-data/worklog.sqlite
APP_TIMEZONE=America/Toronto
SECURE_COOKIES=1     # Hostinger terminates TLS — without this the session cookie is dropped
TRUST_XFF=1          # correct client IPs behind their proxy

# First admin, because shared hosting gives you no shell to run `npm run seed`.
# Only fires when the users table is completely empty; delete after first login.
BOOTSTRAP_ADMIN_EMAIL=you@dgtlgroup.io
BOOTSTRAP_ADMIN_NAME=Your Name
BOOTSTRAP_ADMIN_PASSWORD=<something long>
```

Leave `PORT` unset — the platform assigns one and the app reads it.

### 4. Deploy

Archive the app **without** `node_modules`, `data/` or `.env`, then upload it as a Node.js
application with:

| Setting | Value |
|---|---|
| Node version | **24** |
| Entry file | `server/server.mjs` |
| Start command | `npm start` |
| Build script | *(none — there is no build step)* |
| Root directory | wherever `package.json` lands |

```bash
cd apps/dgtl-worklog
zip -r ../worklog.zip . -x "node_modules/*" "data/*" ".env" "screenshots/*"
```

There are no dependencies, so the install step is a no-op and the build is quick.

### 5. Verify

```bash
curl -si https://office.dgtl.at/api/timer | head -1     # expect 401 — the app is up
curl -sI https://office.dgtl.at/                        # expect 302 → /login.html
```

Then sign in with the bootstrap admin, **change the password in Settings**, and remove the
three `BOOTSTRAP_ADMIN_*` variables.

### Redeploying

Re-upload the archive. Because `DB_PATH` points outside the app directory, data survives.
Schema changes apply themselves on boot. **Verify `DB_PATH` before every redeploy** — if it
ever falls back to the default `data/worklog.sqlite`, the next deploy takes the hours with it.

### Backups

No shell means no `sqlite3 .backup`. Use **Settings → Download JSON export** (an admin gets
the whole workspace) on a schedule, and take Hostinger's own file backups. If the data
starts to matter, that is the signal to move to the VPS route below, where you get real
`.backup` snapshots.

### When to outgrow this

Shared hosting can idle or restart the process, and SQLite in WAL mode is happiest on local
disk. For a handful of people logging hours it is fine. If you see locking errors under
concurrent writes, or you want scheduled backups, move to the VPS.

---

# VPS + systemd + Caddy

Put it on a small VPS behind a reverse proxy that terminates TLS. Roughly ten minutes.

## 1. Get the code onto the box

```bash
sudo mkdir -p /srv/dgtl-worklog && sudo chown $USER /srv/dgtl-worklog
rsync -av --exclude data --exclude .env apps/dgtl-worklog/ user@host:/srv/dgtl-worklog/
```

Node 22.5+ is required (`node:sqlite`). On Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

## 2. Configure

```bash
cd /srv/dgtl-worklog
cp .env.example .env
```

Edit `.env` for production:

```ini
HOST=127.0.0.1        # loopback only — the proxy is the only way in
PORT=8123
SECURE_COOKIES=1      # required once you are on HTTPS, or logins will not stick
TRUST_XFF=1           # only with a proxy you control setting X-Forwarded-For
APP_TIMEZONE=America/Toronto
DB_PATH=/srv/dgtl-worklog/data/worklog.sqlite
```

Create the first admin:

```bash
npm run seed -- --no-demo --email you@dgtlgroup.io --name "Your Name"
```

## 3. Run it under systemd

```bash
sudo cp deploy/dgtl-worklog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dgtl-worklog
systemctl status dgtl-worklog
```

Logs: `journalctl -u dgtl-worklog -f`

## 4. Terminate TLS

`deploy/Caddyfile` is the shortest path — Caddy gets and renews the certificate itself.

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the hostname first
sudo systemctl reload caddy
```

Behind nginx instead, the equivalent is a `proxy_pass http://127.0.0.1:8123;` with
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and the usual `Host` and
`X-Forwarded-Proto` headers.

## 5. Back up

The entire workspace is one file. A nightly copy is a complete backup:

```cron
15 3 * * *  sqlite3 /srv/dgtl-worklog/data/worklog.sqlite ".backup '/srv/backups/worklog-$(date +\%F).sqlite'"
```

Use `.backup` rather than `cp` — the database runs in WAL mode, so a plain copy taken
mid-write can be inconsistent. If `sqlite3` is not installed, stop the service, copy, start.

Keep backups off the box, and remember this file contains real team data.

## Updating

```bash
rsync -av --exclude data --exclude .env apps/dgtl-worklog/ user@host:/srv/dgtl-worklog/
sudo systemctl restart dgtl-worklog
```

Schema changes apply themselves on boot — every statement in `schema.sql` is
`IF NOT EXISTS`. Adding a column to an existing table needs an explicit `ALTER TABLE`;
put it in `schema.sql` guarded by a check, or run it once by hand before restarting.

## Health check

`GET /api/timer` returns 401 when unauthenticated — that is a fine liveness probe, since it
proves the process is up and the database opened. Anything else (connection refused, 500)
means look at the journal.
