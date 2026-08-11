-- DGTL Worklog — schema. Applied on first connect by server/db.mjs.
--
-- Adapted from the habit-tracker data model: a Habit becomes a Project (the
-- recurring thing you show up for), a Completion becomes a TimeEntry (a dated
-- record of showing up), and everything derived — streaks, totals, completion
-- percentages, the heatmap — is computed from time_entries at read time and
-- NEVER stored. That rule is what keeps the numbers honest after an edit.

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT    NOT NULL UNIQUE,
  name                 TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  password_hash        TEXT    NOT NULL,                   -- scrypt$N$r$p$salt$hash
  daily_target_minutes INTEGER NOT NULL DEFAULT 480,       -- how long a working day is
  billable_target_pct  INTEGER NOT NULL DEFAULT 60,        -- the share of it meant to be billable
  week_start           INTEGER NOT NULL DEFAULT 1,         -- 0 = Sunday, 1 = Monday
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  -- NOT the client. This column drifted into holding the CONTACT you deal with
  -- — "Michael", "Max Gregan", "Internal" — and every project dropdown in the
  -- app renders it as "<name> · <client>". Who the work is FOR lives in
  -- `clients` below; this stayed exactly as it is because somebody relies on
  -- those names and a migration that overwrote them would be unrecoverable.
  client         TEXT    NOT NULL DEFAULT '',
  code           TEXT    NOT NULL DEFAULT '',          -- short tag shown in dense views
  color          TEXT    NOT NULL DEFAULT '#F0CF50',   -- chart/legend colour
  billable       INTEGER NOT NULL DEFAULT 1,
  budget_minutes INTEGER,                              -- NULL = no budget tracked
  status         TEXT    NOT NULL DEFAULT 'active',    -- 'active' | 'archived'
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status, position);

-- Who the work is FOR. One client owns many projects, which is the whole point:
-- five of eight projects in this workspace were one client faked with a name
-- prefix ("TPB · A — …"), so the board showed five strangers instead of one
-- account. A client is its own row rather than another string on `projects`
-- because a string cannot be picked from a list, and a picked value cannot be
-- misspelt into a second section for the same people.
CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
-- Case-insensitive, so "The Piano Boutique" and "the piano boutique" are one
-- client. Written as lower(name) so `WHERE lower(name) = lower(?)` uses it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name ON clients(lower(name));

-- The link is its own table, not a projects.client_id column, for one reason:
-- `projects` already exists on every installed database, and adding a column to
-- a live table needs an ALTER guarded by a migration list. A table is
-- CREATE ... IF NOT EXISTS like everything else in this file, so it installs
-- itself identically on a fresh database and a two-year-old one, and this file
-- stays the single description of the schema.
--
-- The PRIMARY KEY on project_id IS the "at most one client per project" rule —
-- refused by the database rather than by whoever remembered to check first.
CREATE TABLE IF NOT EXISTS project_clients (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  client_id  INTEGER NOT NULL    REFERENCES clients(id)  ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_clients_client ON project_clients(client_id);

CREATE TABLE IF NOT EXISTS tasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title            TEXT    NOT NULL,
  notes            TEXT    NOT NULL DEFAULT '',
  assignee_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status           TEXT    NOT NULL DEFAULT 'todo',   -- 'todo' | 'doing' | 'done'
  priority         TEXT    NOT NULL DEFAULT 'normal', -- 'low' | 'normal' | 'high'
  estimate_minutes INTEGER,
  due_date         TEXT,                              -- YYYY-MM-DD
  -- NULL | 'weekly' | 'monthly'. The whole recurrence model is this one column:
  -- completing a task carrying a rule writes its next instance, whose due date
  -- is computed from THIS row's due date and the rule at that moment. Nothing
  -- about the series is stored — no schedule table, no parent id, no
  -- "occurrence 4 of n" — because every one of those is an answer that would
  -- freeze while the row it describes goes on being edited. See api.mjs.
  recurrence       TEXT,
  position         INTEGER NOT NULL DEFAULT 0,
  done_at          TEXT,
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_board    ON tasks(archived, status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);

CREATE TABLE IF NOT EXISTS time_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  date       TEXT    NOT NULL,                     -- YYYY-MM-DD in APP_TIMEZONE
  minutes    INTEGER NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  billable   INTEGER NOT NULL DEFAULT 1,
  started_at TEXT,                                 -- ISO, set when logged by timer
  ended_at   TEXT,
  source     TEXT    NOT NULL DEFAULT 'manual',    -- 'timer' | 'manual'
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_date      ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_project   ON time_entries(project_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_task      ON time_entries(task_id);

-- At most one running timer per person. Stopping it writes a row into
-- time_entries and clears this one, so a running timer is never double-counted.
CREATE TABLE IF NOT EXISTS timers (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  note       TEXT    NOT NULL DEFAULT '',
  billable   INTEGER NOT NULL DEFAULT 1,
  started_at TEXT    NOT NULL
);

-- Attendance, which is deliberately not work. A shift records only that someone
-- was here between two instants: it carries no project and no task, and nothing
-- in the app sums minutes out of it, so shift time cannot reach a project
-- total, a report or an invoice. Double counting is impossible because there is
-- no column here that any of those queries could add up.
--
-- Unattributed presence — the part of a shift no time entry covers — is
-- computed against time_entries on every read and never stored, the same rule
-- that keeps streaks and budgets honest after an edit.
--
-- The partial unique index IS the one-open-shift-per-person rule: a second open
-- row is refused by the database rather than by whoever remembered to look
-- first, so two taps racing each other cannot leave a person clocked in twice.
CREATE TABLE IF NOT EXISTS shifts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,   -- YYYY-MM-DD in APP_TIMEZONE, of started_at
  started_at TEXT    NOT NULL,
  ended_at   TEXT,               -- NULL while the shift is open
  note       TEXT    NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_open ON shifts(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, date);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  last_seen  TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Fixed-window login throttle, keyed by ip+email.
CREATE TABLE IF NOT EXISTS login_attempts (
  bucket       TEXT    PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1
);
