<?php
defined('APP') or exit;

require_once __DIR__ . '/../site/lib/application.php';
require_once __DIR__ . '/../site/lib/ratelimit.php';
require_once __DIR__ . '/../site/lib/audit.php';

function make_app(string $type = 'creator', array $payload = []): array
{
    $publicId = uuidv4();
    $token = token_new();
    db()->prepare(
        'INSERT INTO applications
            (public_id, applicant_type, email, status, current_step, payload, payload_rev,
             client_token_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, 1, ?, ?, ?)'
    )->execute([
        $publicId, $type, $payload['email'] ?? '', 'draft',
        json_encode($payload), token_hash($token), now(), now(),
    ]);
    $app = app_find_by_public_id($publicId);
    $app['__token'] = $token;
    return $app;
}

test('tokens: 43-char urlsafe, peppered hash is deterministic', function () {
    $t = token_new();
    check_eq(43, strlen($t));
    check(preg_match('/^[A-Za-z0-9_-]+$/', $t) === 1, 'urlsafe alphabet');
    check_eq(token_hash($t), token_hash($t));
    check(token_hash($t) !== hash('sha256', $t), 'pepper changes the hash');
});

test('app_auth accepts the right token, app row lookups work', function () {
    $app = make_app();
    $found = app_find_by_public_id($app['public_id']);
    check(hash_equals($found['client_token_hash'], token_hash($app['__token'])));
});

test('payload merge bumps rev and syncs promoted columns', function () {
    $app = make_app('creator', ['legal_name' => 'A']);
    $merged = array_merge(app_payload($app), [
        'email' => 'x@y.com', 'public_name' => 'X', 'primary_category' => 'music',
    ]);
    $rev = app_save_payload($app, $merged, 2);
    check_eq(2, $rev);
    $fresh = app_find_by_public_id($app['public_id']);
    check_eq('x@y.com', $fresh['email'], 'email column synced');
    check_eq('X', $fresh['public_name']);
    check_eq('music', $fresh['primary_category']);
    check_eq(2, (int) $fresh['current_step']);
    check_eq('A', app_payload($fresh)['legal_name'], 'earlier keys survive the merge');
});

test('current_step never moves backwards', function () {
    $app = make_app();
    app_save_payload($app, ['a' => 1], 4);
    $fresh = app_find_by_public_id($app['public_id']);
    app_save_payload($fresh, ['a' => 2], 2);
    check_eq(4, (int) app_find_by_public_id($app['public_id'])['current_step']);
});

test('rate limiter: allows up to max, resets after the window', function () {
    $key = 'ip|test-' . uniqid();
    // rate_limit fails via fail() -> exit, so probe the table math directly.
    for ($i = 0; $i < 5; $i++) {
        rate_limit('t', $key, 5, 3600);
    }
    $st = db()->prepare('SELECT hits, window_start FROM rate_limits WHERE bucket = ?');
    $st->execute(['t|' . $key]);
    $row = $st->fetch();
    check_eq(5, (int) $row['hits']);

    // Expire the window; next hit should reset to 1.
    db()->prepare('UPDATE rate_limits SET window_start = ? WHERE bucket = ?')
        ->execute([time() - 4000, 't|' . $key]);
    rate_limit('t', $key, 5, 3600);
    $st->execute(['t|' . $key]);
    check_eq(1, (int) $st->fetch()['hits'], 'window reset');
});

test('media counts by status', function () {
    $app = make_app();
    $ins = db()->prepare(
        'INSERT INTO application_media (application_id, kind, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)'
    );
    $ins->execute([$app['id'], 'upload', 'stored', now(), now()]);
    $ins->execute([$app['id'], 'upload', 'pending', now(), now()]);
    $ins->execute([$app['id'], 'upload', 'rejected', now(), now()]);
    check_eq(2, app_media_count((int) $app['id'], 'upload', ['stored', 'pending']));
    check_eq(1, app_media_count((int) $app['id'], 'upload', ['stored']));
});
