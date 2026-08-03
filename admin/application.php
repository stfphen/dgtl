<?php
/** Full application record, grouped by step, with media and actions. */
define('APP', true);
require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/admin_ui.php';
require __DIR__ . '/../lib/application.php';
require __DIR__ . '/../lib/audit.php';

admin_require();

$app = app_find_by_public_id($_GET['id'] ?? '');
if (!$app) {
    http_response_code(404);
    exit('Not found');
}
$payload = app_payload($app);

// Opening a submitted record moves it to in_review.
if ($app['status'] === 'submitted') {
    db()->prepare("UPDATE applications SET status = 'in_review', updated_at = ? WHERE id = ?")
        ->execute([now(), $app['id']]);
    audit((int) $app['id'], 'admin', 'admin.open');
    $app['status'] = 'in_review';
}

$st = db()->prepare(
    "SELECT * FROM application_media WHERE application_id = ? AND status = 'stored' ORDER BY kind, id"
);
$st->execute([$app['id']]);
$media = $st->fetchAll();

$groups = [
    'Step 1 · Who you are' => ['applicant_type', 'legal_name', 'public_name', 'email', 'phone',
        'city', 'country', 'pronouns', 'entity_type', 'hst_gst_number'],
    'Step 2 · What they do' => ['primary_category', 'secondary_categories', 'bio_short', 'bio_long',
        'career_highlights', 'notable_press', 'looking_for'],
    'Step 3 · Socials & audience' => ['socials', 'website_url', 'preferred_anchor_text',
        'reciprocal_link_agreed', 'epk_url', 'press_kit_url', 'avg_views_30d',
        'avg_engagement_rate', 'audience_top_geo', 'audience_age_bracket',
        'audience_gender_split', 'analytics_connect_later'],
    'Step 4 · Rights' => ['media_links', 'rights_confirmation', 'licence_scope', 'licence_territory',
        'licence_term', 'derivative_ok', 'broadcast_ok', 'ai_training_optout', 'credit_line',
        'signature_name', 'signature_date'],
    'Step 5 · Rates & closing' => ['rate_ig_post', 'rate_ig_reel', 'rate_tiktok',
        'rate_youtube_integration', 'rate_ugc_package', 'rate_appearance', 'rate_day', 'currency',
        'open_to_gifted', 'exclusivity_conflicts', 'availability_window', 'booking_contact',
        'manager_name', 'manager_email', 'how_did_you_hear', 'referred_by'],
];

function render_value(mixed $v): string
{
    if ($v === true) return '<span class="gold">yes</span>';
    if ($v === false) return 'no';
    if ($v === null || $v === '' || $v === []) return '<span class="dim">—</span>';
    if (is_array($v)) {
        $items = array_map(function ($item) {
            if (is_array($item)) {
                $parts = array_map(fn($k, $x) => e($k) . ': ' . (is_bool($x) ? ($x ? 'yes' : 'no') : e((string) $x)),
                    array_keys($item), $item);
                return implode(' · ', $parts);
            }
            return e((string) $item);
        }, $v);
        return implode('<br>', $items);
    }
    $s = e((string) $v);
    return preg_match('~^https?://~', (string) $v)
        ? '<a href="' . $s . '" rel="noopener noreferrer" target="_blank">' . $s . '</a>' : $s;
}

admin_head($app['public_name'] ?: 'Application');
admin_nav();
?>
<p style="margin-bottom:8px"><a class="dim" href="index.php">← Back to queue</a></p>
<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-bottom:20px">
  <div>
    <h1 style="color:#fff;font-size:26px"><?= e($app['public_name'] ?: '(no name)') ?>
      <?= status_pill($app['status']) ?></h1>
    <p class="dim" style="font-size:13px"><?= e($app['applicant_type']) ?> ·
      ref <?= e($app['public_id']) ?> ·
      submitted <?= e($app['submitted_at'] ?? 'never') ?> ·
      terms <?= e($app['terms_version'] ?? '—') ?></p>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <?php if (in_array($app['status'], ['in_review', 'more_info'], true)): ?>
      <button class="btn btn-primary btn-sm" data-modal="approve">Approve</button>
      <button class="btn btn-secondary btn-sm" data-modal="request_more">Request more</button>
      <button class="btn btn-danger btn-sm" data-modal="reject">Reject</button>
    <?php elseif ($app['status'] === 'approved'): ?>
      <a class="btn btn-primary btn-sm" href="export.php?id=<?= e($app['public_id']) ?>">Download export JSON</a>
    <?php endif ?>
  </div>
</div>

