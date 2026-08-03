<?php
defined('APP') or exit;

/**
 * Fixed-window rate limiter on the rate_limits table. Portable SQL only
 * (no ON DUPLICATE KEY) — a lost increment under race is acceptable here.
 * Fails the request with 429 when the bucket is over.
 */
function rate_limit(string $action, string $key, int $max, int $windowSec = 3600): void
{
    $bucket = $action . '|' . $key;
    if (strlen($bucket) > 160) {
        $bucket = $action . '|h:' . hash('sha256', $key);
    }
    $now = time();
    $db = db();

    $row = $db->prepare('SELECT window_start, hits FROM rate_limits WHERE bucket = ?');
    $row->execute([$bucket]);
    $r = $row->fetch();

    if (!$r || ($now - (int) $r['window_start']) >= $windowSec) {
        try {
            if ($r) {
                $db->prepare('UPDATE rate_limits SET window_start = ?, hits = 1 WHERE bucket = ?')
                    ->execute([$now, $bucket]);
            } else {
                $db->prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)')
                    ->execute([$bucket, $now]);
            }
        } catch (PDOException) {
            // concurrent insert — treat as one hit and move on
        }
        return;
    }

    if ((int) $r['hits'] >= $max) {
        header('Retry-After: ' . max(1, $windowSec - ($now - (int) $r['window_start'])));
        fail(429, 'rate_limited', 'Too many requests — try again shortly.');
    }
    $db->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE bucket = ?')->execute([$bucket]);
}
