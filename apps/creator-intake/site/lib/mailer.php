<?php
defined('APP') or exit;

/**
 * Email via authenticated SMTPS (implicit TLS, e.g. smtp.hostinger.com:465).
 * Minimal client, no dependencies — our sends are single-recipient
 * text+HTML notifications; deliverability comes from authenticated
 * submission plus the domain's SPF/DKIM, not the client library.
 *
 * In dev (APP_ENV != production) messages are written to
 * apps/creator-intake/dev-mail/*.eml instead of being sent, and
 * mail_last_dev_body() lets endpoints echo magic links back for testing.
 */

function mail_send(string $to, string $subject, string $text, ?string $html = null): bool
{
    $from = env('MAIL_FROM') ?? (is_dev() ? 'dev@localhost.test' : env_require('MAIL_FROM'));
    $fromName = env('MAIL_FROM_NAME', 'DGTL Influence');
    $msgId = '<' . bin2hex(random_bytes(16)) . '@' . substr(strrchr($from, '@'), 1) . '>';
    $boundary = 'b' . bin2hex(random_bytes(12));

    $headers = [
        'Date: ' . gmdate('D, d M Y H:i:s +0000'),
        'From: ' . mail_encode_word($fromName) . " <$from>",
        "To: <$to>",
        'Subject: ' . mail_encode_word($subject),
        "Message-ID: $msgId",
        'MIME-Version: 1.0',
    ];
    if ($html !== null) {
        $headers[] = "Content-Type: multipart/alternative; boundary=\"$boundary\"";
        $body = "--$boundary\r\n"
            . "Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $text . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $html . "\r\n"
            . "--$boundary--\r\n";
    } else {
        $headers[] = 'Content-Type: text/plain; charset=utf-8';
        $headers[] = 'Content-Transfer-Encoding: 8bit';
        $body = $text;
    }
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;

    if (is_dev()) {
        $dir = dirname(__DIR__, 2) . '/dev-mail';
        @mkdir($dir, 0775, true);
        file_put_contents($dir . '/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml', $message);
        $GLOBALS['__last_dev_mail'] = ['to' => $to, 'subject' => $subject, 'text' => $text];
        return true;
    }
    return smtp_submit($from, $to, $message);
}

function mail_last_dev_body(): ?array
{
    return $GLOBALS['__last_dev_mail'] ?? null;
}

/**
 * Why the last send failed, in words.
 *
 * mail_send() returns a bare bool and a failed send must never take a request
 * down, so the reason used to live only in the PHP error log — which is exactly
 * where nobody looks. The admin status page reads this instead.
 */
function mail_last_error(): ?string
{
    return $GLOBALS['__smtp_error'] ?? null;
}

function mail_note_error(string $why): void
{
    $GLOBALS['__smtp_error'] = $why;
    error_log('creator-intake smtp: ' . $why);
}

function mail_encode_word(string $s): string
{
    return preg_match('/[^\x20-\x7E]/', $s)
        ? '=?UTF-8?B?' . base64_encode($s) . '?='
        : $s;
}

