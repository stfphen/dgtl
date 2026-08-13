<?php
defined('APP') or exit;

/**
 * Self-check engine for the admin status page.
 *
 * Answers, from the running server, the two questions that cost the most time
 * to guess at: "are submissions reaching the database I think they are?" and
 * "is mail actually leaving the box?".
 *
 * Rules for anything added here:
 *   - NEVER echo a secret. Report presence, length or a masked form only.
 *   - Never throw. A failed check is a returned row, not a 500 — the status
 *     page has to render precisely when the app is broken.
 *   - Each check returns: key, label, state (ok|warn|fail|info), value, note.
 */

const DIAG_OK = 'ok';
const DIAG_WARN = 'warn';
const DIAG_FAIL = 'fail';
const DIAG_INFO = 'info';

function diag_row(string $key, string $label, string $state, string $value, string $note = ''): array
{
    return compact('key', 'label', 'state', 'value', 'note');
}

/** Host the browser actually reached this page on. */
function diag_served_host(): string
{
    return (string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '');
}

/** Show enough of a secret to confirm which one it is, never enough to use it. */
function diag_mask(?string $v): string
{
    if ($v === null || $v === '') {
        return '(empty)';
    }
    $n = strlen($v);
    return $n <= 6 ? str_repeat('•', $n) : substr($v, 0, 2) . str_repeat('•', min($n - 4, 12)) . substr($v, -2);
}

// ── Environment ─────────────────────────────────────────────────────────────

function diag_env_checks(): array
{
    $out = [];
    $raw = env('APP_ENV', '(unset)');

    // The single highest-leverage check in the file. Anything other than the
    // exact string "production" puts is_dev() true, which silently swaps the
    // MySQL database for a SQLite file AND diverts every email to dev-mail/.
    $out[] = diag_row(
        'app_env',
        'APP_ENV',
        $raw === 'production' ? DIAG_OK : DIAG_FAIL,
        (string) $raw,
        $raw === 'production'
            ? 'Production mode: MySQL driver honoured, mail sent over SMTP.'
            : 'NOT production — is_dev() is true, so the app writes to the SQLite dev file and '
              . 'writes emails to dev-mail/*.eml instead of sending them. Set APP_ENV=production.'
    );

    $envFileFound = env_load() !== [];
    $out[] = diag_row(
        'env_file',
        '.env file',
        $envFileFound ? DIAG_OK : DIAG_FAIL,
        $envFileFound ? 'loaded (' . count(env_load()) . ' keys)' : 'NOT FOUND',
        $envFileFound
            ? 'Read from one level above the webroot, or the app root in dev.'
            : 'env.php found no readable .env. Expected at ' . (
                !empty($_SERVER['DOCUMENT_ROOT'])
                    ? dirname($_SERVER['DOCUMENT_ROOT']) . '/.env'
                    : 'one level above the webroot'
            ) . ' — outside public_html.'
    );

    // APP_URL host must match the host being served, or require_json_post()
    // rejects every browser call with 403 bad_origin and no submission ever
    // reaches the database.
    $appUrl = env('APP_URL', '');
    $expected = (string) parse_url((string) $appUrl, PHP_URL_HOST);
    $served = diag_served_host();
    $servedHost = (string) parse_url('https://' . $served, PHP_URL_HOST);
    $matches = $expected !== '' && strcasecmp($expected, $servedHost) === 0;
    $out[] = diag_row(
        'app_url',
        'APP_URL vs served host',
        $matches ? DIAG_OK : DIAG_FAIL,
        ($appUrl ?: '(unset)') . '  →  serving ' . ($served ?: '(unknown)'),
        $matches
            ? 'Origin check will pass for browser API calls.'
            : 'MISMATCH. require_json_post() compares the browser Origin/Referer host against '
              . "APP_URL's host and returns 403 bad_origin when they differ — which blocks every "
              . 'draft save and every submit before it reaches the database. Set APP_URL to '
              . 'https://' . ($served ?: 'your-domain') . ' (no trailing slash).'
    );

    $pepper = env('TOKEN_PEPPER');
    $out[] = diag_row(
        'token_pepper',
        'TOKEN_PEPPER',
        $pepper === null ? DIAG_FAIL : (strlen($pepper) < 32 ? DIAG_WARN : DIAG_OK),
        $pepper === null ? '(unset)' : strlen($pepper) . ' chars',
        $pepper === null
            ? 'Unset — draft tokens and magic links cannot be hashed. Generate with '
              . 'php -r "echo bin2hex(random_bytes(32));"'
            : (strlen($pepper) < 32 ? 'Shorter than the recommended 64 hex chars.' : 'Set.')
    );

    $terms = env('TERMS_VERSION');
    $out[] = diag_row(
        'terms_version',
        'TERMS_VERSION',
        $terms === null ? DIAG_FAIL : DIAG_OK,
        $terms ?? '(unset)',
        $terms === null
            ? 'Unset — submit.php calls env_require(TERMS_VERSION) and will 500 with '
              . 'server_misconfigured before writing the row. This alone stops every submission.'
            : 'Stamped onto every signature.'
    );

    $out[] = diag_row(
        'php',
        'PHP version',
        version_compare(PHP_VERSION, '8.1', '>=') ? DIAG_OK : DIAG_FAIL,
        PHP_VERSION,
        version_compare(PHP_VERSION, '8.1', '>=') ? '' : 'This app needs PHP 8.1+ (never/enum syntax).'
    );

    $log = ini_get('error_log');
    $out[] = diag_row(
        'error_log',
        'PHP error log',
        $log ? DIAG_INFO : DIAG_WARN,
        $log ?: '(server default)',
        $log
            ? 'Silent SMTP and DB failures are written here.'
            : 'No explicit error_log path — silent failures may be going nowhere. On Hostinger, '
              . 'check hPanel → Advanced → PHP Configuration.'
    );

    return $out;
}

