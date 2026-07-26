#!/usr/bin/env bash
# ============================================================================
# promote-page.sh — promote ONE pitch page onto the main authority domain.
#
#   Before:  https://pitch.dgtlmedia.io/<slug>        (fresh domain, no authority)
#   After:   https://dgtlgroup.io/pitch/<slug>/       (subdirectory of the strong domain)
#            + canonical + og:url point to the new URL
#            + old pitch.dgtlmedia.io/<slug> 301-redirects to the new URL
#            + the page is added to pitch-sitemap.xml for Search Console
#
# DRY-RUN by default. Nothing is written until you add --apply.
# Run on the VPS:   sudo bash promote-page.sh <slug> [--apply]
# Fill the CONFIG block from `detect-setup.sh` output first.
# ============================================================================
set -euo pipefail

# ─── CONFIG — set these from detect-setup.sh ────────────────────────────────
MAIN_DOMAIN="dgtlgroup.io"
PITCH_DOMAIN="pitch.dgtlmedia.io"
# Where deploy.dgtlmedia.io currently writes the built pitch pages:
SRC_DIR="/var/www/pitch-deploys"              # expects  $SRC_DIR/<slug>/index.html  (or $SRC_DIR/<slug>.html)
# The folder nginx will serve /pitch/ from (created if missing):
TARGET_DIR="/var/www/dgtl-pitch"              # becomes  $TARGET_DIR/<slug>/index.html
# nginx include file this script appends per-slug 301s to (see nginx-pitch.conf):
REDIRECTS_CONF="/etc/nginx/snippets/pitch-redirects.conf"
# ────────────────────────────────────────────────────────────────────────────

SLUG="${1:-}"
APPLY="no"; [[ "${2:-}" == "--apply" ]] && APPLY="yes"
[[ -z "$SLUG" ]] && { echo "usage: $0 <slug> [--apply]"; exit 1; }

NEW_URL="https://${MAIN_DOMAIN}/pitch/${SLUG}/"
say(){ printf '\033[1;36m•\033[0m %s\n' "$*"; }
run(){ if [[ "$APPLY" == "yes" ]]; then eval "$@"; else printf '  [dry-run] %s\n' "$*"; fi; }

# locate source file (dir/index.html or flat <slug>.html)
SRC=""
[[ -f "$SRC_DIR/$SLUG/index.html" ]] && SRC="$SRC_DIR/$SLUG/index.html"
[[ -z "$SRC" && -f "$SRC_DIR/$SLUG.html" ]] && SRC="$SRC_DIR/$SLUG.html"
[[ -z "$SRC" ]] && { echo "!! source not found: $SRC_DIR/$SLUG(/index).html — check SRC_DIR"; exit 1; }

echo "════════════════════════════════════════════════════════"
echo " Promote '$SLUG'  →  $NEW_URL"
echo " mode: $([[ $APPLY == yes ]] && echo APPLY || echo DRY-RUN)"
echo " src : $SRC"
echo "════════════════════════════════════════════════════════"

# 1) copy into the served folder
say "Copy page into $TARGET_DIR/$SLUG/index.html"
run "mkdir -p '$TARGET_DIR/$SLUG'"
run "cp '$SRC' '$TARGET_DIR/$SLUG/index.html'"

# 2) set canonical + og:url on the promoted copy to the NEW url (idempotent)
say "Rewrite <link rel=canonical> and og:url to $NEW_URL"
PYEDIT=$(cat <<PY
import re,sys
f="$TARGET_DIR/$SLUG/index.html"; url="$NEW_URL"
h=open(f,encoding="utf-8").read()
def upsert(html, pattern, tag):
    if re.search(pattern, html, re.I): return re.sub(pattern, tag, html, count=1, flags=re.I)
    return re.sub(r"(</head>)", tag+"\\n\\1", html, count=1, flags=re.I)
h=upsert(h, r'<link[^>]+rel=["\']canonical["\'][^>]*>', f'<link rel="canonical" href="{url}">')
h=upsert(h, r'<meta[^>]+property=["\']og:url["\'][^>]*>', f'<meta property="og:url" content="{url}">')
open(f,"w",encoding="utf-8").write(h); print("   canonical/og:url set")
PY
)
if [[ "$APPLY" == "yes" ]]; then python3 -c "$PYEDIT"; else echo "  [dry-run] python3 rewrite canonical/og:url in $TARGET_DIR/$SLUG/index.html"; fi

# 3) append a 301 for the old pitch-subdomain URL (dedup)
say "Add 301: https://$PITCH_DOMAIN/$SLUG  →  $NEW_URL"
REDIR_LINE="location = /$SLUG { return 301 ${NEW_URL}; }"
if [[ "$APPLY" == "yes" ]]; then
  mkdir -p "$(dirname "$REDIRECTS_CONF")"; touch "$REDIRECTS_CONF"
  grep -qF "$REDIR_LINE" "$REDIRECTS_CONF" || echo "$REDIR_LINE" >> "$REDIRECTS_CONF"
else
  echo "  [dry-run] append to $REDIRECTS_CONF:  $REDIR_LINE"
fi

# 4) rebuild pitch-sitemap.xml from everything currently promoted
say "Rebuild $TARGET_DIR/pitch-sitemap.xml"
BUILD_SITEMAP=$(cat <<PY
import os,glob,datetime
base="https://$MAIN_DOMAIN/pitch"; d="$TARGET_DIR"
slugs=sorted(n for n in os.listdir(d) if os.path.isfile(os.path.join(d,n,"index.html")))
today=datetime.date.today().isoformat()
out=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for s in slugs: out+= [f"  <url><loc>{base}/{s}/</loc><lastmod>{today}</lastmod></url>"]
out.append("</urlset>")
open(os.path.join(d,"pitch-sitemap.xml"),"w").write("\\n".join(out))
print(f"   sitemap now lists {len(slugs)} page(s)")
PY
)
if [[ "$APPLY" == "yes" ]]; then python3 -c "$BUILD_SITEMAP"; else echo "  [dry-run] regenerate pitch-sitemap.xml including '$SLUG'"; fi

echo
echo "──────────────── NEXT STEPS (you run these) ────────────────"
echo " 1. First time only: add the nginx blocks from nginx-pitch.conf, then:"
echo "        sudo nginx -t && sudo systemctl reload nginx"
echo " 2. If you just added/changed redirects or files:"
echo "        sudo nginx -t && sudo systemctl reload nginx"
echo " 3. Verify:  curl -I $NEW_URL         (expect 200)"
echo "             curl -I https://$PITCH_DOMAIN/$SLUG   (expect 301 → new url)"
echo " 4. Google Search Console (dgtlgroup.io property):"
echo "        Sitemaps → submit  https://$MAIN_DOMAIN/pitch/pitch-sitemap.xml"
echo "        URL Inspection → $NEW_URL → Request indexing"
echo " 5. Add at least one internal link to $NEW_URL from an indexed page"
echo "        (e.g. the Next.js footer/work page, or another pitch page)."
[[ "$APPLY" != "yes" ]] && echo && echo "  ↑ DRY-RUN only. Re-run with --apply to make these changes."
