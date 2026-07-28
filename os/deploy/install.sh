#!/usr/bin/env bash
# ============================================================
# DGTL OS — production install for an Ubuntu/Debian VPS
# Serves terminal.dgtlmedia.io with open models running ON the server (Ollama),
# behind Caddy (automatic HTTPS + password login). No API key, no per-query cost.
#
# Run as root, from inside the uploaded dgtl-os-local folder:
#     cd dgtl-os-local/deploy
#     sudo DOMAIN=terminal.dgtlmedia.io BASIC_USER=dgtl bash install.sh
#     (it will prompt for a login password)
#
# Re-running is safe — it updates the app and restarts services.
# ============================================================
set -euo pipefail

DOMAIN="${DOMAIN:-terminal.dgtlmedia.io}"
BASIC_USER="${BASIC_USER:-dgtl}"
BASIC_PASS="${BASIC_PASS:-}"
MODEL="${MODEL:-llama3.1:8b}"      # 20 GB box → 8B is a good default; use llama3.2:3b for speed
RATE_PER_MIN="${RATE_PER_MIN:-20}"
APP_DIR="/opt/dgtl-os"
SVC_USER="dgtlos"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$(cd "$HERE/.." && pwd)"  # the dgtl-os-local folder (has server.mjs + html)

echo "==> DGTL OS production deploy"
echo "    domain : $DOMAIN"
echo "    model  : $MODEL"
echo "    source : $SRC_DIR"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then echo "!! Run with sudo / as root."; exit 1; fi
for f in server.mjs dgtl-os-terminal.html; do
  [[ -f "$SRC_DIR/$f" ]] || { echo "!! Missing $SRC_DIR/$f — upload the whole dgtl-os-local folder."; exit 1; }
done

if [[ -z "$BASIC_PASS" ]]; then
  read -rsp "Set a login password for user '$BASIC_USER': " BASIC_PASS; echo
fi
[[ -n "$BASIC_PASS" ]] || { echo "!! Password required."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y

# ---- Node.js 20 ----
if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node --version)"

# ---- Ollama + model (local open-source inference) ----
if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
fi
systemctl enable --now ollama
echo "==> Pulling model '$MODEL' (one-time; can take several minutes)"
ollama pull "$MODEL"

# ---- app files + service user ----
echo "==> Installing app to $APP_DIR"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d "$APP_DIR" "$SVC_USER"
mkdir -p "$APP_DIR"
cp "$SRC_DIR/server.mjs" "$SRC_DIR/dgtl-os-terminal.html" "$APP_DIR/"
chown -R "$SVC_USER:$SVC_USER" "$APP_DIR"

# ---- systemd service (Node app, localhost-only, behind Caddy) ----
echo "==> Creating systemd service dgtl-os"
sed -e "s|__MODEL__|$MODEL|g" -e "s|__RATE__|$RATE_PER_MIN|g" "$HERE/dgtl-os.service" \
  > /etc/systemd/system/dgtl-os.service
systemctl daemon-reload
systemctl enable dgtl-os
systemctl restart dgtl-os

# ---- Caddy (automatic TLS + basic-auth password gate) ----
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Installing Caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
echo "==> Writing Caddy site config"
HASH="$(caddy hash-password --plaintext "$BASIC_PASS")"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__USER__|$BASIC_USER|g" -e "s#__HASH__#$HASH#g" \
  "$HERE/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# ---- firewall: only SSH + web open; Ollama stays on localhost ----
if command -v ufw >/dev/null 2>&1; then
  echo "==> Firewall (OpenSSH + 80/443)"
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 80,443/tcp >/dev/null 2>&1 || true
  yes | ufw enable >/dev/null 2>&1 || true
fi

echo
echo "============================================================"
echo "  DGTL OS is live:  https://$DOMAIN"
echo "  Login user     :  $BASIC_USER   (password you just set)"
echo "  Model          :  $MODEL  (local, on this server)"
echo "------------------------------------------------------------"
echo "  App status  : systemctl status dgtl-os"
echo "  App logs    : journalctl -u dgtl-os -f"
echo "  Ollama      : systemctl status ollama"
echo "  Change model: edit MODEL in /etc/systemd/system/dgtl-os.service,"
echo "                run 'ollama pull <model>', then 'systemctl restart dgtl-os'"
echo "============================================================"
