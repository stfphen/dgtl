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
| Completion ring, driven by check-ins | **Billable-share ring**, driven by the part of the day that reaches an invoice |
| Month calendar of coloured days | **Timesheet → Month**, days shaded by hours |
| 3-month GitHub-style heatmap | Same heatmap, on **Reports** |
| Local-first via AsyncStorage | Server-backed SQLite so the whole team shares one workspace |
| — | **Tasks** — the shared to-do list, grouped by client, with drag ordering and per-task time |
| — | **Shifts** — attendance, reconciled against the work filed inside it |

The rule that carried over unchanged: **streaks, totals, budget usage, billable share,
completion percentages and the unattributed part of a shift are never stored.** They are
computed from `time_entries` on every read, so editing a mistake three weeks back leaves every
number correct. The one thing the app writes on your behalf — the next instance of a repeating
task — is a row you can see and edit, not a derived figure.

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
starts and stops (except while you are typing in a field). If the work already happened,
the 15m/30m/45m/1h/1h30/2h buttons log a block against the same project and label without
running the clock at all.

**Today** — the daily loop. Start the timer against a project and task, or log a block by
hand. Four KPI cards: what is logged today, the week so far, **billable share**, and open
tasks. The ring measures **the share of the day that reached an invoice** against your
billable target — not hours present, because 8h logged is a figure an agency can hit every
day while selling nothing. Its denominator is the day that actually happened: presence when
somebody clocked in, otherwise the work filed into the day, otherwise the daily target.
"Your focus" surfaces overdue and in-progress work first.

**Shifts** — attendance, which is deliberately not work. Clock in and out from the strip at
the top of Today; a shift records only that you were here between two instants, carries no
project and no task, and nothing in the app sums minutes out of it, so shift time can never
reach an invoice. What it buys is **reconciliation**: the clock-out sheet lays the day out
end to end, every stretch either work with a clock behind it or open time nothing accounts
for, and the gap can be assigned to a project in one click. Blocks logged by hand carry no
window, so nothing can place them inside a shift — they are reported apart, as
`unplacedMinutes`, at the level of the day. Two numbers point the other way and are stated
outright: `overclaimedMinutes`, where the timesheet bills more minutes than the presence
contained, and `shortfallMinutes`, where presence is unattributed but not open.

**Tasks** — the shared to-do list, read the way the work is organised: **client → project →
tasks**, each section collapsible and carrying a **paired ring** — the outer arc is how many
tasks are done, the inner is how much of the estimate (or the budget, where a project has
one) has been spent. The divergence between them is the point: 80% of the tasks done against
130% of the estimate is a workstream losing money, and a single ring reads that as "nearly
there". Filter by state, project and person; **sort by any column** from the strip above the
board; drag to reorder while the sort is on Order; one click to complete or to start timing
(which also flips the task to *in progress*).

