<?php
/**
 * POST /api/magic-link.php — email a resume link.
 * { email } → always 200 { ok:true } (no account enumeration).
 * In dev the link is echoed back under "debug".
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/mailer.php';

$body = require_json_post();
rate_limit('magic_ip', 'ip|' . client_ip(), 5);

$email = is_string($body['email'] ?? null) ? strtolower(trim($body['email'])) : '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_out(['ok' => true]); // same shape as success
}
rate_limit('magic_email', 'em|' . hash('sha256', $email), 3);

$st = db()->prepare(
    "SELECT * FROM applications
     WHERE email = ? AND is_spam = 0 AND status IN ('draft','more_info')
     ORDER BY updated_at DESC LIMIT 1"
);
$st->execute([$email]);
$app = $st->fetch();

$debug = null;
if ($app) {
    $token = token_new();
    db()->prepare(
        'INSERT INTO magic_links (application_id, token_hash, expires_at, created_ip, created_at)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([
        $app['id'], token_hash($token), gmdate('Y-m-d H:i:s', time() + 7 * 86400), client_ip(), now(),
    ]);
    $url = rtrim(env('APP_URL', ''), '/') . '/apply.html?resume=' . $token;
    mail_magic_link($email, $url);
    audit((int) $app['id'], 'applicant', 'magic.request');
    if (is_dev()) {
        $debug = ['resume_url' => $url];
    }
}

json_out(['ok' => true] + ($debug ? ['debug' => $debug] : []));
