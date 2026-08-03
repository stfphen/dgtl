<?php
/**
 * POST /api/confirm-upload.php — verify an uploaded object and attach metadata.
 * { public_id, draft_token, media_id, title, credit, date_created, is_owner,
 *   third_party_credits }
 * → { ok, media_id, bytes, mime }
 *
 * The signed HEAD here is the authoritative size/type gate: objects over
 * 200MB or with a mismatched Content-Type are deleted and the row rejected.
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/r2.php';

$body = require_json_post();
$app = app_auth($body);
rate_limit('confirm', 'app|' . $app['public_id'], 60);
app_require_editable($app);

$mediaId = (int) ($body['media_id'] ?? 0);
$st = db()->prepare('SELECT * FROM application_media WHERE id = ? AND application_id = ?');
$st->execute([$mediaId, $app['id']]);
$media = $st->fetch();
if (!$media || !$media['r2_key']) {
    fail(404, 'media_not_found');
}
if ($media['status'] === 'stored') {
    json_out(['ok' => true, 'media_id' => $mediaId, 'bytes' => (int) $media['bytes'], 'mime' => $media['mime']]);
}
if ($media['status'] !== 'pending') {
    fail(409, 'media_rejected');
}

$head = r2_head($media['r2_key']);
if ($head === null) {
    fail(409, 'not_uploaded', 'The file has not finished uploading — retry the upload.');
}
if ($head['bytes'] > MAX_MEDIA_BYTES) {
    r2_delete($media['r2_key']);
    db()->prepare("UPDATE application_media SET status = 'rejected', updated_at = ? WHERE id = ?")
        ->execute([now(), $mediaId]);
    audit((int) $app['id'], 'applicant', 'upload.rejected', ['media_id' => $mediaId, 'reason' => 'size']);
    fail(413, 'too_large', 'The uploaded file is over 200MB.');
}
$mimeBase = strtolower(trim(explode(';', $head['mime'])[0]));
if ($mimeBase !== $media['mime']) {
    r2_delete($media['r2_key']);
    db()->prepare("UPDATE application_media SET status = 'rejected', updated_at = ? WHERE id = ?")
        ->execute([now(), $mediaId]);
    audit((int) $app['id'], 'applicant', 'upload.rejected', ['media_id' => $mediaId, 'reason' => 'type']);
    fail(415, 'type_mismatch', 'The uploaded file type does not match what was declared.');
}

$title = is_string($body['title'] ?? null) ? mb_substr(trim($body['title']), 0, 300) : $media['title'];
$credit = is_string($body['credit'] ?? null) ? mb_substr(trim($body['credit']), 0, 300) : null;
$date = is_string($body['date_created'] ?? null) ? mb_substr(trim($body['date_created']), 0, 32) : null;
$isOwner = array_key_exists('is_owner', $body) ? (bool) $body['is_owner'] : null;
$thirdParty = is_string($body['third_party_credits'] ?? null)
    ? mb_substr(trim($body['third_party_credits']), 0, 1000) : null;

db()->prepare(
    "UPDATE application_media
     SET status = 'stored', bytes = ?, title = ?, credit = ?, date_created = ?,
         is_owner = ?, third_party_credits = ?, updated_at = ?
     WHERE id = ?"
)->execute([
    $head['bytes'], $title, $credit, $date,
    $isOwner === null ? null : (int) $isOwner, $thirdParty, now(), $mediaId,
]);
audit((int) $app['id'], 'applicant', 'upload.confirm', ['media_id' => $mediaId, 'bytes' => $head['bytes']]);

json_out(['ok' => true, 'media_id' => $mediaId, 'bytes' => $head['bytes'], 'mime' => $media['mime']]);