<div class="card card-callout" style="margin-bottom:20px">
  <h2 style="color:#fff;font-size:15px;margin-bottom:8px">Consents (stored distinctly)</h2>
  <p class="dim" style="font-size:14px">
    Marketing email: <strong class="<?= $app['consent_marketing_email'] ? 'gold' : 'dim' ?>"><?= $app['consent_marketing_email'] ? 'YES' : 'no' ?></strong> ·
    Survey panel: <strong class="<?= $app['consent_survey_panel'] ? 'gold' : 'dim' ?>"><?= $app['consent_survey_panel'] ? 'YES' : 'no' ?></strong> ·
    Broadcast: <strong class="<?= $app['consent_broadcast'] ? 'gold' : 'dim' ?>"><?= $app['consent_broadcast'] ? 'YES' : 'no' ?></strong> ·
    AI-training opt-out: <strong class="<?= $app['ai_training_optout'] ? 'gold' : 'dim' ?>"><?= $app['ai_training_optout'] ? 'ON' : 'off' ?></strong>
    <?php if ($app['signature_name']): ?>
      <br>Signed <strong style="color:#fff"><?= e($app['signature_name']) ?></strong>
      at <?= e($app['signature_at']) ?> from IP <?= e($app['signature_ip']) ?>
    <?php endif ?>
  </p>
</div>

<?php if ($app['review_note']): ?>
  <div class="card" style="margin-bottom:20px">
    <h2 style="color:#fff;font-size:15px;margin-bottom:6px">Latest review note</h2>
    <p class="dim" style="font-size:14px;white-space:pre-wrap"><?= e($app['review_note']) ?></p>
  </div>
<?php endif ?>

<?php if ($media): ?>
  <section class="card card-solid" style="margin-bottom:20px">
    <h2 style="color:#fff;font-size:16px;margin-bottom:12px">Media (<?= count($media) ?>)</h2>
    <div class="media-grid">
      <?php foreach ($media as $m): ?>
        <a class="media-thumb" href="media.php?id=<?= (int) $m['id'] ?>" target="_blank" rel="noopener">
          <strong style="display:block;color:#fff;margin-bottom:4px"><?= e($m['kind']) ?></strong>
          <?= e($m['title'] ?: basename((string) $m['r2_key'])) ?><br>
          <span class="dim"><?= e($m['mime']) ?> · <?= number_format((int) $m['bytes'] / 1048576, 1) ?> MB</span>
          <?php if ($m['is_owner'] !== null && !$m['is_owner']): ?>
            <span class="badge-warning" style="display:inline-block;border-radius:9999px;padding:1px 8px;margin-top:4px">3rd-party rights</span>
          <?php endif ?>
        </a>
      <?php endforeach ?>
    </div>
    <p class="dim" style="font-size:12px;margin-top:10px">Links open 15-minute signed URLs from the private bucket.</p>
  </section>
<?php endif ?>

<?php foreach ($groups as $title => $names): ?>
  <section class="card card-solid" style="margin-bottom:20px">
    <h2 style="color:#fff;font-size:16px;margin-bottom:14px"><?= e($title) ?></h2>
    <dl class="detail-grid">
      <?php foreach ($names as $name):
        if (!array_key_exists($name, $payload)) continue; ?>
        <dt><?= e(str_replace('_', ' ', $name)) ?></dt>
        <dd><?= render_value($payload[$name]) ?></dd>
      <?php endforeach ?>
    </dl>
  </section>
<?php endforeach ?>

<!-- action modals -->
<?php
$modals = [
    'approve' => ['Approve this application', 'They get the approval email; the export JSON feeds the pack builder.', 'btn-primary', 'Approve'],
    'request_more' => ['Request more information', 'Re-opens the application and emails them a one-time resume link with your note.', 'btn-secondary', 'Send request'],
    'reject' => ['Reject this application', 'Sends the polite no. They can reapply in 6 months.', 'btn-danger', 'Reject'],
];
foreach ($modals as $key => $conf): ?>
  <div class="modal-back" id="modal-<?= $key ?>" hidden>
    <form method="post" action="action.php" class="card card-solid" style="width:100%;max-width:440px">
      <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
      <input type="hidden" name="id" value="<?= e($app['public_id']) ?>">
      <input type="hidden" name="action" value="<?= $key ?>">
      <h2 style="color:#fff;font-size:18px;margin-bottom:6px"><?= e($conf[0]) ?></h2>
      <p class="dim" style="font-size:14px;margin-bottom:14px"><?= e($conf[1]) ?></p>
      <div class="f-row">
        <label class="f-label" for="note-<?= $key ?>">Note to the applicant <?= $key === 'request_more' ? '' : '(optional)' ?></label>
        <textarea class="textarea" id="note-<?= $key ?>" name="note" <?= $key === 'request_more' ? 'required' : '' ?>></textarea>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button>
        <button type="submit" class="btn <?= $conf[2] ?> btn-sm"><?= e($conf[3]) ?></button>
      </div>
    </form>
  </div>
<?php endforeach ?>

<script>
document.addEventListener('click', function (e) {
  var open = e.target.closest('[data-modal]');
  if (open) document.getElementById('modal-' + open.dataset.modal).hidden = false;
  if (e.target.closest('[data-close]') || e.target.classList.contains('modal-back')) {
    document.querySelectorAll('.modal-back').forEach(function (m) { m.hidden = true; });
  }
});
</script>
<?php admin_foot();
