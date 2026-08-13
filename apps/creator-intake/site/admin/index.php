<?php
/** Review queue — filterable list of applications. */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/admin_ui.php';
require __DIR__ . '/../lib/fields.php';

admin_require();

$status = $_GET['status'] ?? 'inbox';
$type = $_GET['type'] ?? '';
$q = trim($_GET['q'] ?? '');

$where = ['is_spam = 0'];
$args = [];
if ($status === 'inbox') {
    $where[] = "status IN ('submitted','in_review')";
} elseif ($status !== 'all') {
    $where[] = 'status = ?';
    $args[] = $status;
}
if (in_array($type, APPLICANT_TYPES, true)) {
    $where[] = 'applicant_type = ?';
    $args[] = $type;
}
if ($q !== '') {
    $where[] = '(email LIKE ? OR public_name LIKE ?)';
    $args[] = "%$q%";
    $args[] = "%$q%";
}

$st = db()->prepare(
    'SELECT a.*, (SELECT COUNT(*) FROM application_media m
        WHERE m.application_id = a.id AND m.status = \'stored\') AS media_n
     FROM applications a WHERE ' . implode(' AND ', $where) . '
     ORDER BY CASE WHEN a.submitted_at IS NULL THEN 1 ELSE 0 END, a.submitted_at ASC, a.updated_at DESC
     LIMIT 200'
);
$st->execute($args);
$rows = $st->fetchAll();

$tabs = [
    'inbox' => 'Inbox', 'more_info' => 'More info', 'approved' => 'Approved',
    'rejected' => 'Rejected', 'draft' => 'Drafts', 'all' => 'All',
];

// Headline counts, so the queue answers "is anything coming in?" at a glance.
// Cheap enough to run on every load; the deep checks live on status.php.
require __DIR__ . '/../lib/diagnostics.php';
$stats = diag_stats();

admin_head('Queue');
admin_nav('queue');
?>
<h1 style="color:#fff;font-size:24px;margin-bottom:4px">Review queue</h1>
<p class="dim" style="font-size:14px">Submitted applications, oldest first. Opening one moves it to “in review”.</p>

<div class="statband" style="margin:20px 0">
  <div><div class="n"><?= (int) (($stats['by_status']['submitted'] ?? 0) + ($stats['by_status']['in_review'] ?? 0)) ?></div><div class="l">Awaiting review</div></div>
  <div><div class="n"><?= (int) $stats['submitted_7d'] ?></div><div class="l">Submitted · 7d</div></div>
  <div><div class="n"><?= (int) ($stats['by_status']['draft'] ?? 0) ?></div><div class="l">In progress</div></div>
  <div><div class="n"><?= (int) $stats['total'] ?></div><div class="l">All time</div></div>
</div>

<?php if ($stats['error'] || $stats['total'] === 0 || is_dev()): ?>
  <div class="card card-callout" style="margin:0 0 20px">
    <p style="margin:0;font-size:13.5px;color:#c8c8c8">
      <?php if ($stats['error']): ?>
        The database could not be read. <a class="gold" href="status.php">Run the health checks</a>.
      <?php elseif (is_dev()): ?>
        <strong style="color:#fff">This server is running in dev mode.</strong> Submissions go to a
        local SQLite file and emails are written to disk instead of sent.
        <a class="gold" href="status.php">See what to change</a>.
      <?php else: ?>
        No applications in this database yet. If the site is live and taking submissions, they are
        landing somewhere else — <a class="gold" href="status.php">check where the app is writing</a>.
      <?php endif ?>
    </p>
  </div>
<?php endif ?>

<form class="filter-row" method="get">
  <?php foreach ($tabs as $key => $label): ?>
    <a class="fpill<?= $status === $key ? ' active' : '' ?>"
       href="?status=<?= e($key) ?><?= $type ? '&type=' . e($type) : '' ?>"><?= e($label) ?></a>
  <?php endforeach ?>
  <select class="select" name="type" style="width:auto" onchange="this.form.submit()">
    <option value="">All types</option>
    <option value="creator" <?= $type === 'creator' ? 'selected' : '' ?>>Creators</option>
    <option value="brand" <?= $type === 'brand' ? 'selected' : '' ?>>Brands</option>
  </select>
  <input type="hidden" name="status" value="<?= e($status) ?>">
  <input class="input" style="width:220px" type="search" name="q" value="<?= e($q) ?>"
         placeholder="Search name or email" aria-label="Search">
  <button class="btn btn-secondary btn-sm" type="submit">Search</button>
</form>

<div class="table-wrap">
  <table class="table">
    <thead><tr>
      <th>Name</th><th>Type</th><th>Category</th><th>Email</th>
      <th class="num">Media</th><th>Submitted</th><th>Status</th>
    </tr></thead>
    <tbody>
    <?php if (!$rows): ?>
      <tr><td colspan="7" class="dim" style="text-align:center;padding:40px">Nothing here.</td></tr>
    <?php endif ?>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td><a href="application.php?id=<?= e($r['public_id']) ?>" style="font-weight:700">
          <?= e($r['public_name'] ?: '(no name yet)') ?></a></td>
        <td><?= e($r['applicant_type']) ?></td>
        <td><?= e($r['primary_category'] ?? '—') ?></td>
        <td class="dim"><?= e($r['email']) ?></td>
        <td class="num"><?= (int) $r['media_n'] ?></td>
        <td class="dim"><?= e($r['submitted_at'] ? substr($r['submitted_at'], 0, 10) : '—') ?></td>
        <td><?= status_pill($r['status']) ?></td>
      </tr>
    <?php endforeach ?>
    </tbody>
  </table>
</div>
<?php admin_foot();
