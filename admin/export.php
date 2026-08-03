<?php
/**
 * Download the export JSON for an APPROVED application — the contract the
 * Mac-side generators consume (journal pack builder, media kits, portfolio
 * pages). Media carries both r2_key (for tooling with its own credentials)
 * and a 7-day presigned GET (SigV4 max TTL).
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/audit.php';
require __DIR__ . '/../lib/r2.php';

admin_require();

$app = app_find_by_public_id($_GET['id'] ?? '');
if (!$app) {
    http_response_code(404);
    exit('Not found');
}
if ($app['status'] !== 'approved') {
    http_response_code(409);
    exit('Only approved applications export.');
}

$st = db()->prepare(
    "SELECT * FROM application_media WHERE application_id = ? AND status = 'stored' ORDER BY kind, id"
);
$st->execute([$app['id']]);

$media = array_map(function (array $m) {
    return [
        'kind' => $m['kind'],
        'title' => $m['title'],
        'credit' => $m['credit'],
        'date_created' => $m['date_created'],
        'is_owner' => $m['is_owner'] === null ? null : (bool) $m['is_owner'],
        'third_party_credits' => $m['third_party_credits'],
        'mime' => $m['mime'],
        'bytes' => (int) $m['bytes'],
        'r2_key' => $m['r2_key'],
        'url' => $m['r2_key'] ? r2_presign('GET', $m['r2_key'], 604800) : $m['url'],
    ];
}, $st->fetchAll());

$slug = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $app['public_name'] ?? ''), '-'));

$export = [
    'export_version' => 1,
    'exported_at' => gmdate('c'),
    'slug_suggestion' => $slug ?: 'creator-' . substr($app['public_id'], 0, 8),
    'application' => [
        'public_id' => $app['public_id'],
        'applicant_type' => $app['applicant_type'],
        'status' => $app['status'],
        'submitted_at' => $app['submitted_at'],
        'terms_version' => $app['terms_version'],
        'signature' => [
            'name' => $app['signature_name'],
            'ip' => $app['signature_ip'],
            'at' => $app['signature_at'],
        ],
        'consents' => [
            'marketing_email' => (bool) $app['consent_marketing_email'],
            'survey_panel' => (bool) $app['consent_survey_panel'],
            'broadcast' => (bool) $app['consent_broadcast'],
            'ai_training_optout' => (bool) $app['ai_training_optout'],
        ],
        'fields' => app_payload($app),
    ],
    'media' => $media,
];

audit((int) $app['id'], 'admin', 'admin.export');

header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="dgtl-intake-' . $app['public_id'] . '.json"');
echo json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
