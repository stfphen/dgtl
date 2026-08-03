<?php
/**
 * Common bootstrap — every entry point starts with:
 *   define('APP', true); require __DIR__ . '/../lib/bootstrap.php';
 */
defined('APP') or exit;

date_default_timezone_set('UTC');

require __DIR__ . '/env.php';

if (env('APP_ENV', 'dev') === 'production') {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED);
} else {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
}

require __DIR__ . '/db.php';
require __DIR__ . '/http.php';
require __DIR__ . '/tokens.php';

/** All timestamps are written by PHP in UTC so MySQL/MariaDB/SQLite behave identically. */
function now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function uuidv4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function is_dev(): bool
{
    return env('APP_ENV', 'dev') !== 'production';
}
