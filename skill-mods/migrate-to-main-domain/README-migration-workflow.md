# Promote pitch pages onto dgtlgroup.io (SEO migration workflow)

Move the hand-picked pages you want to rank from `pitch.dgtlmedia.io/<slug>` (a fresh domain with
zero authority) to `dgtlgroup.io/pitch/<slug>/` (a subdirectory of your established domain), so they
inherit dgtlgroup.io's trust and can actually compete in search.

## Your setup (detected)

- **Main site:** `dgtlgroup.io` is a **self-hosted Next.js app** (App Router; likely Payload CMS) —
  *not* WordPress. It runs as a Node process behind a front web server (almost certainly nginx).
- **Deploys:** `deploy.dgtlmedia.io` writes built pitch HTML onto the **same VPS**, served at
  `pitch.dgtlmedia.io/<slug>`.
- **Consequence:** because everything is on one box, nginx can serve `/pitch/*` from disk *and*
  proxy everything else to Next.js — no second server, no touching the Next build, no redeploy.

## Why this works (the SEO logic)

- **Subdirectory > separate domain.** `dgtlgroup.io/pitch/...` shares the parent domain's authority;
  `pitch.dgtlmedia.io` doesn't. This single change is the biggest ranking lever you have.
- **Canonical + 301 prevent duplicate content.** The promoted copy declares itself canonical at the
  new URL, and the old pitch-subdomain URL 301-redirects to it, so Google consolidates all signal
  onto one address instead of splitting it.
- **Sitemap + internal link = discovery.** A page nobody links to and no sitemap lists can sit
  uncrawled forever. The workflow lists promoted pages in `pitch-sitemap.xml` and reminds you to add
  an internal link.

## The gotcha this avoids

Next.js owns routing for the whole domain via the proxy. A page dropped "somewhere" would either be
swallowed by the Next app or 404. The nginx `location /pitch/` block is matched **before** the
`location /` proxy, so pitch URLs resolve to your static files and never reach Next.

## Files here

| File | What it does |
|------|--------------|
| `detect-setup.sh` | **Read-only.** Reports web server, docroots, the Next process, deploy path, sitemap/robots. Run first. |
| `promote-page.sh` | Promotes one slug: copy → set canonical/og:url → add 301 → rebuild sitemap. **Dry-run by default.** |
| `nginx-pitch.conf` | The two vhost snippets (serve `/pitch/`, include the redirects). One-time setup. |

## Run order

1. **Detect** (nothing changes):
   ```bash
   sudo bash detect-setup.sh | tee dgtl-detect.txt
   ```
   Paste `dgtl-detect.txt` back to me and I'll lock the exact paths — or fill the CONFIG block in
   `promote-page.sh` yourself (`SRC_DIR`, `TARGET_DIR`, `REDIRECTS_CONF`).

2. **One-time nginx setup:** merge the two snippets from `nginx-pitch.conf` into your
   `dgtlgroup.io` and `pitch.dgtlmedia.io` server blocks, then:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **Promote a page — preview first, then apply:**
   ```bash
   sudo bash promote-page.sh my-offer-slug            # dry-run: shows every action
   sudo bash promote-page.sh my-offer-slug --apply     # actually does it
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **Verify:**
   ```bash
   curl -I https://dgtlgroup.io/pitch/my-offer-slug/       # 200
   curl -I https://pitch.dgtlmedia.io/my-offer-slug        # 301 → new URL
   ```

5. **Tell Google:** in Search Console (the `dgtlgroup.io` property) submit
   `https://dgtlgroup.io/pitch/pitch-sitemap.xml`, then URL-Inspect the new URL and Request Indexing.
   Add one internal link to it from an indexed page (footer, `/work`, or another pitch page).

## Notes & caveats

- **Sitemap/robots stay decoupled.** Your Next app generates `dgtlgroup.io/sitemap.xml` and
  `robots.txt` dynamically. Rather than fight that, promoted pages live in a **separate**
  `pitch-sitemap.xml` submitted directly to Search Console. If you'd rather have one master sitemap,
  add a `<sitemap>` reference to the pitch sitemap inside your Next `app/sitemap.ts` (a sitemap index).
- **Keep it to genuinely rank-worthy pages.** You chose a hand-picked set — good. Promoting every
  near-identical prospect page invites thin/doorway-content demotion. Leave those on the pitch
  subdomain (ideally `noindex`).
- **Safety:** `promote-page.sh` is dry-run unless you pass `--apply`, never restarts nginx for you
  (it prints the reload command), and is idempotent — re-running a slug just refreshes it.
- **HTTPS:** the new `/pitch/` path is covered by your existing `dgtlgroup.io` certificate
  automatically — nothing to issue.

## Optional next step

This can become a **companion skill** (e.g. `dgtl-promote-page`) or a one-line hook appended to your
deploy shortcut, so "promote to main domain" is a single command right after a page is built with the
pitch/teaser skills. Say the word and I'll package it.

---

## Relationship to the skills (2026-07-25)

The skills in `engine/` are now written so that this migration does **not** require patching them
when it runs:

- No skill hardcodes a published URL. `canonicalUrl` stays empty in `pitch.json` / `pack.json` until
  a page is actually live, and `canonical` / `og:url` are set to whatever the real URL is at that
  point — `pitch.dgtlmedia.io/<slug>/` today, `dgtlgroup.io/pitch/<slug>/` after promotion.
- Links inside a pitch folder are **relative** (`index.html`, `teaser.html`, `media/…`), so they
  survive promotion untouched. That is the main reason the relative-link rule is enforced by
  `tools/check-links.py` rather than left to taste.
- Cross-*pitch* links are the only absolute ones, and they are the set this workflow has to rewrite.
  Keep them few.

When you promote a page with `promote-page.sh`, update that pitch's `canonicalUrl` in its
`pitch.json` in the same pass, or the repo and the live page will disagree about where it lives.
