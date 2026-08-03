<?php
/** 302 → 15-minute presigned GET for one media object. Never cache signed URLs in HTML. */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/r2.php';

admin_require();

$st = db()->prepare('SELECT * FROM application_media WHERE id = ?');
$st->execute([(int) ($_GET['id'] ?? 0)]);
$media = $st->fetch();
if (!$media || !$media['r2_key'] || $media['status'] !== 'stored') {
    http_response_code(404);
    exit('Not found');
}
header('Location: ' . r2_presign('GET', $media['r2_key'], 900), true, 302);
