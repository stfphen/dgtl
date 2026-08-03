<?php
/**
 * POST /api/submit.php — final submission.
 * { public_id, draft_token, fields:{ ...step-5 + closing consents... } }
 * → { ok, public_id, status:"submitted" } | 422 with a fields map.
 *
 * The server writes the canonical licence strings itself — the client cannot
 * alter them — and the four consents are set only from explicit booleans.
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/mailer.php';

$body = require_json_post();
rate_limit('submit', 'ip|' . client_ip(), 5);
$app = app_auth($body);
app_require_editable($app);

if ($app['is_spam']) {
    json_out(['ok' => true, 'public_id' => $app['public_id'], 'status' => 'submitted']); // fake it
}

$input = is_array($body['fields'] ?? null) ? $body['fields'] : [];
unset($input['applicant_type']);
$type = $app['applicant_type'];

[$errors, $clean] = validate_step($type, 5, $input);
if ($errors) {
    fail(422, 'validation', 'Some fields need attention.', $errors);
}
$payload = array_merge(app_payload($app), $clean);

$storedUploads = app_media_count((int) $app['id'], 'upload', ['stored']);
$fullErrors = validate_full($type, $payload, $storedUploads);
if ($fullErrors) {
    fail(422, 'validation', 'A few things are missing before you can submit.', $fullErrors);
}

// Canonical licence terms — displayed to the applicant, written by the server.
$payload['licence_scope'] = LICENCE_SCOPE;
$payload['licence_territory'] = LICENCE_TERRITORY;
$payload['licence_term'] = LICENCE_TERM;

// Consents from explicit booleans only; AI opt-out defaults ON.
$consents = [
    'consent_marketing_email' => $payload['consent_marketing_email'] ?? false,
    'consent_survey_panel' => $payload['consent_survey_panel'] ?? false,
    'consent_broadcast' => $payload['broadcast_ok'] ?? false,
    'ai_training_optout' => $payload['ai_training_optout'] ?? true,
];
$payload['ai_training_optout'] = $consents['ai_training_optout'];

$rev = (int) $app['payload_rev'] + 1;
db()->prepare(
    "UPDATE applications SET
        payload = ?, payload_rev = ?, status = 'submitted', submitted_at = ?,
        email = ?, public_name = ?, primary_category = ?,
        consent_marketing_email = ?, consent_survey_panel = ?, consent_broadcast = ?,
        ai_training_optout = ?, signature_name = ?, signature_ip = ?, signature_at = ?,
        terms_version = ?, updated_at = ?
     WHERE id = ?"
)->execute([
    json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $rev, now(),
    $payload['email'], $payload['public_name'], $payload['primary_category'],
    (int) $consents['consent_marketing_email'], (int) $consents['consent_survey_panel'],
    (int) $consents['consent_broadcast'], (int) $consents['ai_training_optout'],
    $payload['signature_name'], client_ip(), now(),
    env_require('TERMS_VERSION'), now(), $app['id'],
]);

// Reap any never-confirmed uploads so retries don't count against caps.
db()->prepare(
    "UPDATE application_media SET status = 'deleted', updated_at = ?
     WHERE application_id = ? AND status = 'pending'"
)->execute([now(), $app['id']]);

audit((int) $app['id'], 'applicant', 'submit', [
    'terms_version' => env('TERMS_VERSION'),
    'consents' => array_map('intval', $consents),
]);

mail_submission_receipt($payload['email'], $payload['public_name'] ?: 'there', $app['public_id']);
if (($admin = env('ADMIN_NOTIFY_EMAIL')) !== null) {
    mail_send(
        $admin,
        'New intake submission: ' . $payload['public_name'] . " ($type)",
        'Review it: ' . rtrim(env('APP_URL', ''), '/') . '/admin/application.php?id=' . $app['public_id']
    );
}

json_out(['ok' => true, 'public_id' => $app['public_id'], 'status' => 'submitted']);
