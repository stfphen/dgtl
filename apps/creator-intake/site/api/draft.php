<?php
/**
 * POST /api/draft.php — create or update the application draft.
 *
 * Create (no public_id): { step, hp_website, fields:{...} }
 *   → 201 { ok, public_id, draft_token, payload_rev }   draft_token returned ONCE.
 * Update: same + { public_id, draft_token, base_rev? }
 *   → 200 { ok, payload_rev }  |  409 { error:"conflict", server_rev, payload }
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';

$body = require_json_post();

$step = (int) ($body['step'] ?? 0);
if ($step < 1 || $step > 5) {
    fail(400, 'bad_step');
}
$input = is_array($body['fields'] ?? null) ? $body['fields'] : [];

// Honeypot: a filled hp_website means a bot. Fake success, learn nothing.
$isSpam = !empty($body['hp_website']);

if (empty($body['public_id'])) {
    // ── Create ──────────────────────────────────────────────────────────────
    rate_limit('draft_create', 'ip|' . client_ip(), 10);

    $type = $input['applicant_type'] ?? '';
    if (!in_array($type, APPLICANT_TYPES, true)) {
        fail(422, 'validation', 'Pick creator or brand to start.', ['applicant_type' => 'Required.']);
    }
    [$errors, $clean] = validate_step($type, $step, $input);
    if ($errors) {
        fail(422, 'validation', 'Some fields need attention.', $errors);
    }

    $publicId = uuidv4();
    $token = token_new();
    db()->prepare(
        'INSERT INTO applications
            (public_id, applicant_type, email, public_name, primary_category, status,
             current_step, payload, payload_rev, client_token_hash, is_spam, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)'
    )->execute([
        $publicId, $type,
        $clean['email'] ?? '', $clean['public_name'] ?? null, $clean['primary_category'] ?? null,
        'draft', $step,
        json_encode($clean, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        token_hash($token), $isSpam ? 1 : 0, now(), now(),
    ]);
    $appId = (int) db()->lastInsertId();
    audit($appId, 'applicant', 'draft.create', ['step' => $step, 'type' => $type]);

    json_out(['ok' => true, 'public_id' => $publicId, 'draft_token' => $token, 'payload_rev' => 1], 201);
}

// ── Update ──────────────────────────────────────────────────────────────────
$app = app_auth($body);
rate_limit('draft_update', 'app|' . $app['public_id'], 120);
app_require_editable($app);

if ($app['is_spam']) {
    json_out(['ok' => true, 'payload_rev' => (int) $app['payload_rev'] + 1]); // fake it
}

// applicant_type is fixed at creation — silently ignore attempts to change it.
unset($input['applicant_type']);

[$errors, $clean] = validate_step($app['applicant_type'], $step, $input);
if ($errors) {
    fail(422, 'validation', 'Some fields need attention.', $errors);
}

if (isset($body['base_rev']) && (int) $body['base_rev'] !== (int) $app['payload_rev']) {
    json_out([
        'ok' => false, 'error' => 'conflict',
        'server_rev' => (int) $app['payload_rev'],
        'payload' => app_payload($app),
    ], 409);
}

$payload = array_merge(app_payload($app), $clean);
$rev = app_save_payload($app, $payload, $step);
audit((int) $app['id'], 'applicant', 'draft.save', ['step' => $step, 'fields' => array_keys($clean)]);

json_out(['ok' => true, 'payload_rev' => $rev]);
