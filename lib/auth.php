<?php
defined('APP') or exit;

/**
 * Admin session auth. Single admin: email + password hash live in .env.
 * Hardened PHP session, CSRF synchronizer token on every admin POST.
 */

function admin_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/admin',
        'secure' => !is_dev(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_name('dgtl_intake_admin');
    session_start();

    // 8h idle timeout.
    if (!empty($_SESSION['admin_at']) && time() - $_SESSION['admin_at'] > 8 * 3600) {
        session_unset();
        session_destroy();
        session_start();
    }
    if (!empty($_SESSION['admin'])) {
        $_SESSION['admin_at'] = time();
    }
}

function admin_logged_in(): bool
{
    admin_session_start();
    return !empty($_SESSION['admin']);
}

function admin_require(): void
{
    if (!admin_logged_in()) {
        header('Location: login.php');
        exit;
    }
}

function admin_login(string $email, string $password): bool
{
    admin_session_start();
    $okEmail = hash_equals(strtolower(env('ADMIN_EMAIL', '')), strtolower(trim($email)));
    $okPass = password_verify($password, env('ADMIN_PASSWORD_HASH', '$2y$10$invalid'));
    if (!$okEmail || !$okPass) {
        return false;
    }
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['admin_at'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return true;
}

function admin_logout(): void
{
    admin_session_start();
    session_unset();
    session_destroy();
}

function csrf_token(): string
{
    admin_session_start();
    return $_SESSION['csrf'] ?? '';
}

function csrf_check(): void
{
    admin_session_start();
    $sent = $_POST['csrf'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], (string) $sent)) {
        http_response_code(403);
        exit('Bad CSRF token — go back and retry.');
    }
}