function smtp_submit(string $from, string $to, string $message): bool
{
    $GLOBALS['__smtp_error'] = null;

    $host = env('SMTP_HOST');
    $port = (int) env('SMTP_PORT', '465');
    $user = env('SMTP_USER');
    $pass = env('SMTP_PASS');
    if (!$host || !$user || !$pass) {
        // Email not configured yet (staging) — never take the request down over it.
        $absent = [];
        foreach (['SMTP_HOST' => $host, 'SMTP_USER' => $user, 'SMTP_PASS' => $pass] as $k => $v) {
            if (!$v) {
                $absent[] = $k;
            }
        }
        mail_note_error('not configured (missing ' . implode(', ', $absent) . "), skipped send to $to");
        return false;
    }

    $fp = @stream_socket_client(
        "ssl://$host:$port", $errno, $errstr, 20,
        STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]])
    );
    if (!$fp) {
        mail_note_error("connect to ssl://$host:$port failed: $errno $errstr");
        return false;
    }
    stream_set_timeout($fp, 30);

    // Records the server's own words for the stage that failed, so "no emails
    // are arriving" resolves to e.g. "authentication refused: 535 …".
    $last = '';
    $expect = function (array $codes) use ($fp, &$last): bool {
        do {
            $line = fgets($fp, 1024);
            if ($line === false) {
                $last = '(no response — timed out or connection closed)';
                return false;
            }
        } while (isset($line[3]) && $line[3] === '-'); // skip multi-line continuations
        $last = trim((string) $line);
        return in_array((int) substr((string) $line, 0, 3), $codes, true);
    };
    $say = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    $stage = 'greeting';
    $ok = $expect([220]);
    if ($ok) {
        $stage = 'EHLO';
        $say('EHLO ' . (parse_url(env('APP_URL', 'localhost'), PHP_URL_HOST) ?: 'localhost'));
        $ok = $expect([250]);
    }
    if ($ok) {
        $stage = 'AUTH LOGIN';
        $say('AUTH LOGIN');
        $ok = $expect([334]);
    }
    if ($ok) {
        $stage = 'username';
        $say(base64_encode($user));
        $ok = $expect([334]);
    }
    if ($ok) {
        $stage = 'authentication';
        $say(base64_encode($pass));
        $ok = $expect([235]);
    }
    if ($ok) {
        $stage = "MAIL FROM <$from>";
        $say("MAIL FROM:<$from>");
        $ok = $expect([250]);
    }
    if ($ok) {
        $stage = "RCPT TO <$to>";
        $say("RCPT TO:<$to>");
        $ok = $expect([250, 251]);
    }
    if ($ok) {
        $stage = 'DATA';
        $say('DATA');
        $ok = $expect([354]);
    }
    if ($ok) {
        $stage = 'message body';
        // dot-stuff lines starting with '.' per RFC 5321
        fwrite($fp, preg_replace('/^\./m', '..', $message) . "\r\n.\r\n");
        $ok = $expect([250]);
    }
    $say('QUIT');
    fclose($fp);

    if (!$ok) {
        mail_note_error("send to $to rejected at $stage: " . ($last ?: 'no detail'));
    }
    return $ok;
}

// ── Message templates (plain-text first; minimal inline-styled HTML) ─────────

function mail_wrap_html(string $title, string $bodyHtml): string
{
    $gold = '#F0CF50';
    return '<!doctype html><html><body style="margin:0;background:#000;color:#f0f0f0;'
        . 'font-family:Manrope,Arial,sans-serif;padding:32px 16px">'
        . '<div style="max-width:560px;margin:0 auto;background:#0a0a0a;border:1px solid #2a2a2a;'
        . 'border-radius:16px;padding:32px">'
        . '<p style="margin:0 0 24px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;'
        . "color:$gold\">DGTL Influence</p>"
        . '<h1 style="margin:0 0 16px;font-size:22px;color:#fff">' . htmlspecialchars($title) . '</h1>'
        . $bodyHtml
        . '<p style="margin:32px 0 0;font-size:12px;color:#8a8a8a">DGTL Group · Toronto · '
        . 'This email relates to your application to the DGTL creator network.</p>'
        . '</div></body></html>';
}

function mail_button(string $url, string $label): string
{
    return '<p style="margin:24px 0"><a href="' . htmlspecialchars($url) . '" '
        . 'style="display:inline-block;background:#F0CF50;color:#000;text-decoration:none;'
        . 'font-weight:700;padding:12px 24px;border-radius:7px">' . htmlspecialchars($label) . '</a></p>';
}

