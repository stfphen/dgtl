<?php
defined('APP') or exit;

/**
 * Append to the audit trail. meta holds field NAMES and state transitions
 * only — never payload values (PII stays in the applications table).
 */
function audit(?int $applicationId, string $actor, string $action, array $meta = [], ?string $ip = null): void
{
    db()->prepare(
        'INSERT INTO audit_log (application_id, actor, action, meta, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        $applicationId,
        $actor,
        $action,
        $meta ? json_encode($meta, JSON_UNESCAPED_SLASHES) : null,
        $ip ?? client_ip(),
        now(),
    ]);
}
