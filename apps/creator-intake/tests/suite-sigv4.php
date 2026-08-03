<?php
defined('APP') or exit;

require_once __DIR__ . '/../site/lib/r2.php';

/**
 * Offline vectors from the AWS documentation:
 *  - "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)"
 *  - "Authenticating Requests: Using the Authorization Header" (GET object w/ Range)
 * Key: AKIAIOSFODNN7EXAMPLE / wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 * Time: 20130524T000000Z, region us-east-1, bucket examplebucket.
 */
const AWS_DOC_KEY = 'AKIAIOSFODNN7EXAMPLE';
const AWS_DOC_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
const AWS_DOC_WHEN = 1369353600; // 2013-05-24T00:00:00Z

test('sigv4 presigned GET matches the AWS documentation vector', function () {
    $url = sigv4_presign(
        'GET', 'examplebucket.s3.amazonaws.com', '/test.txt', 86400,
        ['host' => 'examplebucket.s3.amazonaws.com'],
        AWS_DOC_KEY, AWS_DOC_SECRET, 'us-east-1', 's3', AWS_DOC_WHEN
    );
    $expected = 'https://examplebucket.s3.amazonaws.com/test.txt'
        . '?X-Amz-Algorithm=AWS4-HMAC-SHA256'
        . '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request'
        . '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host'
        . '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';
    check_eq($expected, $url);
});

test('sigv4 authorization header matches the AWS documentation vector', function () {
    $headers = sigv4_auth_headers(
        'GET', 'examplebucket.s3.amazonaws.com', '/test.txt',
        AWS_DOC_KEY, AWS_DOC_SECRET, 'us-east-1', 's3', AWS_DOC_WHEN,
        ['range' => 'bytes=0-9']
    );
    $auth = null;
    foreach ($headers as $h) {
        if (str_starts_with($h, 'Authorization:')) {
            $auth = $h;
        }
    }
    check($auth !== null, 'Authorization header present');
    check(
        str_contains($auth, 'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'),
        'signature matches doc vector — got: ' . $auth
    );
    check(str_contains($auth, 'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date'));
});

test('presign pins content-type into SignedHeaders when supplied', function () {
    $url = sigv4_presign(
        'PUT', 'acct.r2.cloudflarestorage.com', '/bucket/applications/x/y.mp4', 3600,
        ['host' => 'acct.r2.cloudflarestorage.com', 'content-type' => 'video/mp4'],
        'AKIDEXAMPLE', 'secret', 'auto', 's3', AWS_DOC_WHEN
    );
    check(str_contains($url, 'X-Amz-SignedHeaders=content-type%3Bhost'), $url);
});

test('path encoding preserves slashes, encodes specials', function () {
    check_eq('/bucket/a/b%20c/d~e.mp4', sigv4_encode('/bucket/a/b c/d~e.mp4', true));
    check_eq('video%2Fmp4', sigv4_encode('video/mp4'));
});
