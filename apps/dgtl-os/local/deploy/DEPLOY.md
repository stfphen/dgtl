# Deploy DGTL OS to your VPS (production, open models)

This puts DGTL OS at **https://terminal.dgtlmedia.io**, running an open-source model
**on the server** (Ollama) behind Caddy with automatic HTTPS and a password login.
No API key, no per-query cost — the cost is the VPS itself.

## How this differs from running on your Mac

| | Local (Mac) | Production (VPS) |
|---|---|---|
| Who runs the model | your Mac | the **server**, for every visitor |
| Reach | just you | anyone with the URL + password |
| Needs | Node + Ollama | Node + Ollama + **domain, TLS, auth, firewall, auto-restart** |
| Cost | free | fixed monthly VPS cost |
| Speed | your Mac's CPU/GPU | the VPS's CPU (8B model ≈ a few seconds/answer) |

The install script handles TLS, the password gate, the firewall, and boot/crash
auto-restart for you.

## Prerequisites

- An **Ubuntu 22.04 / 24.04** VPS with root (or sudo) SSH access — your ~20 GB box is plenty.
- The **domain** `terminal.dgtlmedia.io` under your control.
- The `dgtl-os-local` folder (this one) uploaded to the server.

## Step 1 — Point the domain at the VPS

In your DNS, add an **A record**:

```
terminal.dgtlmedia.io   →   <your VPS IP address>
```

Wait a few minutes for it to resolve (`ping terminal.dgtlmedia.io` should show the VPS IP).
Caddy can only issue the HTTPS certificate once DNS points at the box.

## Step 2 — Upload the folder to the VPS

From your Mac (replace the IP/user):

```bash
scp -r ~/content-checkout-funnel/dgtl-os-local root@<VPS_IP>:/root/
```

(Or use your host's file manager / hPanel to upload the `dgtl-os-local` folder.)

## Step 3 — Run the installer

SSH in and run it:

```bash
ssh root@<VPS_IP>
cd /root/dgtl-os-local/deploy
sudo DOMAIN=terminal.dgtlmedia.io BASIC_USER=dgtl bash install.sh
```

It will ask you to set a **login password**, then install Node, Ollama, and the
`llama3.1:8b` model, wire up the service, and configure Caddy + the firewall. The
model download is the slow part (one-time).

When it finishes it prints the live URL.

## Step 4 — Open it

Visit **https://terminal.dgtlmedia.io**, log in with `dgtl` + your password, and run
`research Ledger`. The answer is generated on your server.

---

## Managing it

```bash
systemctl status dgtl-os          # app health
journalctl -u dgtl-os -f          # live app logs
systemctl restart dgtl-os         # restart the app
systemctl status ollama           # model runtime health
```

**Change the model** (e.g. faster 3B, or a sharper one):

```bash
ollama pull llama3.2:3b
sudo sed -i 's/^Environment=MODEL=.*/Environment=MODEL=llama3.2:3b/' /etc/systemd/system/dgtl-os.service
sudo systemctl daemon-reload && sudo systemctl restart dgtl-os
```

**Update the app** after editing files locally: re-upload the folder and re-run
`sudo bash install.sh` — it copies the new files and restarts.

## Access options (default is password)

- **Password (default):** set by the installer, enforced by Caddy for the whole site.
- **Lock to specific IPs instead:** remove the `basic_auth {…}` block from
  `/etc/caddy/Caddyfile` (`sudo systemctl reload caddy`), then restrict with the
  firewall, e.g. `sudo ufw allow from <your.ip> to any port 443`.
- **Fully open (demo only):** remove the `basic_auth` block and leave the firewall
  as-is. Not recommended — anyone could use your server's compute.

## Security notes

- Ollama listens on `127.0.0.1:11434` only; it is never exposed publicly.
- The Node app binds `127.0.0.1:8787`; only Caddy reaches it.
- `/api/llm` is rate-limited (default 20 requests/min per IP) — tune `RATE_PER_MIN`
  in the service file.
- The firewall opens only SSH, 80, and 443.
