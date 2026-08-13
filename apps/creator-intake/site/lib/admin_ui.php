<?php
defined('APP') or exit;

/** Shared chrome for the PHP-rendered admin pages. */

function e(?string $s): string
{
    return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8');
}

function admin_head(string $title): void
{
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:");
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow">'
        . '<title>' . e($title) . ' — DGTL Intake Admin</title>'
        . '<link rel="preconnect" href="https://fonts.googleapis.com">'
        . '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        . '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
        . '<link rel="icon" href="../assets/img/spark.svg" type="image/svg+xml">'
        . '<link rel="stylesheet" href="../assets/intake.css"></head><body>';
}

/** @param string $active which nav item to mark current: queue|status */
function admin_nav(string $active = 'queue'): void
{
    $link = function (string $key, string $href, string $label) use ($active): string {
        $style = $key === $active ? ' style="color:var(--gold)"' : '';
        $aria = $key === $active ? ' aria-current="page"' : '';
        return '<a class="plain" href="' . $href . '"' . $style . $aria . '>' . $label . '</a>';
    };

    echo '<header class="nav glass-bar"><div class="nav-inner">'
        . '<a class="nav-brand" href="index.php" aria-label="Intake review — queue">'
        . '<img class="wordmark" src="../assets/img/logo-white-gold.svg" alt="DGTL" width="70" height="26">'
        . '<span class="kicker">Intake Review</span></a>'
        . '<nav class="nav-actions">'
        . $link('queue', 'index.php', 'Queue')
        . $link('status', 'status.php', 'Status')
        . '<form method="post" action="logout.php" style="display:inline">'
        . '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">'
        . '<button class="btn btn-ghost btn-sm" type="submit">Sign out</button></form>'
        . '</nav></div></header><main class="admin-wrap">';
}

function admin_foot(): void
{
    echo '</main></body></html>';
}

function status_pill(string $status): string
{
    $labels = [
        'draft' => 'Draft', 'submitted' => 'Submitted', 'in_review' => 'In review',
        'approved' => 'Approved', 'rejected' => 'Rejected', 'more_info' => 'More info',
    ];
    return '<span class="status-pill st-' . e($status) . '">'
        . e($labels[$status] ?? $status) . '</span>';
}