// ── Database ────────────────────────────────────────────────────────────────

function diag_db_checks(): array
{
    $out = [];
    $driver = env('DB_DRIVER', 'sqlite');
    $wantsMysql = $driver === 'mysql';

    $out[] = diag_row(
        'db_driver',
        'DB_DRIVER',
        $wantsMysql ? DIAG_OK : ($driver === 'sqlite' && is_dev() ? DIAG_INFO : DIAG_FAIL),
        $driver,
        $wantsMysql
            ? 'Configured for MySQL/MariaDB.'
            : 'SQLite. In production this means submissions land in a flat file on the server, '
              . 'not in the MySQL database you can see in phpMyAdmin.'
    );

    try {
        $pdo = db();
        $actual = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $where = $actual === 'mysql'
            ? (string) $pdo->query('SELECT DATABASE()')->fetchColumn()
            : (string) ($pdo->query("SELECT file FROM pragma_database_list WHERE name='main'")->fetchColumn() ?: 'in-memory');

        $out[] = diag_row(
            'db_connect',
            'Live connection',
            $actual === 'mysql' ? DIAG_OK : DIAG_WARN,
            strtoupper($actual) . ' → ' . $where,
            'This is the database rows are ACTUALLY being written to right now.'
        );

        $tables = ['applications', 'application_media', 'magic_links', 'audit_log', 'rate_limits'];
        $missing = [];
        foreach ($tables as $t) {
            try {
                $pdo->query("SELECT 1 FROM $t LIMIT 1");
            } catch (Throwable $e) {
                $missing[] = $t;
            }
        }
        $out[] = diag_row(
            'db_schema',
            'Schema',
            $missing ? DIAG_FAIL : DIAG_OK,
            $missing ? 'missing: ' . implode(', ', $missing) : count($tables) . ' tables present',
            $missing
                ? 'Import schema.sql via phpMyAdmin. Writes to a missing table throw and the '
                  . 'endpoint 500s.'
                : ''
        );

        // Can we actually write? A read-only grant looks healthy until a POST arrives.
        try {
            $probe = 'diag|write-probe|' . substr(uuidv4(), 0, 8);
            $pdo->prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)')
                ->execute([$probe, time()]);
            $pdo->prepare('DELETE FROM rate_limits WHERE bucket = ?')->execute([$probe]);
            $out[] = diag_row('db_write', 'Write permission', DIAG_OK, 'INSERT + DELETE succeeded', '');
        } catch (Throwable $e) {
            $out[] = diag_row(
                'db_write',
                'Write permission',
                DIAG_FAIL,
                'refused',
                'The app can read but not write: ' . $e->getMessage()
                . ' — check the MySQL user has ALL PRIVILEGES on this database.'
            );
        }
    } catch (Throwable $e) {
        $out[] = diag_row(
            'db_connect',
            'Live connection',
            DIAG_FAIL,
            'UNREACHABLE',
            $e->getMessage() . ' — every API endpoint is failing. Check DB_HOST/DB_NAME/DB_USER/DB_PASS.'
        );
    }

    return $out;
}

