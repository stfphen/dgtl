<?php
defined('APP') or exit;

require_once __DIR__ . '/validate.php';

/** Statuses an applicant may still edit. Submitted records are immutable to them. */
const EDITABLE_STATUSES = ['draft', 'more_info'];

function app_find_by_public_id(string $publicId): ?array
{
    $st = db()->prepare('SELECT * FROM applications WHERE public_id = ?');
    $st->execute([$publicId]);
    $row = $st->fetch();
    return $row ?: null;
}

/**
 * Authenticate an applicant request: public_id + bearer draft_token.
 * 404 on unknown id, 403 on bad token — and honeypot-flagged records
 * behave like real ones so a spammer learns nothing.
 */
function app_auth(array $body): array
{
    $publicId = is_string($body['public_id'] ?? null) ? $body['public_id'] : '';
    $token = is_string($body['draft_token'] ?? null) ? $body['draft_token'] : '';
    if ($publicId === '' || $token === '') {
        fail(401, 'auth_required');
    }
    $app = app_find_by_public_id($publicId);
    if (!$app || !$app['client_token_hash']
        || !hash_equals($app['client_token_hash'], token_hash($token))) {
        fail(403, 'bad_token');
    }
    return $app;
}

function app_require_editable(array $app): void
{
    if (!in_array($app['status'], EDITABLE_STATUSES, true)) {
        fail(409, 'not_editable', 'This application has already been submitted.');
    }
}

function app_payload(array $app): array
{
    $p = json_decode($app['payload'], true);
    return is_array($p) ? $p : [];
}

/**
 * Persist a payload merge, syncing the promoted columns and bumping payload_rev.
 * Returns the new revision number.
 */
function app_save_payload(array $app, array $payload, int $step): int
{
    $rev = (int) $app['payload_rev'] + 1;
    db()->prepare(
        'UPDATE applications SET payload = ?, payload_rev = ?, current_step = ?,
            email = ?, public_name = ?, primary_category = ?, updated_at = ?
         WHERE id = ?'
    )->execute([
        json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        $rev,
        max((int) $app['current_step'], $step),
        $payload['email'] ?? $app['email'],
        $payload['public_name'] ?? $app['public_name'],
        $payload['primary_category'] ?? $app['primary_category'],
        now(),
        $app['id'],
    ]);
    return $rev;
}

/** Count media rows by status for an application. */
function app_media_count(int $applicationId, string $kind, array $statuses): int
{
    $ph = implode(',', array_fill(0, count($statuses), '?'));
    $st = db()->prepare(
        "SELECT COUNT(*) AS n FROM application_media
         WHERE application_id = ? AND kind = ? AND status IN ($ph)"
    );
    $st->execute([$applicationId, $kind, ...$statuses]);
    return (int) $st->fetch()['n'];
}

/** Media metadata safe to hand back to the applicant (no R2 keys or URLs). */
function app_media_public(int $applicationId): array
{
    $st = db()->prepare(
        "SELECT id AS media_id, kind, title, mime, bytes, status
         FROM application_media
         WHERE application_id = ? AND status IN ('pending','stored') ORDER BY id"
    );
    $st->execute([$applicationId]);
    return $st->fetchAll();
}
