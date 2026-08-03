-- DGTL Creator & Brand Intake — MySQL 8 / MariaDB 10.5+ schema.
-- Import once via phpMyAdmin (Hostinger hPanel). Keep in sync with schema.sqlite.sql.
-- Design notes: hot/filterable/legal fields are real columns kept in sync by PHP;
-- everything else lives in the payload JSON. No ENUMs, generated columns, or
-- ON DUPLICATE KEY anywhere — SQLite (dev) must behave identically. All
-- timestamps are written by PHP in UTC.

CREATE TABLE applications (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id                CHAR(36)      NOT NULL,
  applicant_type           VARCHAR(10)   NOT NULL,                  -- creator | brand
  email                    VARCHAR(320)  NOT NULL DEFAULT '',
  public_name              VARCHAR(200)  NULL,
  primary_category         VARCHAR(100)  NULL,
  status                   VARCHAR(16)   NOT NULL DEFAULT 'draft',  -- draft|submitted|in_review|approved|rejected|more_info
  current_step             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  payload                  LONGTEXT      NOT NULL,                  -- JSON (validated in PHP)
  payload_rev              INT UNSIGNED  NOT NULL DEFAULT 1,
  client_token_hash        CHAR(64)      NULL,                      -- sha256(draft_token . pepper)
  consent_marketing_email  TINYINT(1)    NOT NULL DEFAULT 0,        -- CASL: express, unticked
  consent_survey_panel     TINYINT(1)    NOT NULL DEFAULT 0,
  consent_broadcast        TINYINT(1)    NOT NULL DEFAULT 0,        -- broadcast_ok, explicit opt-in
  ai_training_optout       TINYINT(1)    NOT NULL DEFAULT 1,        -- default ON
  signature_name           VARCHAR(200)  NULL,
  signature_ip             VARCHAR(45)   NULL,
  signature_at             DATETIME      NULL,
  terms_version            VARCHAR(32)   NULL,
  review_note              TEXT          NULL,
  is_spam                  TINYINT(1)    NOT NULL DEFAULT 0,
  created_at               DATETIME      NOT NULL,
  updated_at               DATETIME      NOT NULL,
  submitted_at             DATETIME      NULL,
  reviewed_at              DATETIME      NULL,
  UNIQUE KEY uq_public_id (public_id),
  KEY idx_status (status),
  KEY idx_email (email),
  KEY idx_type_status (applicant_type, status),
  KEY idx_category (primary_category),
  KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE application_media (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id      INT UNSIGNED  NOT NULL,
  kind                VARCHAR(24)   NOT NULL,                 -- upload | link | analytics_screenshot
  r2_key              VARCHAR(512)  NULL,
  url                 VARCHAR(1024) NULL,                     -- external URL for kind=link only
  title               VARCHAR(300)  NULL,
  credit              VARCHAR(300)  NULL,
  date_created        VARCHAR(32)   NULL,
  is_owner            TINYINT(1)    NULL,
  third_party_credits TEXT          NULL,
  mime                VARCHAR(100)  NULL,
  bytes               BIGINT UNSIGNED NULL,
  status              VARCHAR(16)   NOT NULL DEFAULT 'pending', -- pending|stored|rejected|deleted
  created_at          DATETIME      NOT NULL,
  updated_at          DATETIME      NOT NULL,
  KEY idx_app (application_id, kind, status),
  CONSTRAINT fk_media_app FOREIGN KEY (application_id)
    REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE magic_links (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NOT NULL,
  token_hash     CHAR(64)     NOT NULL,
  expires_at     DATETIME     NOT NULL,
  used_at        DATETIME     NULL,
  created_ip     VARCHAR(45)  NULL,
  created_at     DATETIME     NOT NULL,
  UNIQUE KEY uq_token (token_hash),
  KEY idx_app (application_id),
  CONSTRAINT fk_ml_app FOREIGN KEY (application_id)
    REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id INT UNSIGNED NULL,
  actor          VARCHAR(16)  NOT NULL,      -- applicant | admin | system
  action         VARCHAR(64)  NOT NULL,
  meta           TEXT         NULL,          -- JSON; field names only, never payload values
  ip             VARCHAR(45)  NULL,
  created_at     DATETIME     NOT NULL,
  KEY idx_app (application_id),
  KEY idx_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rate_limits (
  bucket       VARCHAR(160) NOT NULL PRIMARY KEY,  -- "action|scope|value", e.g. "magic|ip|1.2.3.4"
  window_start INT UNSIGNED NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
