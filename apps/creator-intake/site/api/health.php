<?php
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';

try {
    db()->query('SELECT 1');
    json_out(['ok' => true, 'env' => is_dev() ? 'dev' : 'production']);
} catch (Throwable $e) {
    error_log('creator-intake health: ' . $e->getMessage());
    fail(500, 'db_unreachable');
}
