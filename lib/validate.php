<?php
defined('APP') or exit;

require_once __DIR__ . '/fields.php';

/**
 * Validation driven entirely by fields_spec(). Two entry points:
 *   validate_step()  — sanitize one step's partial input (draft saves; lenient
 *                      on missing fields, strict on shape/caps/unknown keys)
 *   validate_full()  — the submit gate (required matrix enforced)
 *
 * Both return [errors, clean]: errors is field=>message, clean is the
 * whitelisted, coerced subset safe to merge into the payload.
 */

function validate_step(string $type, int $step, array $input): array
{
    $errors = [];
    $clean = [];
    $spec = fields_for($type, $step);

    foreach ($input as $name => $value) {
        if (!isset($spec[$name])) {
            $errors[$name] = 'Unknown field for this step.';
            continue;
        }
        [$ok, $coerced, $msg] = coerce_field($spec[$name], $value);
        if ($ok) {
            $clean[$name] = $coerced;
        } else {
            $errors[$name] = $msg;
        }
    }
    return [$errors, $clean];
}

function validate_full(string $type, array $payload, int $storedUploads): array
{
    $errors = [];
    foreach (fields_for($type) as $name => $f) {
        $required = $f['required'] ?? false;
        if ($required !== true && $required !== $type) {
            continue;
        }
        $v = $payload[$name] ?? null;
        $missing = $v === null || $v === '' || $v === [];
        // Explicit-decision booleans: present false is valid, absent is not.
        if (($f['type'] ?? '') === 'bool') {
            $missing = !array_key_exists($name, $payload);
            if ($name === 'rights_confirmation' && $v !== true) {
                $errors[$name] = 'You must confirm you own or control the rights.';
                continue;
            }
        }
        if ($missing) {
            $errors[$name] = 'This field is required.';
        }
    }

    // Creators need exactly one primary social row.
    if ($type === 'creator' && !empty($payload['socials'])) {
        $primaries = array_filter($payload['socials'], fn($r) => !empty($r['is_primary']));
        if (count($primaries) !== 1) {
            $errors['socials'] = 'Mark exactly one platform as your primary.';
        }
    }

    // At least one piece of media: a stored upload or a media link.
    if ($storedUploads === 0 && empty($payload['media_links'])) {
        $errors['media_links'] = 'Add at least one media upload or link.';
    }

    return $errors;
}

