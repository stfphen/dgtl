# DGTL Creator & Brand Intake

The application funnel behind **join.dgtlinfluence.com**: a five-step, resumable
application (creators and brands through the same schema), an admin review
queue, and an export pipeline that turns approved applicants into Influence
Journal packs, media kits and portfolio pages.

Built for **Hostinger shared hosting**: static HTML/JS front-end + plain
PHP 8 + MySQL backend on the same host. Media uploads go **browser → Cloudflare
R2** via pre-signed PUT URLs — file bytes never touch Hostinger. No Composer,
no Node, no framework.

## Map

```
.env.example        every config key, with notes (real .env NEVER in git)
schema.sql          MySQL/MariaDB DDL — import once via phpMyAdmin
schema.sqlite.sql   dev twin, auto-applied by lib/db.php
deploy.sh           rsync site/ + cron/ to Hostinger over SSH
cron/maintenance.php  daily: expire links, reap stuck uploads, purge stale drafts
site/               ← the webroot
  index.html        Join DGTL landing (indexable)
  apply.html        the 5-step flow (noindex)          + assets/apply.js
  thanks.html       post-submit + pending badge         (noindex)
  terms.html        plain-language licence + full text  (indexable)
  robots.txt        blocks apply/thanks/admin/api
  assets/intake.css brand-kit tokens (copied from engine/dgtl-brand-kit) + form layer
  assets/logos.js   data-URL brand assets (generated — see below)
  api/*.php         JSON endpoints (draft, magic-link, resume, presign,
                    confirm-upload, delete-media, submit, health)
  admin/*.php       session-authed review queue, detail, actions, export
  lib/*.php         shared PHP (fields registry, validation, R2 SigV4, mailer…)
tests/run.php       unit suites (validation, SigV4 vectors, tokens, limiter)
tests/smoke.sh      end-to-end over HTTP (local php -S or production)
```

Key design decisions:

- **`lib/fields.php` is the single field registry** — steps, types, caps and
  creator/brand requirements. Validation, payload shape, admin display and the
  export schema all derive from it. Change fields there first.
- **One application row** per applicant (`applications.payload` JSON + promoted
  columns for status/email/consents/signature). Statuses:
  `draft → submitted → in_review → approved | rejected | more_info`.
- **Consents are four distinct columns**, never bundled: marketing email
  (CASL), survey panel, broadcast (the Sirius XM lane), AI-training opt-out
  (default ON).
- **Rights step is step 4**; the licence scope/territory/term strings are
  displayed to the applicant but written by the server at submit.
- **SigV4 is hand-rolled** (`lib/r2.php`, ~170 lines) and proven against the
  published AWS documentation vectors in `tests/suite-sigv4.php`. Presigned
  PUT cannot cap size, so `confirm-upload.php` HEAD-verifies every object and
  deletes violations — that HEAD is the authoritative gate.
- **Email is a minimal authenticated-SMTPS client** (`lib/mailer.php`), not a
  vendored library. Deliverability comes from authenticated submission via
  `smtp.hostinger.com:465` plus the domain's SPF/DKIM. Swapping to any other
  relay is a pure `.env` change. In dev, messages land in `dev-mail/*.eml`
  and magic links echo back in the JSON `debug` key.

## Local dev

```bash
cd apps/creator-intake
cp .env.example .env       # fill TOKEN_PEPPER + ADMIN_PASSWORD_HASH (see file)
php -S localhost:8080 -t site
php tests/run.php          # must pass before any deploy
./tests/smoke.sh           # full applicant flow over HTTP
```

SQLite is the default driver; the schema auto-applies on first connect.
R2 presign/upload steps need real R2 creds in `.env` (`SMOKE_R2=1 ./tests/smoke.sh`
exercises a real 1KB PUT against the bucket). Set the bucket's CORS policy
early — allow `PUT` from `https://join.dgtlinfluence.com` and your localhost
origin — untested CORS is the classic works-locally-fails-in-prod trap.

Regenerating `assets/logos.js` after a brand-kit change:

```bash
python3 engine/dgtl-brand-kit/scripts/logo-data-urls.py   # then rebuild the JSON
# (the file header documents the exact shape; it assigns window.DGTL_ASSETS)
```

## Provisioning (one-time)

1. **Hostinger**: hPanel → add website `join.dgtlinfluence.com`; PHP 8.2+;
   enable SSH. Note the server IP and SSH port (usually 65002).
2. **DNS** — *do not touch the root records* (dgtlinfluence.com A-records point
   at the Journal VPS). Add exactly one record: `A join → <Hostinger IP>`.
   Verify `dig join.dgtlinfluence.com` ≠ `dig dgtlinfluence.com`. Issue SSL
   from hPanel once DNS resolves.
3. **MySQL**: hPanel → create DB + user (ALL PRIVILEGES on that DB only);
   import `schema.sql` via phpMyAdmin.
4. **Mailbox**: create `join@dgtlinfluence.com` in Hostinger Email (add the
   MX/SPF/DKIM records it prompts for). **Before launch**: send a test to a
   Gmail address and confirm SPF and DKIM pass in the headers — magic links
   landing in spam kill the resume flow.
5. **R2**: Cloudflare → R2 → create private bucket `dgtl-creator-intake`;
   API token scoped *Object Read & Write, this bucket only*; set the CORS
   policy (PUT + GET from `https://join.dgtlinfluence.com`).
6. **.env**: fill from `.env.example` (`APP_ENV=production`, `DB_DRIVER=mysql`,
   SMTP + R2 + admin hash + a fresh `TOKEN_PEPPER`), then
   `scp -P 65002 .env user@host:~/domains/join.dgtlinfluence.com/.env`
   — one level **above** public_html, outside the webroot.
7. **Deploy**: `./deploy.sh user@host:65002`
8. **Cron**: hPanel → Cron Jobs → daily →
   `php ~/domains/join.dgtlinfluence.com/cron/maintenance.php`
9. **Launch gate**: `./tests/smoke.sh https://join.dgtlinfluence.com`
   (all green), then delete the smoke record from the admin queue.
   Do not launch until the SPF/DKIM check (step 4) and the legal sign-off on
   `terms.html` are done.

## The publish pipeline (approved → Journal)

1. Admin approves → **Download export JSON** on the application page.
2. On the Mac:
   `python3 engine/dgtl-creator-features/scripts/intake-to-pack.py --export dgtl-intake-<id>.json`
   — downloads owner-confirmed media from R2, scaffolds
   `journal/packs/<slug>/` (pack.json status **draft**, `sources.md` rights
   receipt, `backlink-kit.md`), registers it in `packs.index.json`, rebuilds
   the roster. It **exits non-zero while `TODO:` editorial drafts remain** —
   rewrite them in brand voice (or run the dgtl-creator-features skill), then
   re-run with `--rerun --skip-download`.
3. Review the page, flip pack.json to `published`, re-run
   `python3 tools/build-roster.py`, and finish with
   `python3 tools/check-links.py` (must report `missing=0`).

The export JSON is intentionally generator-agnostic: media kits, articles and
portfolio pages can consume the same file.

## Security posture

Same-origin JSON API (no CORS headers, origin belt-and-braces check), bearer
draft tokens (peppered SHA-256 at rest, rotated on magic-link redemption),
honeypot with fake-success, MySQL fixed-window rate limits on every public
endpoint, prepared statements everywhere, private R2 bucket (15-min admin
GETs / 7-day export GETs), hardened admin session + CSRF, `.env` outside the
webroot, audit log on every state change. `signature_ip` uses REMOTE_ADDR;
if the subdomain is ever proxied through Cloudflare set `TRUST_CF_HEADER=1`.