// ── Mail ────────────────────────────────────────────────────────────────────

/**
 * Probes SMTP the same way mailer.php does — real TLS connect, real AUTH LOGIN,
 * then QUIT without sending. Reports the exact stage that failed rather than
 * mailer.php's bare false.
 */
function diag_smtp_probe(): array
{
    $host = env('SMTP_HOST');
    $port = (int) env('SMTP_PORT', '465');
    $user = env('SMTP_USER');
    $pass = env('SMTP_PASS');

    if (!$host || !$user || !$pass) {
        $absent = [];
        foreach (['SMTP_HOST' => $host, 'SMTP_USER' => $user, 'SMTP_PASS' => $pass] as $k => $v) {
            if (!$v) {
                $absent[] = $k;
            }
        }
        return [DIAG_FAIL, 'not configured', 'Missing: ' . implode(', ', $absent)
            . '. smtp_submit() logs "not configured, skipped send" and returns false — the '
            . 'submission still succeeds, so this failure is invisible from the front end.'];
    }

    $fp = @stream_socket_client(
        "ssl://$host:$port",
        $errno,
        $errstr,
        10,
        STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]])
    );
    if (!$fp) {
        return [DIAG_FAIL, 'connect failed', "ssl://$host:$port — $errno $errstr. Shared hosts often "
            . 'block outbound 465/587 to third-party relays; Hostinger allows its own smtp.hostinger.com.'];
    }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        do {
            $line = fgets($fp, 1024);
            if ($line === false) {
                return '';
            }
        } while (isset($line[3]) && $line[3] === '-');
        return trim((string) $line);
    };
    $say = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };
    $code = fn(string $l): int => (int) substr($l, 0, 3);

    $stage = 'banner';
    $line = $read();
    if ($code($line) !== 220) {
        fclose($fp);
        return [DIAG_FAIL, 'rejected at ' . $stage, $line ?: 'no banner returned'];
    }

    $stage = 'EHLO';
    $say('EHLO ' . (parse_url(env('APP_URL', 'localhost'), PHP_URL_HOST) ?: 'localhost'));
    $line = $read();
    if ($code($line) !== 250) {
        fclose($fp);
        return [DIAG_FAIL, 'rejected at ' . $stage, $line];
    }

    $stage = 'AUTH LOGIN';
    $say('AUTH LOGIN');
    $line = $read();
    if ($code($line) !== 334) {
        fclose($fp);
        return [DIAG_FAIL, 'rejected at ' . $stage, $line . ' — server may not offer AUTH LOGIN on this port.'];
    }
    $say(base64_encode($user));
    $read();
    $say(base64_encode($pass));
    $line = $read();
    if ($code($line) !== 235) {
        $say('QUIT');
        fclose($fp);
        return [DIAG_FAIL, 'authentication refused', $line . ' — SMTP_USER/SMTP_PASS rejected by '
            . $host . '. This is the usual cause of "no emails are arriving".'];
    }

    $say('QUIT');
    fclose($fp);
    return [DIAG_OK, 'connect + auth OK', "Authenticated to $host:$port as $user. Delivery still "
        . 'depends on SPF/DKIM for the sending domain.'];
}