/** @return array{0: bool, 1: mixed, 2: string} [ok, coerced, message] */
function coerce_field(array $f, mixed $v): array
{
    switch ($f['type']) {
        case 'string':
        case 'text':
            if (!is_string($v)) {
                return [false, null, 'Must be text.'];
            }
            $v = trim($v);
            if (mb_strlen($v) > $f['max']) {
                return [false, null, 'Keep this under ' . $f['max'] . ' characters.'];
            }
            return [true, $v, ''];

        case 'email':
            if (!is_string($v)) {
                return [false, null, 'Must be text.'];
            }
            $v = trim($v);
            if ($v === '') {
                return [true, '', ''];
            }
            if (mb_strlen($v) > $f['max'] || !filter_var($v, FILTER_VALIDATE_EMAIL)) {
                return [false, null, 'Enter a valid email address.'];
            }
            return [true, strtolower($v), ''];

        case 'url':
            if (!is_string($v)) {
                return [false, null, 'Must be text.'];
            }
            $v = trim($v);
            if ($v === '') {
                return [true, '', ''];
            }
            if (!preg_match('~^https?://~i', $v)) {
                $v = 'https://' . $v;
            }
            if (mb_strlen($v) > $f['max'] || !filter_var($v, FILTER_VALIDATE_URL)) {
                return [false, null, 'Enter a valid link (https://…).'];
            }
            return [true, $v, ''];

        case 'bool':
            if (!is_bool($v)) {
                return [false, null, 'Must be yes or no.'];
            }
            return [true, $v, ''];

        case 'int':
            if ($v === '' || $v === null) {
                return [true, null, ''];
            }
            if (!is_numeric($v) || (int) $v < 0 || (int) $v > 2000000000) {
                return [false, null, 'Enter a whole number.'];
            }
            return [true, (int) $v, ''];

        case 'number':
            if ($v === '' || $v === null) {
                return [true, null, ''];
            }
            if (!is_numeric($v) || (float) $v < 0 || (float) $v > 100000000) {
                return [false, null, 'Enter a number.'];
            }
            return [true, round((float) $v, 2), ''];

        case 'enum':
            if (!in_array($v, $f['values'], true)) {
                return [false, null, 'Pick one of the listed options.'];
            }
            return [true, $v, ''];

        case 'enum_multi':
            if (!is_array($v) || count($v) > $f['max']) {
                return [false, null, 'Pick up to ' . $f['max'] . ' options.'];
            }
            $out = array_values(array_unique($v));
            foreach ($out as $item) {
                if (!in_array($item, $f['values'], true)) {
                    return [false, null, 'Pick from the listed options.'];
                }
            }
            return [true, $out, ''];

        case 'strings':
            if (!is_array($v) || count($v) > $f['max']) {
                return [false, null, 'Up to ' . $f['max'] . ' entries.'];
            }
            $out = [];
            foreach ($v as $item) {
                if (!is_string($item)) {
                    return [false, null, 'Entries must be text.'];
                }
                $item = trim($item);
                if ($item === '') {
                    continue;
                }
                if (mb_strlen($item) > ($f['item_max'] ?? 300)) {
                    return [false, null, 'Keep each entry under ' . ($f['item_max'] ?? 300) . ' characters.'];
                }
                $out[] = $item;
            }
            return [true, $out, ''];

        case 'press':      // [{url, outlet}]
            if (!is_array($v) || count($v) > $f['max']) {
                return [false, null, 'Up to ' . $f['max'] . ' press links.'];
            }
            $out = [];
            foreach ($v as $row) {
                if (!is_array($row)) {
                    return [false, null, 'Invalid press entry.'];
                }
                [$ok, $url] = coerce_field(['type' => 'url', 'max' => 500], $row['url'] ?? '');
                $outlet = is_string($row['outlet'] ?? '') ? trim($row['outlet'] ?? '') : null;
                if (!$ok || $outlet === null || mb_strlen($outlet) > 200) {
                    return [false, null, 'Each press entry needs a valid link and outlet name.'];
                }
                if ($url === '' && $outlet === '') {
                    continue;
                }
                $out[] = ['url' => $url, 'outlet' => $outlet];
            }
            return [true, $out, ''];

        case 'socials':    // [{platform, handle, profile_url, follower_count, verified, is_primary}]
            if (!is_array($v) || count($v) > $f['max']) {
                return [false, null, 'Up to ' . $f['max'] . ' platforms.'];
            }
            $out = [];
            foreach ($v as $row) {
                if (!is_array($row) || !in_array($row['platform'] ?? '', PLATFORMS, true)) {
                    return [false, null, 'Pick a platform for every row.'];
                }
                $handle = is_string($row['handle'] ?? '') ? trim($row['handle']) : '';
                [$okU, $url] = coerce_field(['type' => 'url', 'max' => 500], $row['profile_url'] ?? '');
                [$okC, $count] = coerce_field(['type' => 'int'], $row['follower_count'] ?? null);
                if (!$okU || !$okC || mb_strlen($handle) > 120) {
                    return [false, null, 'Check the handle, link and follower count on each row.'];
                }
                if ($handle === '' && $url === '') {
                    continue;
                }
                $out[] = [
                    'platform' => $row['platform'],
                    'handle' => $handle,
                    'profile_url' => $url,
                    'follower_count' => $count,
                    'verified' => (bool) ($row['verified'] ?? false),
                    'is_primary' => (bool) ($row['is_primary'] ?? false),
                ];
            }
            return [true, $out, ''];

        case 'media_links': // [{url, label}] — Drive/Dropbox/WeTransfer/post URLs
            if (!is_array($v) || count($v) > $f['max']) {
                return [false, null, 'Up to ' . $f['max'] . ' links.'];
            }
            $out = [];
            foreach ($v as $row) {
                if (!is_array($row)) {
                    return [false, null, 'Invalid media link.'];
                }
                [$ok, $url] = coerce_field(['type' => 'url', 'max' => 1024], $row['url'] ?? '');
                $label = is_string($row['label'] ?? '') ? trim($row['label'] ?? '') : '';
                if (!$ok || mb_strlen($label) > 200) {
                    return [false, null, 'Each media link needs a valid URL.'];
                }
                if ($url === '') {
                    continue;
                }
                $out[] = ['url' => $url, 'label' => $label];
            }
            return [true, $out, ''];
    }
    return [false, null, 'Unknown field type.'];
}
