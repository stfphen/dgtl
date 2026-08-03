<?php
/**
 * POST /api/resume.php — redeem a magic link.
 * { token } → { ok, public_id, draft_token, status, current_step, payload_rev,
 *               payload, media[] }
 * Single-use: the link is burned and a fresh draft_token is issued.
 * 410 on invalid/expired so the front-end can offer a fresh link.
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';

$body = require_json_post();
rate_limit('resume', 'ip|' . client_ip(), 10);

$token = is_string($body['token'] ?? null) ? $body['token'] : '';
if ($token === '') {
    fail(410, 'link_expired');
}

$st = db()->prepare('SELECT * FROM magic_links WHERE token_hash = ?');
$st->execute([token_hash($token)]);
$link = $st->fetch();

if (!$link || $link['used_at'] !== null || $link['expires_at'] < now()) {
    fail(410, 'link_expired', 'That link has expired — request a fresh one.');
}

$st = db()->prepare('SELECT * FROM applications WHERE id = ?');
$st->execute([$link['application_id']]);
$app = $st->fetch();
if (!$app || $app['is_spam']) {
    fail(410, 'link_expired');
}

// Burn the link, rotate the bearer token.
$newToken = token_new();
db()->prepare('UPDATE magic_links SET used_at = ? WHERE id = ?')->execute([now(), $link['id']]);
db()->prepare('UPDATE applications SET client_token_hash = ?, updated_at = ? WHERE id = ?')
    ->execute([token_hash($newToken), now(), $app['id']]);
audit((int) $app['id'], 'applicant', 'magic.redeem');

json_out([
    'ok' => true,
    'public_id' => $app['public_id'],
    'draft_token' => $newToken,
    'status' => $app['status'],
    'current_step' => (int) $app['current_step'],
    'payload_rev' => (int) $app['payload_rev'],
    'payload' => app_payload($app),
    'media' => app_media_public((int) $app['id']),
]);