function diag_mail_checks(bool $probe = true): array
{
    $out = [];

    if (is_dev()) {
        $out[] = diag_row(
            'mail_mode',
            'Mail mode',
            DIAG_FAIL,
            'DEV — writing to dev-mail/*.eml',
            'Because APP_ENV is not "production", mail_send() never opens a socket. No email has '
              . 'been sent from this server. Fix APP_ENV first, then re-run this check.'
        );
        return $out;
    }

    $from = env('MAIL_FROM');
    $out[] = diag_row(
        'mail_from',
        'MAIL_FROM',
        $from ? DIAG_OK : DIAG_FAIL,
        $from ?? '(unset)',
        $from ? 'SPF/DKIM must be published for ' . substr(strrchr($from, '@') ?: '@?', 1) . '.'
              : 'Unset — env_require(MAIL_FROM) will 500 the send.'
    );

    $notify = env('ADMIN_NOTIFY_EMAIL');
    $out[] = diag_row(
        'admin_notify',
        'ADMIN_NOTIFY_EMAIL',
        $notify ? DIAG_OK : DIAG_FAIL,
        $notify ?? '(unset)',
        $notify
            ? 'You get a note on every new submission.'
            : 'Unset — submit.php skips the admin notification entirely. Applicants still get '
              . 'their receipt, but YOU get nothing. Set this to be told about new submissions.'
    );

    $out[] = diag_row(
        'smtp_creds',
        'SMTP credentials',
        env('SMTP_PASS') ? DIAG_OK : DIAG_FAIL,
        (env('SMTP_USER') ?? '(no user)') . ' @ ' . (env('SMTP_HOST') ?? '(no host)')
            . ':' . env('SMTP_PORT', '465') . '  pass=' . diag_mask(env('SMTP_PASS')),
        env('SMTP_PASS') ? '' : 'No password — every send is skipped silently.'
    );

    if ($probe) {
        [$state, $value, $note] = diag_smtp_probe();
        $out[] = diag_row('smtp_probe', 'SMTP live probe', $state, $value, $note);
    }

    return $out;
}

// ── Storage + housekeeping ──────────────────────────────────────────────────

function diag_other_checks(): array
{
    $out = [];

    $r2 = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
    $absent = array_values(array_filter($r2, fn($k) => env($k) === null));
    $out[] = diag_row(
        'r2',
        'Cloudflare R2',
        $absent ? DIAG_FAIL : DIAG_OK,
        $absent ? 'missing: ' . implode(', ', $absent) : 'bucket ' . env('R2_BUCKET'),
        $absent
            ? 'presign.php will 500 — applicants cannot upload media, which blocks submission '
              . 'for anyone whose application requires a file.'
            : ''
    );

    $admin = env('ADMIN_PASSWORD_HASH');
    $looksHashed = $admin !== null && str_starts_with($admin, '$2y$');
    $out[] = diag_row(
        'admin_login',
        'Admin credentials',
        $looksHashed ? DIAG_OK : DIAG_FAIL,
        (env('ADMIN_EMAIL') ?? '(no email)') . ' / ' . ($looksHashed ? 'bcrypt hash set' : 'no valid hash'),
        $looksHashed ? '' : 'ADMIN_PASSWORD_HASH must be a bcrypt hash, not a plaintext password.'
    );

    // The daily cron writes an audit row; its absence for >48h means it is not running.
    try {
        $last = db()->query(
            "SELECT MAX(created_at) FROM audit_log WHERE actor = 'system'"
        )->fetchColumn();
        $stale = !$last || strtotime((string) $last) < time() - 48 * 3600;
        $out[] = diag_row(
            'cron',
            'Maintenance cron',
            $last ? ($stale ? DIAG_WARN : DIAG_OK) : DIAG_WARN,
            $last ? 'last system action ' . $last . ' UTC' : 'never run',
            $stale
                ? 'No system audit entry in 48h. Expired magic links and stale drafts are not '
                  . 'being reaped. Add the daily hPanel cron: php ~/domains/<domain>/cron/maintenance.php'
                : ''
        );
    } catch (Throwable $e) {
        $out[] = diag_row('cron', 'Maintenance cron', DIAG_WARN, 'unknown', 'Could not read audit_log.');
    }

    return $out;
}

// ── Aggregate ───────────────────────────────────────────────────────────────

function diag_all(bool $probeSmtp = true): array
{
    return [
        'Environment' => diag_env_checks(),
        'Database' => diag_db_checks(),
        'Email' => diag_mail_checks($probeSmtp),
        'Storage & housekeeping' => diag_other_checks(),
    ];
}

/** Worst state across every group — drives the headline banner. */
function diag_verdict(array $groups): string
{
    $worst = DIAG_OK;
    $rank = [DIAG_INFO => 0, DIAG_OK => 0, DIAG_WARN => 1, DIAG_FAIL => 2];
    foreach ($groups as $rows) {
        foreach ($rows as $r) {
            if ($rank[$r['state']] > $rank[$worst]) {
                $worst = $r['state'];
            }
        }
    }
    return $worst;
}

/** Just the failing rows, for the "what to fix first" list. */
function diag_failures(array $groups): array
{
    $out = [];
    foreach ($groups as $group => $rows) {
        foreach ($rows as $r) {
            if ($r['state'] === DIAG_FAIL) {
                $out[] = $r + ['group' => $group];
            }
        }
    }
    return $out;
}

