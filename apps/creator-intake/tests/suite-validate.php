<?php
defined('APP') or exit;

test('step 1 accepts clean creator identity', function () {
    [$errors, $clean] = validate_step('creator', 1, [
        'applicant_type' => 'creator', 'legal_name' => '  Jane Doe ', 'email' => 'Jane@Example.com',
        'entity_type' => 'individual',
    ]);
    check_eq([], $errors);
    check_eq('Jane Doe', $clean['legal_name'], 'trims');
    check_eq('jane@example.com', $clean['email'], 'lowercases email');
});

test('step validation rejects unknown fields', function () {
    [$errors] = validate_step('creator', 1, ['is_admin' => true]);
    check(isset($errors['is_admin']));
});

test('step validation rejects fields from other steps', function () {
    [$errors] = validate_step('creator', 1, ['bio_short' => 'hi']);
    check(isset($errors['bio_short']), 'bio_short is step 2');
});

test('brand cannot save creator-only rate fields', function () {
    [$errors] = validate_step('brand', 5, ['rate_ig_post' => 500]);
    check(isset($errors['rate_ig_post']));
});

test('bio_short cap at 160 chars', function () {
    [$errors] = validate_step('creator', 2, ['bio_short' => str_repeat('x', 161)]);
    check(isset($errors['bio_short']));
    [$errors2] = validate_step('creator', 2, ['bio_short' => str_repeat('x', 160)]);
    check_eq([], $errors2);
});

test('bio_long cap at 900 chars', function () {
    [$errors] = validate_step('creator', 2, ['bio_long' => str_repeat('x', 901)]);
    check(isset($errors['bio_long']));
});

test('urls get https:// prefixed and validated', function () {
    [$errors, $clean] = validate_step('brand', 3, ['website_url' => 'example.com/about']);
    check_eq([], $errors);
    check_eq('https://example.com/about', $clean['website_url']);
    [$errors2] = validate_step('brand', 3, ['website_url' => 'not a url at all']);
    check(isset($errors2['website_url']));
});

test('socials rows are whitelisted and coerced', function () {
    [$errors, $clean] = validate_step('creator', 3, ['socials' => [
        ['platform' => 'tiktok', 'handle' => '@x', 'profile_url' => 'tiktok.com/@x',
         'follower_count' => '52000', 'verified' => 1, 'is_primary' => true, 'evil' => 'dropped'],
    ]]);
    check_eq([], $errors);
    $row = $clean['socials'][0];
    check_eq(52000, $row['follower_count'], 'numeric string coerced');
    check(!isset($row['evil']), 'unknown row keys dropped');
    check_eq(true, $row['verified']);
});

test('socials rejects unknown platform', function () {
    [$errors] = validate_step('creator', 3, ['socials' => [['platform' => 'myspace']]]);
    check(isset($errors['socials']));
});

test('notable_press requires url and outlet shape', function () {
    [$errors, $clean] = validate_step('creator', 2, ['notable_press' => [
        ['url' => 'blogto.com/x', 'outlet' => 'BlogTO'],
    ]]);
    check_eq([], $errors);
    check_eq('https://blogto.com/x', $clean['notable_press'][0]['url']);
});

test('validate_full passes a complete creator', function () {
    check_eq([], validate_full('creator', valid_creator_payload(), 0));
});

test('validate_full requires rights_confirmation to be true', function () {
    $p = valid_creator_payload();
    $p['rights_confirmation'] = false;
    $errors = validate_full('creator', $p, 0);
    check(isset($errors['rights_confirmation']));
});

test('validate_full: explicit booleans must be present, false is a valid answer', function () {
    $p = valid_creator_payload();
    unset($p['broadcast_ok']);
    $errors = validate_full('creator', $p, 0);
    check(isset($errors['broadcast_ok']), 'absent broadcast_ok rejected');

    $p['broadcast_ok'] = false;
    check_eq([], validate_full('creator', $p, 0), 'explicit false accepted');
});

test('validate_full requires exactly one primary social for creators', function () {
    $p = valid_creator_payload();
    $p['socials'][0]['is_primary'] = false;
    $errors = validate_full('creator', $p, 0);
    check(isset($errors['socials']));

    $p['socials'][] = $p['socials'][0];
    $p['socials'][0]['is_primary'] = true;
    $p['socials'][1]['is_primary'] = true;
    $errors2 = validate_full('creator', $p, 0);
    check(isset($errors2['socials']), 'two primaries rejected');
});

test('validate_full requires some media (upload count or links)', function () {
    $p = valid_creator_payload();
    $p['media_links'] = [];
    $errors = validate_full('creator', $p, 0);
    check(isset($errors['media_links']));
    check_eq([], validate_full('creator', $p, 1), 'a stored upload satisfies it');
});

test('validate_full: brand needs website_url but not socials', function () {
    $p = valid_creator_payload();
    $p['applicant_type'] = 'brand';
    unset($p['socials']);
    $errors = validate_full('brand', $p, 0);
    check(isset($errors['website_url']), 'brand requires website_url');
    check(!isset($errors['socials']), 'brand does not require socials');

    $p['website_url'] = 'https://brand.example.com';
    check_eq([], validate_full('brand', $p, 0));
});
