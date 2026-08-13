<?php
/**
 * Status — the "is this thing on?" page.
 *
 * Answers without SSH: which database rows are really being written to, whether
 * mail can leave the box, where applicants stall, and whether anything at all
 * has happened lately. Health checks are read-only except for one reversible
 * database write probe; sending a test email remains an explicit action.
 */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/admin_ui.php';
require __DIR__ . '/../lib/mailer.php';
require __DIR__ . '/../lib/diagnostics.php';

admin_require();

$flash = null;
$flashState = 'info';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    csrf_check();
    if (($_POST['action'] ?? '') === 'test_email') {
        $to = trim((string) ($_POST['to'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $flash = 'That does not look like an email address.';
            $flashState = 'error';
        } else {
            $when = gmdate('Y-m-d H:i:s') . ' UTC';
            $sent = mail_send(
                $to,
                'DGTL intake — test email',
                "This is a test from the DGTL intake admin status page, sent $when.\n\n"
                . "If you are reading this, authenticated SMTP works from the server. If it landed "
                . "in spam, the sending domain's SPF/DKIM records need attention.",
                mail_wrap_html(
                    'Test email',
                    '<p style="margin:0;color:#c8c8c8;font-size:15px;line-height:1.6">Sent from the '
                    . 'intake admin status page at ' . e($when) . '. If you are reading this, '
                    . 'authenticated SMTP works from the server.</p>'
                )
            );
            if ($sent && is_dev()) {
                $flash = 'Dev mode: written to dev-mail/ instead of being sent. Nothing left the server.';
                $flashState = 'warn';
            } elseif ($sent) {
                $flash = 'Accepted by the SMTP server for delivery to ' . $to
                    . '. Check the inbox AND the spam folder.';
                $flashState = 'ok';
            } else {
                $flash = 'Send failed — ' . (mail_last_error() ?? 'no detail available.');
                $flashState = 'error';
            }
        }
    }
}

$probe = ($_GET['probe'] ?? '1') !== '0';
$groups = diag_all($probe);
$verdict = diag_verdict($groups);
$failures = diag_failures($groups);
$stats = diag_stats();
$activity = diag_recent_activity(20);

$badge = [
    DIAG_OK => 'badge-success', DIAG_WARN => 'badge-warning',
    DIAG_FAIL => 'badge-error', DIAG_INFO => 'badge-info',
];
$dot = [DIAG_OK => 'var(--success)', DIAG_WARN => 'var(--warning)', DIAG_FAIL => 'var(--error)', DIAG_INFO => 'var(--text-dim)'];
$word = [DIAG_OK => 'OK', DIAG_WARN => 'WARN', DIAG_FAIL => 'FAIL', DIAG_INFO => 'INFO'];

admin_head('Status');
admin_nav('status');
?>
<style>
  .diag-table td{vertical-align:top}
  .diag-state{white-space:nowrap;font-size:11px;font-weight:800;letter-spacing:.08em}
  .diag-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:#fff;word-break:break-all}
  .diag-note{font-size:12.5px;color:var(--text-dim);line-height:1.55;margin-top:4px;max-width:64ch}
  .spark{display:flex;align-items:flex-end;gap:3px;height:64px;margin-top:12px}
  .spark div{flex:1;background:var(--surface-2);border-radius:2px 2px 0 0;min-height:2px;position:relative}
  .spark div span{position:absolute;inset:auto 0 0 0;background:var(--gold);border-radius:2px 2px 0 0;display:block}
  .fixlist li{margin:0 0 10px;line-height:1.55;font-size:14px}
  .kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13.5px}
  .kv dt{color:var(--text-dim)} .kv dd{color:#fff;margin:0}
</style>

<h1 style="color:#fff;font-size:24px;margin-bottom:4px">Status</h1>
<p class="dim" style="font-size:14px">
  Live self-check of this server: the database it is really writing to, whether mail can leave,
  and what applicants have actually done. The health pass performs one reversible database write
  probe; email is sent only when you press the test button.
</p>

<?php if ($flash): ?>
  <div class="card card-callout" style="margin:20px 0;border-left-color:<?= $flashState === 'ok' ? 'var(--success)' : ($flashState === 'error' ? 'var(--error)' : 'var(--warning)') ?>">
    <p style="margin:0;font-size:14px;color:#fff"><?= e($flash) ?></p>
  </div>
<?php endif ?>

<!-- Headline verdict ------------------------------------------------------ -->
<div class="card" style="margin:20px 0;border-color:<?= $dot[$verdict] ?>">
  <p style="margin:0 0 8px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:<?= $dot[$verdict] ?>">
    <?= $verdict === DIAG_OK ? 'All checks passing' : ($verdict === DIAG_WARN ? 'Working, with warnings' : 'Broken — action needed') ?>
  </p>
  <?php if ($failures): ?>
    <p style="margin:0 0 14px;color:#c8c8c8;font-size:14px">
      <?= count($failures) ?> check<?= count($failures) === 1 ? '' : 's' ?> failing. Fix in this order —
      the first one is usually the cause of the rest.
    </p>
    <ol class="fixlist" style="margin:0;padding-left:20px;color:#c8c8c8">
      <?php foreach ($failures as $f): ?>
        <li><strong style="color:#fff"><?= e($f['label']) ?></strong>
          <span class="dim">(<?= e($f['group']) ?>)</span> — <?= e($f['note']) ?></li>
      <?php endforeach ?>
    </ol>
  <?php else: ?>
    <p style="margin:0;color:#c8c8c8;font-size:14px">
      Database reachable and writable, mail authenticated, config consistent with the host being served.
    </p>
  <?php endif ?>
</div>

<!-- Submission stats ------------------------------------------------------ -->
<h2 class="h-section" style="color:#fff;font-size:17px;margin:32px 0 12px">Submissions</h2>
<?php if ($stats['error']): ?>
  <div class="card"><p class="dim" style="margin:0;font-size:14px">Could not read stats: <?= e($stats['error']) ?></p></div>
<?php else: ?>
  <div class="statband">
    <div><div class="n"><?= (int) $stats['total'] ?></div><div class="l">Applications</div></div>
    <div><div class="n"><?= (int) (($stats['by_status']['submitted'] ?? 0) + ($stats['by_status']['in_review'] ?? 0)) ?></div><div class="l">Awaiting review</div></div>
    <div><div class="n"><?= (int) $stats['submitted_7d'] ?></div><div class="l">Submitted · 7d</div></div>
    <div><div class="n"><?= (int) ($stats['by_status']['draft'] ?? 0) ?></div><div class="l">Unfinished drafts</div></div>
  </div>

  <div class="grid-3" style="margin-top:20px">
    <div class="card">
      <p class="l" style="margin:0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">Freshness</p>
      <dl class="kv">
        <dt>Last submission</dt><dd><?= e($stats['last_submitted'] ?? 'never') ?><?= $stats['last_submitted'] ? ' UTC' : '' ?></dd>
        <dt>Last activity</dt><dd><?= e($stats['last_touched'] ?? 'never') ?><?= $stats['last_touched'] ? ' UTC' : '' ?></dd>
        <dt>First record</dt><dd><?= e($stats['first_created'] ?? '—') ?></dd>
        <dt>Last 24h</dt><dd><?= (int) $stats['submitted_24h'] ?> submitted</dd>
        <dt>Last 30d</dt><dd><?= (int) $stats['submitted_30d'] ?> submitted</dd>
        <dt>Media stored</dt><dd><?= (int) $stats['media_stored'] ?> files</dd>
        <dt>Spam caught</dt><dd><?= (int) $stats['spam'] ?></dd>
      </dl>
      <?php if ($stats['total'] === 0): ?>
        <p class="diag-note" style="margin-top:14px">
          This database holds no applications at all. Either nothing has been submitted, or the app
          is writing somewhere else — check the “Live connection” row below against the database
          you are looking at in phpMyAdmin.
        </p>
      <?php endif ?>
    </div>

    <div class="card">
      <p class="l" style="margin:0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">By status</p>
      <dl class="kv">
        <?php foreach (['draft', 'submitted', 'in_review', 'more_info', 'approved', 'rejected'] as $st): ?>
          <dt><?= e($st) ?></dt><dd><?= (int) ($stats['by_status'][$st] ?? 0) ?></dd>
        <?php endforeach ?>
      </dl>
      <p class="l" style="margin:16px 0 10px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">By type</p>
      <dl class="kv">
        <?php foreach (['creator', 'brand'] as $t): ?>
          <dt><?= e($t) ?></dt><dd><?= (int) ($stats['by_type'][$t] ?? 0) ?></dd>
        <?php endforeach ?>
      </dl>
    </div>

    <div class="card">
      <p class="l" style="margin:0 0 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">Where drafts stall</p>
      <?php if (!$stats['drafts_by_step']): ?>
        <p class="dim" style="margin:0;font-size:13.5px">No unfinished drafts.</p>
      <?php else: ?>
        <dl class="kv">
          <?php foreach ($stats['drafts_by_step'] as $step => $n): ?>
            <dt>Step <?= (int) $step ?></dt><dd><?= (int) $n ?> stuck</dd>
          <?php endforeach ?>
        </dl>
        <p class="diag-note" style="margin-top:12px">
          A pile-up on one step is a broken step, not shy applicants. Step 3 is media (R2 uploads),
          step 4 is rights, step 5 is the submit itself.
        </p>
      <?php endif ?>
    </div>
  </div>

  <!-- 30-day trend: created (bar height) vs submitted (gold fill) -->
  <div class="card" style="margin-top:20px">
    <p class="l" style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)">
      Last 30 days · bar = applications started, gold = submitted
    </p>
    <?php
    $max = 1;
    foreach ($stats['daily'] as $d) {
        $max = max($max, $d['created'], $d['submitted']);
    }
    ?>
    <div class="spark">
      <?php foreach ($stats['daily'] as $day => $d): ?>
        <div style="height:<?= max(2, (int) round($d['created'] / $max * 100)) ?>%"
             title="<?= e($day) ?>: <?= (int) $d['created'] ?> started, <?= (int) $d['submitted'] ?> submitted">
          <span style="height:<?= $d['created'] ? (int) round(min(1, $d['submitted'] / max(1, $d['created'])) * 100) : 0 ?>%"></span>
        </div>
      <?php endforeach ?>
    </div>
    <p class="dim" style="margin:8px 0 0;font-size:11.5px;display:flex;justify-content:space-between">
      <span><?= e(array_key_first($stats['daily']) ?: '') ?></span>
      <span>peak <?= (int) $max ?>/day</span>
      <span><?= e(array_key_last($stats['daily']) ?: '') ?></span>
    </p>
  </div>
