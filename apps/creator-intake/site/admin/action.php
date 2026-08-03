<?php
/** POST approve | reject | request_more. CSRF-guarded, audited, emails the applicant. */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/mailer.php';

admin_require();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: index.php');
    exit;
}
csrf_check();

$app = app_find_by_public_id($_POST['id'] ?? '');
$action = $_POST['action'] ?? '';
$note = trim($_POST['note'] ?? '');

if (!$app || !in_array($action, ['approve', 'reject', 'request_more'], true)) {
    http_response_code(400);
    exit('Bad request');
}
if (!in_array($app['status'], ['submitted', 'in_review', 'more_info'], true)) {
    http_response_code(409);
    exit('This application is not in a reviewable state.');
}

$newStatus = ['approve' => 'approved', 'reject' => 'rejected', 'request_more' => 'more_info'][$action];

db()->prepare(
    'UPDATE applications SET status = ?, review_note = ?, reviewed_at = ?, updated_at = ? WHERE id = ?'
)->execute([$newStatus, $note !== '' ? $note : $app['review_note'], now(), now(), $app['id']]);

$resumeUrl = null;
if ($action === 'request_more') {
    $token = token_new();
    db()->prepare(
        'INSERT INTO magic_links (application_id, token_hash, expires_at, created_ip, created_at)
         VALUES (?, ?, ?, ?, ?)'
    )->execute([
        $app['id'], token_hash($token), gmdate('Y-m-d H:i:s', time() + 7 * 86400), client_ip(), now(),
    ]);
    $resumeUrl = rtrim(env('APP_URL', ''), '/') . '/apply.html?resume=' . $token;
}

audit((int) $app['id'], 'admin', 'admin.' . $action, ['note_len' => strlen($note)]);
mail_review_outcome(
    $app['email'],
    $app['public_name'] ?: 'there',
    $newStatus === 'more_info' ? 'request_more' : $newStatus,
    $note,
    $resumeUrl
);

header('Location: application.php?id=' . urlencode($app['public_id']), true, 303);
