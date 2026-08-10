# DGTL Worklog

Internal tool for managing **work, logged hours and to-do lists** across the DGTL team.
Black + gold, Manrope, built on the DGTL brand kit — it should look like the rest of DGTL.

Adapted from the `habit-tracker` spec: that project's daily check-in loop, local-first store
and *derive-everything* rule are the skeleton here, retargeted from habits to billable work.

| habit-tracker | DGTL Worklog |
|---|---|
| Habit (name, colour, archived, order) | **Project** (name, client, colour, budget, archived, order) |
| Completion (one per habit per day) | **Time entry** (dated, with minutes, note, billable flag) |
| Today screen — tap to check off | **Quick log** — one tap starts the clock; **Today** shows the day's ring fill |
| One-tap toggle, no forms | One-tap Start, then tag/label the timer while it runs |
| Streaks + completion ring | Streaks + daily-target ring, driven by hours |
| Month calendar of coloured days | **Timesheet → Month**, days shaded by hours |
| 3-month GitHub-style heatmap | Same heatmap, on **Reports** |
| Local-first via AsyncStorage | Server-backed SQLite so the whole team shares one workspace |
| — | **Tasks** — the shared to-do list, with drag ordering and per-task time |

The rule that carried over unchanged: **streaks, totals, budget usage and completion
percentages are never stored.** They are computed from `time_entries` on every read, so
editing a mistake three weeks back leaves every number correct.

---

## Quick start

```bash
cd apps/dgtl-worklog && npm run seed && npm start
```

Then open <http://localhost:8123>. `seed` prints the admin email and a generated password —
copy it, it is not stored anywhere else. Change it from **Settings → Change password**.

Requires **Node 22.5+** (for the built-in `node:sqlite`). There are **no dependencies** —
no `npm install`, no build step, no bundler.

```bash
npm start          # serve on $PORT (default 8123)
npm run dev        # same, restarting on file changes
npm test           # API smoke test against a throwaway database
npm run seed       # first admin + sample projects/tasks/3 weeks of history
npm run seed -- --no-demo     # admin only, empty workspace
npm run demo       # three-person demo team with shared credentials (below)
npm run user -- list          # user admin from the CLI (see below)
```

### Demo credentials

`npm run demo` (after `npm run seed`) sets up a three-person team so the Team-scoped
Timesheet and the "By person" report have more than one row in them. All three share one
password so it is easy to type in front of an audience:

| Email | Name | Role | |
|---|---|---|---|
| `admin@dgtlgroup.io` | DGTL Admin | admin | sees everyone; manages projects + people |
| `sam@dgtlgroup.io` | Sam Delaney | member | own time only, full read access |
| `jordan@dgtlgroup.io` | Jordan Pike | member | own time only, full read access |

**Password for all three: `dgtl-demo-2026`**

Each gets three weeks of weekday hours and their own tasks, generated from a fixed seed so
a rebuilt database demos identically. Re-running is safe: it resets those three accounts
and leaves anyone else — and any existing history — alone.

> ⚠️ These credentials are in the repo, so the script refuses to run with
> `NODE_ENV=production`. Before this workspace holds anything real, clear them:
> `npm run user -- reset --email <e>` to re-secure, or `npm run user -- off --email <e>`
> to deactivate (their logged hours are kept either way).

Configuration lives in `.env` — copy `.env.example`. Every setting has a working default,
so a fresh clone runs with nothing configured.

---

## What it does

**Quick log** — the screen the app opens on, and the answer to "I'll log it later"
(nobody does). One rule shaped it: **starting the clock never waits on a decision.**
Hit Start the moment work begins; tag and label it while it runs, because the running
timer can be re-labelled without stopping it. The chips below the clock are your active
projects ordered by what you worked on most recently, plus your own recent labels and
whatever is on your plate — so the button you want is usually the first one. `Space`
starts and stops. If the work already happened, the 15m/30m/45m/1h/1h30/2h buttons log a
block against the same project and label without running the clock at all.

**Today** — the daily loop. Start the timer against a project and task, or log a block by
hand. A ring shows the day against your target; KPI cards show the week, your current
streak, and what is due. "Your focus" surfaces overdue and in-progress work first.

**Tasks** — the shared to-do list. Filter by state, project and person; drag to reorder;
one click to complete or to start timing (which also flips the task to *in progress*).
Estimates are compared against time actually logged.

**Timesheet** — **Week** is a project × day grid you fill in by clicking a cell. **Month**
is a calendar shaded by hours. Both switch between one person and the whole team.

**Projects** — client, code, colour, billable flag, budget. Budget bars turn red past 100%.
A project with logged time cannot be deleted, only archived, so hours are never orphaned.

**Reports** — hours per day, split by project and by person, tasks completed, billable
share, and a trailing-90-day heatmap. Any range; scoped to you or the team.

**Settings** — your name, daily target and week start; change password; JSON export.
Admins also manage the team here.

### Who can do what

| | Member | Admin |
|---|---|---|
| Log/edit **own** time | ✅ | ✅ |
| Create and edit tasks | ✅ | ✅ |
| Read team reports and timesheets | ✅ | ✅ |
| Edit **anyone's** time | — | ✅ |
| Create/edit/archive projects | — | ✅ |
| Manage people | — | ✅ |
| Export | own entries | whole workspace |

---

## Layout