<?php endif ?>

<!-- Health checks --------------------------------------------------------- -->
<h2 class="h-section" style="color:#fff;font-size:17px;margin:36px 0 12px">Health checks</h2>
<?php foreach ($groups as $group => $rows): ?>
  <p class="l" style="margin:20px 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim)"><?= e($group) ?></p>
  <div class="table-wrap">
    <table class="table diag-table">
      <tbody>
      <?php foreach ($rows as $r): ?>
        <tr>
          <td style="width:1%"><span class="diag-state" style="color:<?= $dot[$r['state']] ?>"><?= $word[$r['state']] ?></span></td>
          <td style="width:22%;font-weight:700;color:#fff"><?= e($r['label']) ?></td>
          <td>
            <div class="diag-val"><?= e($r['value']) ?></div>
            <?php if ($r['note'] !== ''): ?><div class="diag-note"><?= e($r['note']) ?></div><?php endif ?>
          </td>
        </tr>
      <?php endforeach ?>
      </tbody>
    </table>
  </div>
<?php endforeach ?>

<p class="dim" style="font-size:12.5px;margin-top:12px">
  <?php if ($probe): ?>
    The SMTP check opened a real TLS connection and authenticated.
    <a class="gold" href="?probe=0">Skip the live probe</a> if this page is slow to load.
  <?php else: ?>
    Live SMTP probe skipped. <a class="gold" href="?probe=1">Run it</a>.
  <?php endif ?>
