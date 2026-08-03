<?php
defined('APP') or exit;

/** 43-char URL-safe token from 32 random bytes. Returned to the caller exactly once. */
function token_new(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

/**
 * Peppered hash for storage. Lookup is by hash, so comparison is
 * constant-time by construction.
 */
function token_hash(string $raw): string
{
    return hash('sha256', $raw . env_require('TOKEN_PEPPER'));
}