// ── Submission statistics ───────────────────────────────────────────────────

function diag_stats(): array
{
    $s = [
        'by_status' => [], 'by_type' => [], 'total' => 0, 'spam' => 0,
        'last_submitted' => null, 'last_touched' => null, 'first_created' => null,
        'submitted_24h' => 0, 'submitted_7d' => 0, 'submitted_30d' => 0,
        'drafts_by_step' => [], 'media_stored' => 0, 'daily' => [], 'error' => null,
    ];

    try {
        $pdo = db();

        foreach ($pdo->query('SELECT status, COUNT(*) n FROM applications WHERE is_spam = 0 GROUP BY status') as $r) {
            $s['by_status'][$r['status']] = (int) $r['n'];
        }
        foreach ($pdo->query('SELECT applicant_type, COUNT(*) n FROM applications WHERE is_spam = 0 GROUP BY applicant_type') as $r) {
            $s['by_type'][$r['applicant_type']] = (int) $r['n'];
        }
        $s['total'] = array_sum($s['by_status']);
        $s['spam'] = (int) $pdo->query('SELECT COUNT(*) FROM applications WHERE is_spam = 1')->fetchColumn();

        $s['last_submitted'] = $pdo->query('SELECT MAX(submitted_at) FROM applications')->fetchColumn() ?: null;
        $s['last_touched'] = $pdo->query('SELECT MAX(updated_at) FROM applications')->fetchColumn() ?: null;
        $s['first_created'] = $pdo->query('SELECT MIN(created_at) FROM applications')->fetchColumn() ?: null;

        foreach ([1 => 'submitted_24h', 7 => 'submitted_7d', 30 => 'submitted_30d'] as $days => $key) {
            $st = $pdo->prepare('SELECT COUNT(*) FROM applications WHERE submitted_at >= ?');
            $st->execute([gmdate('Y-m-d H:i:s', time() - $days * 86400)]);
            $s[$key] = (int) $st->fetchColumn();
        }

        // Where unfinished applicants stall — the funnel leak, step by step.
        foreach ($pdo->query(
            "SELECT current_step, COUNT(*) n FROM applications
             WHERE status = 'draft' AND is_spam = 0 GROUP BY current_step ORDER BY current_step"
        ) as $r) {
            $s['drafts_by_step'][(int) $r['current_step']] = (int) $r['n'];
        }

        $s['media_stored'] = (int) $pdo->query(
            "SELECT COUNT(*) FROM application_media WHERE status = 'stored'"
        )->fetchColumn();

        // 30-day sparkline: created vs submitted per day.
        $since = gmdate('Y-m-d', time() - 29 * 86400);
        $days = [];
        for ($i = 29; $i >= 0; $i--) {
            $days[gmdate('Y-m-d', time() - $i * 86400)] = ['created' => 0, 'submitted' => 0];
        }
        $st = $pdo->prepare('SELECT substr(created_at,1,10) d, COUNT(*) n FROM applications WHERE created_at >= ? GROUP BY d');
        $st->execute([$since]);
        foreach ($st as $r) {
            if (isset($days[$r['d']])) {
                $days[$r['d']]['created'] = (int) $r['n'];
            }
        }
        $st = $pdo->prepare('SELECT substr(submitted_at,1,10) d, COUNT(*) n FROM applications WHERE submitted_at >= ? GROUP BY d');
        $st->execute([$since]);
        foreach ($st as $r) {
            if (isset($days[$r['d']])) {
                $days[$r['d']]['submitted'] = (int) $r['n'];
            }
        }
        $s['daily'] = $days;
    } catch (Throwable $e) {
        $s['error'] = $e->getMessage();
    }

    return $s;
}

/** Most recent audit entries, newest first — the "is anything happening at all" feed. */
function diag_recent_activity(int $limit = 25): array
{
    try {
        $st = db()->prepare(
            'SELECT l.created_at, l.actor, l.action, l.meta, a.public_name, a.public_id
             FROM audit_log l LEFT JOIN applications a ON a.id = l.application_id
             ORDER BY l.id DESC LIMIT ' . max(1, min(200, $limit))
        );
        $st->execute();
        return $st->fetchAll();
    } catch (Throwable $e) {
        return [];
    }
}
