<?php
/**
 * Framework-less test runner: php tests/run.php
 * Runs every tests/suite-*.php against an in-memory SQLite DB.
 * Exits non-zero on any failure. Must pass before any deploy.
 */
define('APP', true);
define('ENV_FILE', __DIR__ . '/fixtures/test.env');
require __DIR__ . '/../site/lib/bootstrap.php';
require __DIR__ . '/../site/lib/validate.php';

$GLOBALS['__tests'] = ['pass' => 0, 'fail' => 0];

function test(string $name, callable $fn): void
{
    try {
        $fn();
        $GLOBALS['__tests']['pass']++;
        echo "  ok  $name\n";
    } catch (Throwable $e) {
        $GLOBALS['__tests']['fail']++;
        echo "FAIL  $name\n      {$e->getMessage()} ({$e->getFile()}:{$e->getLine()})\n";
    }
}

function check(bool $cond, string $msg = 'assertion failed'): void
{
    if (!$cond) {
        throw new Exception($msg);
    }
}

function check_eq(mixed $expected, mixed $actual, string $msg = ''): void
{
    if ($expected !== $actual) {
        throw new Exception(($msg ? "$msg — " : '') .
            'expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

/** A minimal payload that passes validate_full for a creator. */
function valid_creator_payload(): array
{
    return [
        'applicant_type' => 'creator', 'legal_name' => 'Jane Q. Doe', 'public_name' => 'Jane Doe',
        'email' => 'jane@example.com', 'phone' => '+1 416 555 0100', 'city' => 'Toronto',
        'country' => 'Canada', 'entity_type' => 'individual',
        'primary_category' => 'music', 'bio_short' => 'Toronto vocalist and producer.',
        'looking_for' => ['brand_deals'],
        'socials' => [[
            'platform' => 'instagram', 'handle' => '@janedoe', 'profile_url' => 'https://instagram.com/janedoe',
            'follower_count' => 120000, 'verified' => true, 'is_primary' => true,
        ]],
        'media_links' => [['url' => 'https://drive.google.com/x', 'label' => 'EPK folder']],
        'rights_confirmation' => true, 'derivative_ok' => true, 'broadcast_ok' => false,
        'ai_training_optout' => true, 'credit_line' => 'Photo: Jane Doe',
        'signature_name' => 'Jane Q. Doe', 'signature_date' => '2026-08-03',
    ];
}

foreach (glob(__DIR__ . '/suite-*.php') as $suite) {
    echo basename($suite) . "\n";
    require $suite;
}

$t = $GLOBALS['__tests'];
echo "\n{$t['pass']} passed, {$t['fail']} failed\n";
exit($t['fail'] > 0 ? 1 : 0);
