<?php
defined('APP') or exit;

/**
 * Minimal AWS SigV4 for Cloudflare R2 (S3-compatible), no SDK, no Composer.
 * Three operations: query-presigned PUT/GET, header-signed HEAD, header-signed
 * DELETE. Path-style addressing (/<bucket>/<key>) against
 * https://<ACCOUNT_ID>.r2.cloudflarestorage.com, region "auto".
 *
 * The sigv4_* core is deliberately parameterized (host, region, timestamp) so
 * tests can replay the published AWS documentation vectors offline.
 */

const SIGV4_UNSIGNED = 'UNSIGNED-PAYLOAD';
const SIGV4_EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** RFC 3986 encoding per the SigV4 spec; '/' preserved in paths only. */
function sigv4_encode(string $s, bool $isPath = false): string
{
    $enc = str_replace('%7E', '~', rawurlencode($s));
    return $isPath ? str_replace('%2F', '/', $enc) : $enc;
}

function sigv4_signing_key(string $secret, string $date, string $region, string $service): string
{
    $k = hash_hmac('sha256', $date, 'AWS4' . $secret, true);
    $k = hash_hmac('sha256', $region, $k, true);
    $k = hash_hmac('sha256', $service, $k, true);
    return hash_hmac('sha256', 'aws4_request', $k, true);
}

/** @param array<string,string> $query  @param array<string,string> $headers lowercase-keyed */
function sigv4_canonical_request(
    string $method,
    string $path,
    array $query,
    array $headers,
    string $payloadHash
): string {
    $encQuery = [];
    foreach ($query as $k => $v) {
        $encQuery[sigv4_encode($k)] = sigv4_encode($v);
    }
    ksort($encQuery, SORT_STRING);
    $canonQuery = implode('&', array_map(
        fn($k, $v) => "$k=$v",
        array_keys($encQuery),
        $encQuery
    ));

    ksort($headers, SORT_STRING);
    $canonHeaders = '';
    foreach ($headers as $k => $v) {
        $canonHeaders .= $k . ':' . trim(preg_replace('/\s+/', ' ', $v)) . "\n";
    }
    $signedHeaders = implode(';', array_keys($headers));

    return implode("\n", [
        strtoupper($method),
        sigv4_encode($path, true),
        $canonQuery,
        $canonHeaders,
        $signedHeaders,
        $payloadHash,
    ]);
}

function sigv4_string_to_sign(string $amzDate, string $scope, string $canonicalRequest): string
{
    return implode("\n", [
        'AWS4-HMAC-SHA256',
        $amzDate,
        $scope,
        hash('sha256', $canonicalRequest),
    ]);
}

/**
 * Query-string presigned URL. $signedHeaders must include at least
 * ['host' => $host]; add 'content-type' to pin it for PUTs.
 */
function sigv4_presign(
    string $method,
    string $host,
    string $path,
    int $ttl,
    array $signedHeaders,
    string $accessKey,
    string $secret,
    string $region,
    string $service = 's3',
    ?int $when = null
): string {
    $when ??= time();
    $amzDate = gmdate('Ymd\THis\Z', $when);
    $date = gmdate('Ymd', $when);
    $scope = "$date/$region/$service/aws4_request";

    $headers = array_change_key_case($signedHeaders, CASE_LOWER);
    ksort($headers, SORT_STRING);

    $query = [
        'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
        'X-Amz-Credential' => "$accessKey/$scope",
        'X-Amz-Date' => $amzDate,
        'X-Amz-Expires' => (string) $ttl,
        'X-Amz-SignedHeaders' => implode(';', array_keys($headers)),
    ];

    $canonical = sigv4_canonical_request($method, $path, $query, $headers, SIGV4_UNSIGNED);
    $sts = sigv4_string_to_sign($amzDate, $scope, $canonical);
    $sig = hash_hmac('sha256', $sts, sigv4_signing_key($secret, $date, $region, $service));

    $qs = [];
    foreach ($query as $k => $v) {
        $qs[] = sigv4_encode($k) . '=' . sigv4_encode($v);
    }
    $qs[] = 'X-Amz-Signature=' . $sig;
    return "https://$host" . sigv4_encode($path, true) . '?' . implode('&', $qs);
}

/** Authorization-header signing for server-side HEAD/DELETE (empty body). */
function sigv4_auth_headers(
    string $method,
    string $host,
    string $path,
    string $accessKey,
    string $secret,
    string $region,
    string $service = 's3',
    ?int $when = null,
    array $extraHeaders = []
): array {
    $when ??= time();
    $amzDate = gmdate('Ymd\THis\Z', $when);
    $date = gmdate('Ymd', $when);
    $scope = "$date/$region/$service/aws4_request";

    $headers = array_change_key_case($extraHeaders, CASE_LOWER) + [
        'host' => $host,
        'x-amz-content-sha256' => SIGV4_EMPTY_SHA256,
        'x-amz-date' => $amzDate,
    ];
    ksort($headers, SORT_STRING);

    $canonical = sigv4_canonical_request($method, $path, [], $headers, SIGV4_EMPTY_SHA256);
    $sts = sigv4_string_to_sign($amzDate, $scope, $canonical);
    $sig = hash_hmac('sha256', $sts, sigv4_signing_key($secret, $date, $region, $service));

    $out = [];
    foreach ($headers as $k => $v) {
        if ($k !== 'host') {
            $out[] = "$k: $v";
        }
    }
    $out[] = 'Authorization: AWS4-HMAC-SHA256 Credential=' . "$accessKey/$scope"
        . ', SignedHeaders=' . implode(';', array_keys($headers))
        . ', Signature=' . $sig;
    return $out;
}

// ── R2-specific wrappers ─────────────────────────────────────────────────────

function r2_host(): string
{
    return env_require('R2_ACCOUNT_ID') . '.r2.cloudflarestorage.com';
}

function r2_path(string $key): string
{
    return '/' . env_require('R2_BUCKET') . '/' . ltrim($key, '/');
}

/** Presigned URL for a browser PUT (Content-Type pinned) or an admin/export GET. */
function r2_presign(string $method, string $key, int $ttl, ?string $contentType = null): string
{
    $headers = ['host' => r2_host()];
    if ($contentType !== null) {
        $headers['content-type'] = $contentType;
    }
    return sigv4_presign(
        $method, r2_host(), r2_path($key), $ttl, $headers,
        env_require('R2_ACCESS_KEY_ID'), env_require('R2_SECRET_ACCESS_KEY'), 'auto'
    );
}

/** @return array{bytes:int, mime:string}|null null when the object does not exist */
function r2_head(string $key): ?array
{
    $ch = curl_init('https://' . r2_host() . r2_path($key));
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => sigv4_auth_headers(
            'HEAD', r2_host(), r2_path($key),
            env_require('R2_ACCESS_KEY_ID'), env_require('R2_SECRET_ACCESS_KEY'), 'auto'
        ),
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $bytes = (int) curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD_T);
    $mime = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($res === false || $code === 404) {
        return null;
    }
    if ($code !== 200) {
        error_log("creator-intake r2_head $key -> HTTP $code");
        return null;
    }
    return ['bytes' => $bytes, 'mime' => $mime];
}

function r2_delete(string $key): bool
{
    $ch = curl_init('https://' . r2_host() . r2_path($key));
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => sigv4_auth_headers(
            'DELETE', r2_host(), r2_path($key),
            env_require('R2_ACCESS_KEY_ID'), env_require('R2_SECRET_ACCESS_KEY'), 'auto'
        ),
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $code === 204 || $code === 200 || $code === 404;
}
