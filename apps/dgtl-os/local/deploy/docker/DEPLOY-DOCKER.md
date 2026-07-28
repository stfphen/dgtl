# Deploy DGTL OS on your Traefik VPS (container)

Your VPS runs Traefik (`traefik-public`, entrypoint `websecure`, resolver `letsencrypt`)
and deploys apps as containers. This runs DGTL OS the same way, routed at
`terminal.dgtlmedia.io`, using your host's Ollama for the model.

The earlier systemd + Caddy attempt is retired (steps below); the app + model are proven.

## One-time host prep

**1. Let containers reach the host's Ollama** (bind it to all interfaces):

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0:11434"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

**2. Retire the systemd app** (the container replaces it):

```bash
sudo systemctl disable --now dgtl-os
```

**3. (Security) keep Ollama off the public internet.** It's now on 0.0.0.0:11434 so
containers can reach it. Make sure your VPS/provider firewall only exposes 22/80/443.
If you use ufw:

```bash
sudo ufw allow from 172.16.0.0/12 to any port 11434 proto tcp   # docker networks
sudo ufw deny 11434/tcp                                          # everyone else
```

## Set the login password

Pick a password and generate the basic-auth string (already escaped for compose):

```bash
echo "dgtl:$(openssl passwd -apr1 'YOUR_PASSWORD_HERE')" | sed 's/\$/\$\$/g'
```

Copy the whole output (looks like `dgtl:$$apr1$$....`) and paste it into
`docker-compose.yml`, replacing `__BASICAUTH__`.

## DNS

In Cloudflare (same place `deploy.dgtlmedia.io` lives), add:

```
Type A   Name terminal   Value <your VPS IP>   Proxy: on
```

## Build & run

```bash
cd /root/dgtl-os-local/deploy/docker
docker compose up -d --build
```

Check it:

```bash
docker logs -f dgtl-os      # should show: engine LOCAL/FREE · Ollama · ready ✓
```

Then open **https://terminal.dgtlmedia.io**, log in with `dgtl` + your password, and
run `research Ledger`.

## Manage

```bash
docker compose logs -f          # logs
docker compose restart          # restart
docker compose up -d --build    # redeploy after changing files
docker compose down             # stop & remove
```

Change the model: edit `MODEL` in `docker-compose.yml` (e.g. `llama3.2:3b` for speed),
`docker exec` isn't needed — just make sure the host Ollama has it
(`ollama pull llama3.2:3b`), then `docker compose up -d`.
