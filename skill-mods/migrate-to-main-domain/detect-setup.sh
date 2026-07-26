#!/usr/bin/env bash
# ============================================================================
# detect-setup.sh — READ-ONLY recon of the DGTL VPS.
# Makes ZERO changes. Run it on the VPS, then paste the output back so the
# promote workflow can be tuned to your real paths.
#
#   sudo bash detect-setup.sh
#
# (sudo lets it read nginx config and the deploy dirs; it still writes nothing.)
# ============================================================================
set -uo pipefail

line(){ printf '\n\033[1;33m== %s ==\033[0m\n' "$1"; }
note(){ printf '   %s\n' "$*"; }

line "Host"
uname -a 2>/dev/null || true
( . /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" ) || true

line "What is listening on :80 / :443 (the front web server)"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | grep -E ':80 |:443 ' || note "nothing on 80/443?"
else
  netstat -ltnp 2>/dev/null | grep -E ':80 |:443 ' || true
fi

line "nginx"
if command -v nginx >/dev/null 2>&1; then
  nginx -v 2>&1
  note "server blocks + roots/proxy_pass for the two domains:"
  # -T dumps the FULL resolved config; we grep the relevant lines only.
  nginx -T 2>/dev/null | grep -nE 'server_name|root |proxy_pass|listen ' \
    | grep -iE 'dgtlgroup|dgtlmedia|proxy_pass|root |listen ' || note "  (run as root to read config)"
  note "config files that mention the domains:"
  grep -rIlE 'dgtlgroup\.io|dgtlmedia\.io' /etc/nginx 2>/dev/null || note "  none found under /etc/nginx"
else
  note "nginx not installed"
fi

line "Other possible front servers (Caddy / Apache)"
command -v caddy  >/dev/null 2>&1 && { caddy version; note "Caddyfile:"; ls -la /etc/caddy 2>/dev/null; } || note "no caddy"
command -v apache2>/dev/null 2>&1 || command -v httpd >/dev/null 2>&1 && note "apache present (unexpected — check which server is really in front)" || note "no apache"

line "Next.js app process (the thing nginx proxies to)"
ps -eo pid,command 2>/dev/null | grep -iE 'next( |-)|node .*server|payload' | grep -v grep || note "no obvious node/next process"
command -v pm2 >/dev/null 2>&1 && { note "pm2 processes:"; pm2 list 2>/dev/null; } || note "no pm2"
note "systemd services mentioning next/node/dgtl:"
systemctl list-units --type=service 2>/dev/null | grep -iE 'next|node|dgtl|payload' || note "  none obvious"

line "Where the Next project + build live"
for d in /var/www /srv /opt /home/*/ /root; do
  find "$d" -maxdepth 4 -type d -name .next 2>/dev/null
done | sed 's#/.next$##' | sort -u | head -20 || true

line "Where deploy.dgtlmedia.io drops the pitch HTML files"
note "look for recently-written *.html / <slug>/index.html dirs:"
for d in /var/www /srv /opt /home; do
  find "$d" -maxdepth 5 -type f -name 'index.html' -newermt '-60 days' 2>/dev/null \
    | grep -iE 'pitch|deploy|dgtlmedia' | head -20
done || true
note "(if nothing shows, tell me the path deploy.dgtlmedia.io writes to)"

line "Existing sitemap / robots (as SERVED, via localhost)"
for path in /sitemap.xml /robots.txt /pitch-sitemap.xml; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: dgtlgroup.io' "http://127.0.0.1${path}" 2>/dev/null)
  note "dgtlgroup.io${path} -> HTTP ${code}"
done
note "(a dynamic 200 on /sitemap.xml usually means Next generates it in-app)"

line "DONE — copy everything above and paste it back."
