<?php
defined('APP') or exit;

/** JSON response and exit. */
function json_out(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $error, string $message = '', array $fields = []): never
{
    $out = ['ok' => false, 'error' => $error];
    if ($message !== '') {
        $out['message'] = $message;
    }
    if ($fields) {
        $out['fields'] = $fields;
    }
    json_out($out, $code);
}

/**
 * Guard a public JSON endpoint: POST only, JSON content type, and — if the
 * browser sent Origin/Referer — it must match APP_URL's host. The API sets no
 * CORS headers at all, so cross-origin reads are blocked by default; auth is a
 * bearer draft_token, not a cookie, so classic CSRF does not apply. This check
 * is belt-and-braces.
 */
function require_json_post(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        fail(405, 'method_not_allowed');
    }
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') === false) {
        fail(415, 'json_required');
    }

    $expected = parse_url(env('APP_URL', ''), PHP_URL_HOST);
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        if ($expected && !empty($_SERVER[$h])) {
            $got = parse_url($_SERVER[$h], PHP_URL_HOST);
            if ($got !== null && !hash_equals($expected, (string) $got)) {
                fail(403, 'bad_origin');
            }
        }
    }

    $raw = file_get_contents('php://input', length: 4 * 1024 * 1024);
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        fail(400, 'bad_json');
    }
    return $body;
}

/**
 * Client IP. REMOTE_ADDR by default. Behind a proxy that overwrites/appends
 * the forwarding headers, opt in explicitly:
 *   TRUST_CF_HEADER=1 — Cloudflare proxy (CF-Connecting-IP)
 *   TRUST_XFF=1       — Hostinger CDN (last X-Forwarded-For entry; the CDN
 *                       appends the address it actually saw, so the last hop
 *                       is real even if the client sent a forged header)
 */
function client_ip(): string
{
    if (env('TRUST_CF_HEADER') === '1' && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        return substr($_SERVER['HTTP_CF_CONNECTING_IP'], 0, 45);
    }
    if (env('TRUST_XFF') === '1' && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $hops = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
        $last = end($hops);
        if (filter_var($last, FILTER_VALIDATE_IP)) {
            return substr($last, 0, 45);
        }
    }
    return substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 45);
}