```
apps/dgtl-worklog/
├── schema.sql              tables; applied on every boot (all IF NOT EXISTS)
├── server/
│   ├── server.mjs          entry point — routing, static files, security headers
│   ├── api.mjs             the JSON API and its permission rules
│   ├── auth.mjs            scrypt passwords, session cookies, login throttle
│   ├── db.mjs              node:sqlite connection + helpers
│   ├── http.mjs            bodies, cookies, static serving
│   └── config.mjs          .env loading and the timezone-aware date helpers
├── scripts/{seed,user}.mjs
├── tests/smoke.mjs         45 checks over the real HTTP surface
├── public/                 the app — served as static files, no build
│   ├── index.html · login.html
│   └── assets/
│       ├── tokens.css      the DGTL brand kit tokens, verbatim
│       ├── app.css         app shell + components, expressed in those tokens
│       └── js/{app,store,api,ui,util,editors}.js + views/*.js
└── deploy/                 systemd unit, Caddyfile, notes
```

The front end is plain ES modules — `app.js` builds the shell and mounts one view at a
time; `store.js` holds the workspace and reloads it after every write; `views/*.js` render
into a host element and return an optional teardown.

### Two conventions worth knowing before you edit

- **Build DOM with `h()` from `util.js`, not `innerHTML`.** Children are appended as text
  nodes, so a task title containing `<script>` is inert. `html:` is the deliberate opt-out,
  used only for our own icons.
- **Durations are parsed, not typed strictly.** `parseDuration` accepts `1:30`, `1.5h`,
  `90m`, `1h30` and bare numbers (decimals read as hours, whole numbers as minutes).

---

## API

All endpoints are under `/api`, take and return JSON, and require the session cookie except
`POST /api/auth/login`. State-changing verbs are refused cross-origin.

```
POST   /api/auth/login · /api/auth/logout
GET    /api/bootstrap            everything the app needs for a cold start
PATCH  /api/me                   name, daily target, week start, password

GET    /api/projects             POST · PATCH /:id · DELETE /:id      (writes: admin)
GET    /api/tasks                POST · PATCH /:id · DELETE /:id · POST /tasks/reorder
GET    /api/entries?from&to&userId|scope=team      POST · PATCH /:id · DELETE /:id
GET    /api/timer                POST /timer/start · /timer/stop · /timer/discard
PATCH  /api/timer                re-label a RUNNING timer (never moves started_at)
GET    /api/suggestions          this person's recent labels + projects, recency-ranked
GET    /api/report?from&to&userId|scope=team
GET    /api/users                POST · PATCH /:id                    (admin)
GET    /api/export
```

Three behaviours that are deliberate rather than accidental:

- **Starting a timer while one runs banks the first** as a time entry rather than losing it.
- **A timer stopped under a minute is discarded**, so a mis-click never litters the timesheet.
- **`PATCH /api/timer` never touches `started_at`.** Elapsed time is a fact; only what the
  time was *for* is editable mid-run. It also drops a task that belongs to a different
  project rather than silently mis-filing the hours.
- **`done_at` is stamped on completion and cleared on reopen**, because "tasks completed this
  week" counts from it.

---

## Dates and timezones

Every entry is filed under a calendar date in `APP_TIMEZONE` (default `America/Toronto`),
not the browser's or the server's locale. That way the whole team agrees on what "today"
means, and a late-evening entry doesn't land on tomorrow for someone on another machine.
The date shown in Settings tells people which zone they are in.

## Security notes

- Passwords are scrypt with a per-user salt; the cost parameters are stored with the hash.
- Only the SHA-256 of a session token is stored, so a database leak yields no live sessions.
- Deactivating someone or resetting their password drops their sessions immediately.
- Login is throttled per ip+email (10 tries / 15 min).
- Cookies are `HttpOnly` + `SameSite=Lax`; set `SECURE_COOKIES=1` behind TLS or the browser
  will drop them. Writes additionally require a same-origin `Origin` header.
- The last active admin cannot be demoted or deactivated — including by themselves.
- **The database holds real team data. It is gitignored (`data/`); keep it that way.**

## Managing people without the UI

```bash
npm run user -- list
npm run user -- add   --email sam@dgtlgroup.io --name "Sam" --role admin
npm run user -- reset --email sam@dgtlgroup.io      # prints a new password
npm run user -- role  --email sam@dgtlgroup.io --role member
npm run user -- off   --email sam@dgtlgroup.io      # deactivate; hours are kept
```

## Deploying

See [deploy/DEPLOY.md](deploy/DEPLOY.md). Two routes: **Hostinger shared hosting** via
hPanel's Node.js app support (pin Node 24 — `node:sqlite` needs 22.5+), or **VPS + systemd
+ Caddy**. Two things matter on either:

- **`DB_PATH` must point outside the deployed directory**, or the next deploy takes the
  team's hours with it.
- **`SECURE_COOKIES=1` once you are on HTTPS**, or browsers drop the session cookie and
  nobody can stay signed in.

Where you cannot get a shell to run `npm run seed`, set `BOOTSTRAP_ADMIN_EMAIL` /
`BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_NAME` and the first admin is created on boot.
It only fires when the users table is completely empty, so it can never reset a live
account — delete the variables after the first sign-in.

## Brand

`public/assets/tokens.css` is the DGTL brand kit stylesheet, unmodified — gold is `#F0CF50`
and stays an accent (sidebar-active, the primary action, the day's headline number).
Everything else is the near-black surface ladder with `#2a2a2a` borders. If you add a
component, derive it from the tokens rather than hardcoding a hex value.
