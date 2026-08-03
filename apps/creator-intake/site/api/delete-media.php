<?php
/**
 * POST /api/delete-media.php — applicant removes one of their own files.
 * { public_id, draft_token, media_id } → { ok }
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/r2.php';

$body = require_json_post();
$app = app_auth($body);
rate_limit('delete_media', 'app|' . $app['public_id'], 60);
app_require_editable($app);

$mediaId = (int) ($body['media_id'] ?? 0);
$st = db()->prepare(
    "SELECT * FROM application_media
     WHERE id = ? AND application_id = ? AND status IN ('pending','stored')"
);
$st->execute([$mediaId, $app['id']]);
$media = $st->fetch();
if (!$media) {
    fail(404, 'media_not_found');
}

if ($media['r2_key']) {
    r2_delete($media['r2_key']);
}
db()->prepare("UPDATE application_media SET status = 'deleted', updated_at = ? WHERE id = ?")
    ->execute([now(), $mediaId]);
audit((int) $app['id'], 'applicant', 'upload.delete', ['media_id' => $mediaId]);

json_out(['ok' => true]);
