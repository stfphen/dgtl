<?php
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/admin_ui.php';
require __DIR__ . '/../lib/ratelimit.php';
require __DIR__ . '/../lib/audit.php';

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    rate_limit('admin_login', 'ip|' . client_ip(), 10);
    if (admin_login($_POST['email'] ?? '', $_POST['password'] ?? '')) {
        audit(null, 'admin', 'admin.login');
        header('Location: index.php');
        exit;
    }
    audit(null, 'admin', 'admin.login_failed');
    $error = 'Wrong email or password.';
}
if (admin_logged_in()) {
    header('Location: index.php');
    exit;
}

admin_head('Sign in');
?>
<main style="min-height:80vh;display:flex;align-items:center;justify-content:center;padding:24px">
  <form method="post" class="card card-solid" style="width:100%;max-width:380px">
    <p class="eyebrow" style="margin-bottom:6px">DGTL Intake</p>
    <h1 style="color:#fff;font-size:22px;margin-bottom:20px">Review sign-in</h1>
    <?php if ($error): ?>
      <p class="f-error" style="display:block;margin-bottom:14px"><?= e($error) ?></p>
    <?php endif ?>
    <div class="f-row">
      <label class="f-label" for="email">Email</label>
      <input class="input" id="email" name="email" type="email" autocomplete="username" required>
    </div>
    <div class="f-row">
      <label class="f-label" for="password">Password</label>
      <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
    </div>
    <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center">Sign in</button>
  </form>
</main>
<?php echo '</body></html>';
