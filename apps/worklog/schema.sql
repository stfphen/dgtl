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
  daily_target_minutes INTEGER NOT NULL DEFAULT 480,       -- drives the Today ring
  week_start           INTEGER NOT NULL DEFAULT 1,         -- 0 = Sunday, 1 = Monday
  active               INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
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