function mail_magic_link(string $to, string $url): bool
{
    $text = "Pick up your DGTL application where you left off:\n\n$url\n\n"
        . "This link works once and expires in 7 days. If you didn't request it, ignore this email.";
    $html = mail_wrap_html(
        'Resume your application',
        '<p style="margin:0;color:#c8c8c8;font-size:15px;line-height:1.6">Pick up your DGTL '
        . 'application where you left off. This link works once and expires in 7 days.</p>'
        . mail_button($url, 'Resume application')
        . '<p style="margin:0;color:#8a8a8a;font-size:13px">If you didn&rsquo;t request it, ignore this email.</p>'
    );
    return mail_send($to, 'Resume your DGTL Influence application', $text, $html);
}

function mail_submission_receipt(string $to, string $publicName, string $publicId): bool
{
    $text = "Thanks $publicName — your application is in.\n\n"
        . "Reference: $publicId\n\n"
        . "What happens next: our editorial team reviews every application. "
        . "Expect a decision by email within about 10 business days. "
        . "Approved creators get a published profile on the DGTL Influence Journal.\n\n"
        . "Reply to this email if anything changes.";
    $html = mail_wrap_html(
        'Your application is in',
        '<p style="margin:0 0 8px;color:#c8c8c8;font-size:15px;line-height:1.6">Thanks '
        . htmlspecialchars($publicName) . ' — we&rsquo;ve got it. Reference '
        . '<span style="color:#F0CF50">' . htmlspecialchars($publicId) . '</span>.</p>'
        . '<p style="margin:16px 0 0;color:#c8c8c8;font-size:15px;line-height:1.6">Our editorial team '
        . 'reviews every application — expect a decision by email within about 10 business days. '
        . 'Approved creators get a published profile on the DGTL Influence Journal.</p>'
    );
    return mail_send($to, 'DGTL Influence — application received', $text, $html);
}

function mail_review_outcome(string $to, string $publicName, string $kind, string $note, ?string $resumeUrl): bool
{
    $name = htmlspecialchars($publicName);
    $noteBlock = $note !== ''
        ? '<p style="margin:16px 0 0;color:#c8c8c8;font-size:15px;line-height:1.6;border-left:3px solid #F0CF50;'
          . 'padding-left:12px">' . nl2br(htmlspecialchars($note)) . '</p>'
        : '';
    $noteText = $note !== '' ? "\n\nNote from the team:\n$note" : '';

    switch ($kind) {
        case 'approved':
            $subject = 'Welcome to the DGTL Influence network';
            $text = "Good news, $publicName — your application is approved.$noteText\n\n"
                . "Next: our editorial team builds your Journal profile and we'll send the live link "
                . "plus your creator badge and link-back kit.";
            $html = mail_wrap_html('You&rsquo;re in', "<p style=\"margin:0;color:#c8c8c8;font-size:15px;"
                . "line-height:1.6\">Good news, $name — your application is approved. Our editorial team "
                . 'builds your Journal profile next; the live link, your creator badge and link-back kit '
                . 'follow by email.</p>' . $noteBlock);
            break;
        case 'rejected':
            $subject = 'Your DGTL Influence application';
            $text = "Thanks for applying, $publicName. We're not able to bring you onto the roster right now.$noteText\n\n"
                . 'You can reapply after 6 months — and the Journal is always open to pitches.';
            $html = mail_wrap_html('Not this time', "<p style=\"margin:0;color:#c8c8c8;font-size:15px;"
                . "line-height:1.6\">Thanks for applying, $name. We&rsquo;re not able to bring you onto "
                . 'the roster right now. You can reapply after 6 months.</p>' . $noteBlock);
            break;
        default: // request_more
            $subject = 'DGTL Influence — one more thing on your application';
            $text = "Hi $publicName — we need a little more before we can decide.$noteText\n\n"
                . "Pick your application back up here:\n$resumeUrl\n\nThe link works once and expires in 7 days.";
            $html = mail_wrap_html('One more thing', "<p style=\"margin:0;color:#c8c8c8;font-size:15px;"
                . "line-height:1.6\">Hi $name — we need a little more before we can decide.</p>"
                . $noteBlock . ($resumeUrl ? mail_button($resumeUrl, 'Update application') : ''));
    }
    return mail_send($to, $subject, $text, $html);
}
