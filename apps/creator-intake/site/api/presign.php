<?php
/**
 * POST /api/presign.php — request a presigned R2 PUT for one file.
 * { public_id, draft_token, kind: "upload"|"analytics_screenshot",
 *   filename, mime, bytes }
 * → { ok, media_id, upload_url, method:"PUT", headers:{Content-Type}, expires_in }
 *
 * A presigned PUT cannot cap size server-side; the claimed size is checked
 * here and the REAL size/type is verified by confirm-upload.php via HEAD.
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/r2.php';

$body = require_json_post();
$app = app_auth($body);
rate_limit('presign', 'app|' . $app['public_id'], 40);
app_require_editable($app);

if ($app['is_spam']) {
    fail(403, 'bad_token'); // spam records get no storage
}

$kind = $body['kind'] ?? 'upload';
if (!in_array($kind, ['upload', 'analytics_screenshot'], true)) {
    fail(400, 'bad_kind');
}
$filename = is_string($body['filename'] ?? null) ? $body['filename'] : '';
$mime = is_string($body['mime'] ?? null) ? strtolower(trim($body['mime'])) : '';
$bytes = (int) ($body['bytes'] ?? 0);

if ($bytes < 1 || $bytes > MAX_MEDIA_BYTES) {
    fail(413, 'too_large', 'Files can be up to 200MB each.');
}
if (!isset(MIME_WHITELIST[$mime])) {
    fail(415, 'bad_type', 'Allowed: images, video (mp4/mov/webm), audio.');
}
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
if (!in_array($ext, MIME_WHITELIST[$mime], true)) {
    fail(415, 'ext_mismatch', 'The file extension does not match its type.');
}
if ($kind === 'analytics_screenshot' && !str_starts_with($mime, 'image/')) {
    fail(415, 'bad_type', 'Analytics screenshots must be images.');
}

$cap = $kind === 'upload' ? MAX_MEDIA_FILES : MAX_ANALYTICS_SHOTS;
if (app_media_count((int) $app['id'], $kind, ['pending', 'stored']) >= $cap) {
    fail(409, 'file_cap', "Up to $cap files here — remove one first.");
}

$base = substr(preg_replace('/[^a-z0-9._-]+/', '-', strtolower(pathinfo($filename, PATHINFO_FILENAME))), 0, 80);
$key = sprintf('applications/%s/%s/%s-%s.%s', $app['public_id'], $kind, uuidv4(), $base ?: 'file', $ext);

db()->prepare(
    'INSERT INTO application_media
        (application_id, kind, r2_key, title, mime, bytes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
)->execute([
    $app['id'], $kind, $key, $filename !== '' ? mb_substr($filename, 0, 300) : null,
    $mime, $bytes, 'pending', now(), now(),
]);
$mediaId = (int) db()->lastInsertId();
audit((int) $app['id'], 'applicant', 'upload.presign', ['media_id' => $mediaId, 'kind' => $kind, 'mime' => $mime]);

json_out([
    'ok' => true,
    'media_id' => $mediaId,
    'upload_url' => r2_presign('PUT', $key, 3600, $mime),
    'method' => 'PUT',
    'headers' => ['Content-Type' => $mime],
    'expires_in' => 3600,
]);