</p>

<!-- Test email ------------------------------------------------------------ -->
<h2 class="h-section" style="color:#fff;font-size:17px;margin:36px 0 12px">Send a test email</h2>
<div class="card">
  <p class="dim" style="margin:0 0 14px;font-size:13.5px;max-width:64ch">
    Sends one real message through the same code path as the applicant receipt and the admin
    notification. Use a Gmail or Outlook address — if it arrives but lands in spam, the problem is
    SPF/DKIM on the sending domain, not this app.
  </p>
  <form method="post" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
    <input type="hidden" name="action" value="test_email">
    <input class="input" style="width:300px" type="email" name="to" required
           value="<?= e(env('ADMIN_NOTIFY_EMAIL') ?? env('ADMIN_EMAIL') ?? '') ?>"
           placeholder="you@example.com" aria-label="Send test email to">
    <button class="btn btn-primary btn-sm" type="submit">Send test</button>
  </form>
</div>

<!-- Recent activity ------------------------------------------------------- -->
<h2 class="h-section" style="color:#fff;font-size:17px;margin:36px 0 12px">Recent activity</h2>
<div class="table-wrap">
  <table class="table">
    <thead><tr><th>When (UTC)</th><th>Actor</th><th>Action</th><th>Application</th></tr></thead>
    <tbody>
    <?php if (!$activity): ?>
      <tr><td colspan="4" class="dim" style="text-align:center;padding:40px">
        Nothing in the audit log. Every draft save, submit and review writes a row here — an empty
        log with a live site means requests are failing before they reach the database.
      </td></tr>
    <?php endif ?>
    <?php foreach ($activity as $a): ?>
      <tr>
        <td class="dim"><?= e($a['created_at']) ?></td>
        <td><?= e($a['actor']) ?></td>
        <td style="color:#fff"><?= e($a['action']) ?></td>
        <td>
          <?php if (!empty($a['public_id'])): ?>
            <a href="application.php?id=<?= e($a['public_id']) ?>"><?= e($a['public_name'] ?: $a['public_id']) ?></a>
          <?php else: ?>
            <span class="dim">—</span>
          <?php endif ?>
        </td>
      </tr>
    <?php endforeach ?>
    </tbody>
  </table>
</div>

<?php admin_foot(); ?>
