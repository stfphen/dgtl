<?php
defined('APP') or exit;

/**
 * Minimal .env loader. Search order:
 *   1. one level above the webroot (production: ~/domains/<host>/.env, outside public_html)
 *   2. the app root, apps/creator-intake/.env (local dev)
 */
function env_load(): array
{
    static $vars = null;
    if ($vars !== null) {
        return $vars;
    }
    $candidates = [];
    if (defined('ENV_FILE')) {
        $candidates[] = ENV_FILE; // tests pin their own env file
    }
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $candidates[] = dirname($_SERVER['DOCUMENT_ROOT']) . '/.env';
    }
    $candidates[] = dirname(__DIR__, 2) . '/.env'; // apps/creator-intake/.env

    $vars = [];
    foreach ($candidates as $path) {
        if (!is_readable($path)) {
            continue;
        }
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v);
            // Strip surrounding quotes and a trailing inline comment on unquoted values.
            if ($v !== '' && ($v[0] === '"' || $v[0] === "'")) {
                $v = trim($v, $v[0]);
            } elseif (($pos = strpos($v, ' #')) !== false) {
                $v = rtrim(substr($v, 0, $pos));
            }
            $vars[$k] = $v;
        }
        break; // first readable file wins
    }
    return $vars;
}

function env(string $key, ?string $default = null): ?string
{
    $vars = env_load();
    return array_key_exists($key, $vars) && $vars[$key] !== '' ? $vars[$key] : $default;
}

/** Fail fast on endpoints that cannot run without a key (e.g. R2, SMTP in prod). */
function env_require(string $key): string
{
    $v = env($key);
    if ($v === null) {
        error_log("creator-intake: missing required env $key");
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'error' => 'server_misconfigured']);
        exit;
    }
    return $v;
}