**Repeating tasks** — a task can carry a rule, **weekly** or **monthly**, and completing it
writes the next instance. See [Repeating work](#repeating-work) below.

**Timesheet** — **Week** is a project × day grid you fill in by clicking a cell, with
sortable column headings. **Month** is a calendar shaded by hours. Both switch between one
person and the whole team.

**Projects** — client, contact, code, colour, billable flag, budget. The **client** is who
the work is for and is a row of its own, picked rather than typed twice; the **contact** is
the person you deal with, and lives on the project. Budget bars turn red past 100%, and past
that point the track becomes what was *spent* so a 453% overrun does not paint the same as
101%. A project with logged time cannot be deleted, only archived, so hours are never
orphaned; deleting one reports how many tasks it detached.

**Reports** — two things, behind one switch.
*Activity* is the internal read: hours per day, split by project and by person, tasks
completed, billable share, current streak, and a trailing-90-day heatmap. Any range; scoped
to you or the team.
*Client digest* is the outward one — see [The client digest](#the-client-digest).

**Settings** — your name, daily target and week start; change password; JSON export.
Admins also manage the team here. (`billableTargetPct` — the share of the day meant to be
billable, default 60 — is per person on the server and settable through `PATCH /api/me`, but
has no field on this screen yet.)

### Who can do what

| | Member | Admin |
|---|---|---|
| Log/edit **own** time | ✅ | ✅ |
| Clock in/out, correct **own** attendance | ✅ | ✅ |
| Create and edit tasks | ✅ | ✅ |
| Read team reports, timesheets and digests | ✅ | ✅ |
| Edit **anyone's** time or attendance | — | ✅ |
| Create/edit/archive projects and clients | — | ✅ |
| Manage people | — | ✅ |
| Export | own entries | whole workspace |

---

## Repeating work

The owner's own list carried "Weekly progress note to Michael" twice — Due Fri and Due
21 Aug — two rows typed by hand a week apart, and the same shape again for the monthly
invoice reminder. A task can now carry a rule instead.

- **Two rules: `weekly` and `monthly`.** They cover every observed case. There is no RRULE
  parser, no interval, no end date and no exception list, because each of those is another
  field a reader has to check before trusting a due date.
- **A rule needs a due date.** That is what it steps from; a task cannot be saved with one
  and not the other, at either end.
- **Completion is the trigger.** Ticking a repeating task off writes the next instance
  immediately, and nothing else ever does. The honest consequence: a task you never finish
  never repeats — it just sits there, overdue, which is true information. The alternative,
  scheduling instances ahead, reproduces exactly the pile-up this replaced: two rows for the
  same job because nobody closed the first.
- **The next due date is computed, never accumulated.** It is this row's due date stepped by
  the rule — so a Friday note stays on Friday however late it was written — and then stepped
  again until it is past today, so a series finished three weeks late catches up in whole
  weeks instead of being born overdue. `31 Jan` monthly lands on `28 Feb`, and stays on the
  28th afterwards: there is no stored anchor day to spring back to.
- **Carried over:** title, notes, project, assignee, estimate, priority, and the rule itself.
  **Not carried:** `done_at` (the new one is not done), logged time (entries point at the
  task they were worked on, so next week's note has been worked on for no minutes), and
  position — a new instance goes to the top of the board like any new task, rather than into
  the slot of the row somebody just finished.
- **Ending a series** is whatever you would do to the row: delete it, archive it, or set
  Repeats back to "Does not repeat". The open instance IS the series — there is no schedule
  behind it to remember — so removing the row ends it, and completing an archived one writes
  nothing. Reopening a completed task does **not** retract the instance it already created;
  the one to remove is the one you can see.

---

## The client digest

`GET /api/digest`, and the **Reports → Client digest** view that renders it. It exists
because "Weekly progress note to Michael" was an hour of recurring manual work restating
facts this database already held: hours by workstream, what closed, the notes people wrote
on their own time entries, and what falls due next.

It is deliberately **not** a client-facing page. The `dgtl-worklog-status-report` skill
builds that artefact; this is the substance it is built from, shaped as that skill's inputs
(closed over scheduled per workstream, estimate remaining, logged minutes from the project
totals rather than the task totals, completions sorted by `doneAt`).

**Every number, date and title in it traces to a row.** Alongside the digest the endpoint
returns a `provenance` array — one entry per claim, carrying the ids of the rows it was
summed from — and the view renders it as a table behind a fold. Nothing is rounded for
readability, nothing is estimated. The smoke test walks every claim, re-fetches the named
rows from a *different* endpoint, and fails if any of them disagrees.

Three things it says out loud rather than implying:

- **`coverage`** — how much of the week's time carries a written note. A narrative built from
  the notes on 40% of the hours is a story about 40% of the hours.
- **Buckets, not "overdue".** Open work with a date is `before` (due before the reported week
  started), `inWeek` (due inside it, still open) or `next` (due in the seven days after it).
  All three are statements about the *range*, not about the instant the digest ran, so last
  week's digest reads the same today and next year.
- **`silentProjects`** — the client's projects with nothing in them this week, named so a
  reader knows they were looked at.

`done_at` is an ISO instant while every other date here is a calendar date in `APP_TIMEZONE`,
so completions are filed by converting the instant, never by comparing UTC dates. A task
ticked off at 21:00 on Sunday in Toronto is 01:00 Monday in UTC, and a UTC-dated filter puts
it in next week's report — right in the morning, wrong in the evening. The Reports KPI counts
completions through the same helper, so the two cannot disagree.

---

## Layout

```
apps/dgtl-worklog/
├── schema.sql              tables; applied on every boot (all IF NOT EXISTS)
├── server/
│   ├── server.mjs          entry point — routing, static files, security headers
│   ├── api.mjs             the JSON API and its permission rules
│   ├── auth.mjs            scrypt passwords, session cookies, login throttle
│   ├── db.mjs              node:sqlite connection, helpers, column migrations
│   ├── http.mjs            bodies, cookies, static serving
│   └── config.mjs          .env loading and the timezone-aware date helpers
├── scripts/{seed,demo,user}.mjs
├── tests/smoke.mjs         325 assertions over the real HTTP surface
├── public/                 the app — served as static files, no build
│   ├── index.html · login.html
│   └── assets/
│       ├── tokens.css      the DGTL brand kit tokens, plus this app's additions (see Brand)
│       ├── app.css         app shell + components, expressed in those tokens
│       └── js/{app,store,api,ui,util,editors,shift}.js + views/*.js
└── deploy/                 systemd unit, Caddyfile, notes
```

The front end is plain ES modules — `app.js` builds the shell and mounts one view at a
time; `store.js` holds the workspace and reloads it after every write; `views/*.js` render
into a host element and return an optional teardown; `shift.js` is the attendance strip, its
reconciliation sheet and its editor, shared between views.

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
PATCH  /api/me                   name, daily target, billable target, week start, password

GET    /api/projects             POST · PATCH /:id · DELETE /:id      (writes: admin)
GET    /api/clients              clients that have projects
GET    /api/tasks                POST · PATCH /:id · DELETE /:id · POST /tasks/reorder
GET    /api/entries?from&to&userId|scope=team      POST · PATCH /:id · DELETE /:id

GET    /api/timer                POST /timer/start · /timer/stop · /timer/discard
PATCH  /api/timer                re-label a RUNNING timer (never moves started_at)

POST   /api/shift/in · /api/shift/out             clock in and out
GET    /api/shifts?from&to&userId|scope=team      attendance over a range
GET    /api/shift/:id            the clock-out sheet: the day laid out end to end
PATCH  /api/shift/:id            correct a forgotten clock-out; null endedAt reopens
DELETE /api/shift/:id            drop a record of presence (no logged work goes with it)
POST   /api/shift/:id/dispose    file a shift's open time against a project

GET    /api/suggestions          this person's recent labels + projects, recency-ranked
GET    /api/report?from&to&userId|scope=team
GET    /api/digest?clientId&from&to                one client, one week, with its provenance
GET    /api/users                POST · PATCH /:id                    (admin)
GET    /api/export
```

Payload notes worth knowing: `/api/bootstrap` carries `billableTargetPct` (the share of the
day meant to reach an invoice, so the client never assumes one), the day's `shifts`, and
`unplacedMinutes` — time logged by hand today, which carries no window and therefore belongs
to no shift. Project rows carry `clientId`/`clientName` alongside `client` (the contact) and
`billableMinutes` counted per entry.

Behaviours that are deliberate rather than accidental:

- **Starting a timer while one runs banks the first** as a time entry rather than losing it,
  and the new stretch picks up where the banked one's billed minutes ended, so a session of
  chip taps tiles end to end with nothing lost and nothing billed twice.
- **A timer stopped under a minute is discarded**, so a mis-click never litters the timesheet.
  Elapsed time is **floored**, so what an entry bills and the window it holds are the same
  fact — which is what lets an overrun be seen at all.
- **`PATCH /api/timer` never touches `started_at`.** Elapsed time is a fact; only what the
  time was *for* is editable mid-run. It also drops a task that belongs to a different
  project rather than silently mis-filing the hours.
- **Clocking out banks the running timer first**, so no stretch outlives the presence it
  was worked in.
- **`POST /api/shift/:id/dispose` writes ordinary time entries** — one per open stretch, each
  with a real start and end. There is no second kind of row and no "this was a gap" flag; an
  overhead bucket is just a project flagged non-billable, which is why the entry takes its
  billable flag from the project rather than from the caller. It refuses if the day already
  bills more minutes than its clocks ran.
- **`done_at` is stamped on completion and cleared on reopen** — and stamped on creation too,
  when a task is filed as already done, because every "completed this week" count reads it.
- **Completing a task carrying a recurrence returns `{ task, next }`**, `next` being the
  instance it created.

---

## Dates and timezones

Every entry is filed under a calendar date in `APP_TIMEZONE` (default `America/Toronto`),
not the browser's or the server's locale. That way the whole team agrees on what "today"
means, and a late-evening entry doesn't land on tomorrow for someone on another machine.
The date shown in Settings tells people which zone they are in.

Timestamps — `done_at`, a shift's ends, an entry's window — are stored as ISO instants and
converted to that zone whenever they have to meet a calendar date. Attendance is reconciled
by *window*, never by date, so a shift across midnight, across a spring-forward hour that
does not exist, or across an autumn hour that happens twice, still adds up.

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

## Changing the schema

`schema.sql` is the single description of the shape and is replayed on every boot; every
statement in it is `CREATE ... IF NOT EXISTS`, which is why it doubles as the installer for a
fresh database and does nothing to an old one. A new **table** therefore only needs to go
there. A new **column on a table that already exists** needs both: the column in
`schema.sql`, so a fresh database is built with it, and an entry in `COLUMN_MIGRATIONS` in
`db.mjs`, so a database built before it gains it on the next boot. `addColumn` is guarded, so
it is a no-op the second time.

What does not belong in either: a column holding something derived. `time_entries.shift_id`
is the standing example — which shift a stretch of work falls inside is computed from its
timestamps at read time, so storing it would freeze an answer that has to move when the entry
is edited.

## Brand

`public/assets/tokens.css` **started as** the DGTL brand kit stylesheet and has since been
changed. Gold is `#F0CF50` and stays an accent (sidebar-active, the primary action, the day's
headline number); everything else is the near-black surface ladder with `#2a2a2a` borders. If
you add a component, derive it from the tokens rather than hardcoding a hex value.

Do **not** re-paste the brand kit over this file. Five tokens and two rules would go with it:

| Added / changed | Why |
|---|---|
| `--text-strong` `#ffffff` | one step above `--text`, for headings and figures that lead a block |
| `--border-row` `#1c1c1c` | the hairline between rows; a card edge would shout |
| `--surface-hover` `#0f0f0f` | one row-hover shade, shared by every hoverable row |
| `--nil` `#7a7a7a` | absent data. The kit had no swatch for it and `#3a3a3a` read 1.74:1 — an empty week grid painted as a blank sheet |
| `--shadow-edge` `rgba(0,0,0,.85)` | the cue that content scrolls under a pinned column |
| `:focus-visible` rewritten | the kit's ring alone is 1.34:1 on black, under the 3:1 a focus indicator must meet. The outline carries the contrast; the ring is glow |
| every `:hover` wrapped in `@media (hover:hover) and (pointer:fine)` | a touch browser fires `:hover` on tap and holds it, stranding the state on the last thing touched |

## Verifying a change

```bash
npm test                       # 325 assertions over the real HTTP surface; exit 1 on any failure
```

The suite boots the real server against a throwaway database on a spare port and drives it
over HTTP. It also audits itself: it fails if any database outside its temp directory was
created or written, and if the temp one is left behind.

Three habits it is built around, worth keeping:

- **No assertion may depend on when it runs.** Fixtures are either fixed instants (chosen so
  their UTC date and their `APP_TIMEZONE` date fall on opposite sides of a boundary — the
  case a wrong implementation passes only in the morning) or dates expressed relative to the
  day the server reports. The suite has been run under seven host timezones and at eight
  simulated clock positions with identical results.
- **A new assertion has to bite.** Revert the mechanism, watch it go red, restore.
- **The pure arithmetic is imported directly.** `rollup`, `mergeRollups`, `ringGeometry`,
  `sorter`, `budgetBar` and `billableStanding` have no DOM in them for exactly this reason;
  what that cannot see — whether any of it renders — is checked in a browser, not here.
