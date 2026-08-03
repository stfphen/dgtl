-- SQLite twin of schema.sql, for local dev and tests. Auto-applied by lib/db.php
-- on first connect. Keep column names and semantics identical to schema.sql.

CREATE TABLE applications (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id                TEXT    NOT NULL UNIQUE,
  applicant_type           TEXT    NOT NULL,
  email                    TEXT    NOT NULL DEFAULT '',
  public_name              TEXT,
  primary_category         TEXT,
  status                   TEXT    NOT NULL DEFAULT 'draft',
  current_step             INTEGER NOT NULL DEFAULT 1,
  payload                  TEXT    NOT NULL,
  payload_rev              INTEGER NOT NULL DEFAULT 1,
  client_token_hash        TEXT,
  consent_marketing_email  INTEGER NOT NULL DEFAULT 0,
  consent_survey_panel     INTEGER NOT NULL DEFAULT 0,
  consent_broadcast        INTEGER NOT NULL DEFAULT 0,
  ai_training_optout       INTEGER NOT NULL DEFAULT 1,
  signature_name           TEXT,
  signature_ip             TEXT,
  signature_at             TEXT,
  terms_version            TEXT,
  review_note              TEXT,
  is_spam                  INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT    NOT NULL,
  updated_at               TEXT    NOT NULL,
  submitted_at             TEXT,
  reviewed_at              TEXT
);
CREATE INDEX idx_app_status   ON applications(status);
CREATE INDEX idx_app_email    ON applications(email);
CREATE INDEX idx_app_type     ON applications(applicant_type, status);
CREATE INDEX idx_app_category ON applications(primary_category);
CREATE INDEX idx_app_updated  ON applications(updated_at);

CREATE TABLE application_media (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id      INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind                TEXT    NOT NULL,
  r2_key              TEXT,
  url                 TEXT,
  title               TEXT,
  credit              TEXT,
  date_created        TEXT,
  is_owner            INTEGER,
  third_party_credits TEXT,
  mime                TEXT,
  bytes               INTEGER,
  status              TEXT    NOT NULL DEFAULT 'pending',
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);
CREATE INDEX idx_media_app ON application_media(application_id, kind, status);

CREATE TABLE magic_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  token_hash     TEXT    NOT NULL UNIQUE,
  expires_at     TEXT    NOT NULL,
  used_at        TEXT,
  created_ip     TEXT,
  created_at     TEXT    NOT NULL
);
CREATE INDEX idx_ml_app ON magic_links(application_id);

CREATE TABLE audit_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  actor          TEXT NOT NULL,
  action         TEXT NOT NULL,
  meta           TEXT,
  ip             TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_audit_app    ON audit_log(application_id);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);

CREATE TABLE rate_limits (
  bucket       TEXT    NOT NULL PRIMARY KEY,
  window_start INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 1
);
