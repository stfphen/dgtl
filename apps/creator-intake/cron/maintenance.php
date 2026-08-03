<?php
/**
 * Daily maintenance — run from Hostinger hPanel cron (CLI only):
 *   php /home/<user>/domains/join.dgtlinfluence.com/public_html/../cron/maintenance.php
 * (deploy.sh uploads this file to ~/domains/<host>/cron/maintenance.php,
 * beside public_html, so it is never web-reachable.)
 *
 * - expires old magic links and rate-limit rows
 * - reaps media rows stuck in 'pending' for >48h (deletes the R2 object too)
 * - purges draft applications untouched for >90 days (rows cascade; R2 purged)
 */
if (php_sapi_name() !== 'cli') {
    exit('cli only');
}
define('APP', true);

foreach ([
    __DIR__ . '/../public_html/lib/bootstrap.php',   // production layout
    __DIR__ . '/../site/lib/bootstrap.php',          // repo layout (local runs)
] as $bootstrap) {
    if (is_readable($bootstrap)) {
        require $bootstrap;
        require dirname($bootstrap) . '/r2.php';
        require dirname($bootstrap) . '/audit.php';
        break;
    }
}
if (!function_exists('db')) {
    exit("bootstrap not found\n");
}

$now = now();
$db = db();

// 1. dead magic links + stale rate buckets
$db->prepare('DELETE FROM magic_links WHERE expires_at < ?')->execute([$now]);
$db->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([time() - 86400]);

// 2. pending uploads older than 48h
$st = $db->prepare(
    "SELECT id, application_id, r2_key FROM application_media
     WHERE status = 'pending' AND created_at < ?"
);
$st->execute([gmdate('Y-m-d H:i:s', time() - 48 * 3600)]);
$reaped = 0;
foreach ($st->fetchAll() as $m) {
    if ($m['r2_key']) {
        r2_delete($m['r2_key']);
    }
    $db->prepare("UPDATE application_media SET status = 'deleted', updated_at = ? WHERE id = ?")
        ->execute([$now, $m['id']]);
    $reaped++;
}

// 3. abandoned drafts (>90 days untouched, never submitted)
$st = $db->prepare(
    "SELECT id, public_id FROM applications
     WHERE status = 'draft' AND updated_at < ?"
);
$st->execute([gmdate('Y-m-d H:i:s', time() - 90 * 86400)]);
$purged = 0;
foreach ($st->fetchAll() as $app) {
    $media = $db->prepare('SELECT r2_key FROM application_media WHERE application_id = ?');
    $media->execute([$app['id']]);
    foreach ($media->fetchAll() as $m) {
        if ($m['r2_key']) {
            r2_delete($m['r2_key']);
        }
    }
    audit((int) $app['id'], 'system', 'purge.draft', [], 'cron');
    $db->prepare('DELETE FROM applications WHERE id = ?')->execute([$app['id']]); // media rows cascade
    $purged++;
}

echo gmdate('c') . " maintenance: reaped=$reaped pending uploads, purged=$purged stale drafts\n";
