<?php
defined('APP') or exit;

/**
 * PDO singleton. DB_DRIVER=mysql in production (Hostinger MySQL/MariaDB),
 * sqlite for local dev + tests. On SQLite first-connect the schema is
 * auto-applied if the applications table is missing.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $driver = env('DB_DRIVER', 'sqlite');
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    if ($driver === 'mysql') {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            env_require('DB_HOST'),
            env_require('DB_NAME')
        );
        $pdo = new PDO($dsn, env_require('DB_USER'), env_require('DB_PASS'), $opts);
        return $pdo;
    }

    $path = env('DB_SQLITE_PATH', './dev.sqlite');
    if ($path !== ':memory:' && $path[0] !== '/') {
        $path = dirname(__DIR__, 2) . '/' . ltrim($path, './'); // relative to apps/creator-intake/
    }
    $pdo = new PDO('sqlite:' . $path, null, null, $opts);
    $pdo->exec('PRAGMA foreign_keys = ON');

    $has = $pdo->query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='applications'"
    )->fetch();
    if (!$has) {
        $pdo->exec(file_get_contents(dirname(__DIR__, 2) . '/schema.sqlite.sql'));
    }
    return $pdo;
}
