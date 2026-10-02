# DGTL Pass — production deploy to `pass.dgtl.ltd`

Status: prepared 2026-10-02, not yet run. It follows the same deploy loop as
`os-dgtl-ltd-migration-runbook.md`: VPS `37.27.198.189`, the monorepo at `/opt/dgtl`,
compose run from `/opt/dgtl/platform`, Traefik under Coolify, DNS at Hostinger.

**Hosts.** Holders open passes on `pass.dgtl.ltd` (holder pages only, routed in
`platform/docker-compose.yml`). Staff issue at `/passes` and scan at `/scan` on the staff host:
`os.dgtl.ltd`, or `dgtl.chat` until the `os` cutover is done. Both are the same container.

**Two rules that make this different from other deploys:**
1. `PASS_PUBLIC_BASE_URL` is **permanent** once one pass is in someone's hands. Every QR code
   encodes it.
2. The credential key (`PASS_CREDENTIAL_SECRETS`) must be kept forever. Losing it doesn't stop
   issued passes from scanning (the scanner checks a stored hash), but you can no longer show or
   resend their links. To rotate, add `k2` and switch the active key; never delete `k1`.

Never source `.env` in a shell you later run `docker compose` from: exported variables outrank
the file, silently.

---

## 0 · Before you start (Mac, GitHub)

| # | Check |
|---|---|
| 0.1 | `main` contains the production config (this runbook's PR): the pass settings in `docker-compose.yml` `environment:`, the `pass.dgtl.ltd` router, and `npm run passes:setup-tenant`. **Without it, the settings in `.env` never reach the container and passes stay off** |
| 0.2 | It is stacked on the Wallet branding PR (#47), so merging it ships the WalletWallet Pro and own-certificate code too. The free WalletWallet card stays the default until you set `WALLETWALLET_BRANDING=full` or install a certificate |
| 0.3 | The release gate is green on the `main` commit you deploy |
| 0.4 | You have a monitored support mailbox for passes (e.g. `help@dgtl.ltd`). Holders see it on every pass |
| 0.5 | Your WalletWallet key (free is fine) is to hand |

## 1 · Deploy the code with passes still off

Nothing changes for users in this step. Migrations 015–016 only add tables and columns.

```bash
ssh root@37.27.198.189
cd /opt/dgtl && git status --short          # must print nothing (no local edits)
git fetch origin main
cd platform
scripts/backup-db.sh                         # note the file it prints
```

Copy the backup off the box (from the Mac), before anything else:

```bash
scp root@37.27.198.189:/opt/dgtl/platform/backups/<that file>.dump ~/Backups/
```

Then on the VPS:

```bash
cd /opt/dgtl && git merge --ff-only origin/main && cd platform
sed -i "s/^CORE_RELEASE_SHA=.*/CORE_RELEASE_SHA=$(git -C /opt/dgtl rev-parse --short HEAD)/" .env
docker compose config --quiet                # validates compose + .env; prints nothing on success
docker compose build content-funnel
```

> If the build fails with `An error occurred in next/font … reading '1'`, run it again. That's a
> Google Fonts flake, not your code (tracked in Known Issues).

```bash
docker compose run --rm --no-deps content-funnel npm run migrate   # applies 015, 016
docker compose run --rm --no-deps content-funnel npm run migrate   # must say "up to date"
docker compose up -d content-funnel
sleep 35 && docker inspect content-checkout-funnel --format 'health={{.State.Health.Status}}'   # healthy
curl -sI -H "Host: os.dgtl.ltd" http://127.0.0.1:8088/ | head -2   # 307 → /home, as before
```

Sign in at the staff host and click through as usual: the existing app must be unchanged.
**Passes** appears in the Core nav and says passes aren't configured. That's expected.

## 2 · DNS: point `pass.dgtl.ltd` at the VPS (Hostinger)

1. Record the current answer first: `dig +short pass.dgtl.ltd` (it may be empty or the Hostinger
   parking IP `2.57.91.91`).
2. In hPanel, go to **Domains → dgtl.ltd → DNS / Nameservers** and add:

   ```
   A   pass   37.27.198.189   TTL 300
   ```

   Do not touch the apex, `www`, `os`, `deploy` or `pitch`.
3. Wait until `dig +short pass.dgtl.ltd @1.1.1.1` prints `37.27.198.189`.
4. Check routing and TLS. Traefik requests the Let's Encrypt certificate on the first HTTPS hit;
   allow a minute, and watch `docker logs coolify-proxy --tail=50` if it's slow.

   ```bash
   curl -sI http://pass.dgtl.ltd/p/x | head -2               # 301/308 → https
   curl -sI https://pass.dgtl.ltd/ | head -1                 # 404: only /p/ is routed here
   curl -sI https://pass.dgtl.ltd/admin/login | head -1      # 404: no sign-in on the pass host
   echo | openssl s_client -connect pass.dgtl.ltd:443 -servername pass.dgtl.ltd 2>/dev/null | openssl x509 -noout -issuer -enddate
   ```

## 3 · Turn passes on (secrets → `.env` → recreate)

On the VPS, in `/opt/dgtl/platform`:

```bash
cp -p .env ".env.bak-$(date -u +%Y%m%dT%H%M%SZ)"
openssl rand -base64 48        # the credential key: copy it into your password manager NOW
nano .env                      # append the block below; never paste secrets on a command line
```

```dotenv
# --- DGTL Pass ---
PASS_PUBLIC_BASE_URL=https://pass.dgtl.ltd
PASS_CREDENTIAL_SECRETS=k1:<the openssl output>
PASS_CREDENTIAL_ACTIVE_KEY=k1
PASSES_DRY_RUN=true
PASSES_DEFAULT_TIMEZONE=America/Toronto
WALLETWALLET_API_KEY=<your WalletWallet key>
# WALLETWALLET_BRANDING=full   # only after upgrading WalletWallet to Pro (needs PR #47)
```

```bash
docker compose config --quiet
docker compose up -d content-funnel          # recreates the container with the new env
sleep 35 && docker inspect content-checkout-funnel --format 'health={{.State.Health.Status}}'
# What the app sees (prints no secrets):
docker compose exec content-funnel node --input-type=module -e "import('./lib/passes/config.js').then(({ readPassesConfig: r }) => { const c = r(); console.log({ enabled: c.enabled, baseUrl: c.baseUrl, wallet: c.wallet.provider, walletEnabled: c.walletEnabled }) })"
# expect: { enabled: true, baseUrl: 'https://pass.dgtl.ltd', wallet: 'walletwallet', walletEnabled: true }
curl -s https://pass.dgtl.ltd/p/0123456789ABCDEFGHJKMNPQRS | grep -o '<title>[^<]*'   # "Pass not found"
```

A bad value fails loudly. If the container restarts or `/passes` shows a configuration error,
read it there or with `docker logs content-checkout-funnel --tail=80`, then fix `.env`.

## 4 · The tenant passes belong to, and the door staff

Find the team (owners join `default`; see `brain/40-Operations/41-Deployment-Runbook.md`):

```bash
docker compose exec content-funnel-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select slug, name from teams"'
```

Create the DGTL pass tenant and install the five pass types (idempotent, safe to re-run). It is a
draft tenant with no domains, so it never claims a host or changes a public site:

```bash
docker compose run --rm --no-deps content-funnel npm run passes:setup-tenant -- \
  --team default --tenant dgtl-pass --create \
  --support-email help@dgtl.ltd --gates "Main door,VIP entrance"
```

To use an existing tenant instead, drop `--create` and pass its slug. Only that tenant's `passes`
block changes.

**Door staff.** On the staff host: **Legacy admin → Team → Create Credential**, role `verifier`.
- **Password sign-in:** set a 12+ character temporary password.
- **Google sign-in:** choose "Google (no password)". This needs the optional Google setup below.

Door staff can only use `/scan`. Issue passes as owner, admin or sales: the `issuer` role can't
open `/passes` yet.

## 5 · Smoke test on real phones (HTTPS, mobile data)

Do this before any customer gets a pass. Revoke every test pass afterwards.

1. **Issue.** On the staff host, go to `/passes` → tenant **DGTL** → Issue a **Day Pass** to yourself.
2. **Open.** iPhone with Wi-Fi **off**: point the camera at the QR. It must open
   `https://pass.dgtl.ltd/p/…`, with the padlock, the branded card and the code.
3. **Wallet.** Tap **Add to Apple Wallet**. The pass appears in Wallet as the free WalletWallet
   card.
4. **Admit.** Second phone: `https://<staff host>/scan`, signed in as door staff. Tap **Start
   scanning**; the live camera works now that it's HTTPS. Scan the Wallet pass → green **Valid**.
   Scan again → amber **Already scanned**.
5. **Refuse.** Issue a **Single Entry**: scan once → green, again → red **Pass already used**.
6. **Revoke.** Revoke a test pass in `/passes`, scan it → red **Pass revoked**. Its page shows
   "Revoked" with no code.
7. **Android.** Repeat 2–5 on Android Chrome; the torch button should appear.
8. **Live feed.** `/passes` → **Live scans** lists all of the above.

Record the results against the device matrix in `docs/specs/dgtl-pass/06-scanner.md`.

## 6 · Before real customers (go-live gates)

- [ ] The privacy notice names **WalletWallet** as a processor (holder name + pass link), while it
      signs Wallet passes.
- [ ] The support mailbox is monitored. Optionally add a terms page by re-running step 4 with
      `--terms-url https://…`.
- [ ] Branch protection on `main` requires **Required DGTL Core checkpoint**.
- [ ] The backup job runs and keeps an off-box copy, and one restore has been tested on a
      non-production copy (`brain/40-Operations/45-Database-Backups.md`).
- [ ] The credential key is in the password manager. You know the WalletWallet quota (free:
      1,000 creates + updates a month); upgrade before a big event.
- [ ] Everyone knows passes go out **by link or QR only**: email and SMS delivery (Phase 4) aren't
      built yet.

## Optional · Staff Google sign-in

1. In Google Cloud, create an OAuth client (Web) and add
   `https://<staff host>/api/auth/google/callback` as an authorised redirect URI, for each staff
   host.
2. Add to `.env`:
   - `GOOGLE_OAUTH_CLIENT_ID=…`
   - `GOOGLE_OAUTH_CLIENT_SECRET=…`
   - `GOOGLE_OAUTH_REDIRECT_ORIGINS=https://os.dgtl.ltd,https://dgtl.chat`
   - `OAUTH_STATE_SECRET=$(openssl rand -base64 48)`, written into the file, not exported
3. `docker compose up -d content-funnel`. **Continue with Google** appears on the login page. It
   is invite-only: only emails already added on the Team tab get in.

## Later · Better-looking Wallet cards

- **WalletWallet Pro:** upgrade the plan, set `WALLETWALLET_BRANDING=full`, then
  `docker compose up -d content-funnel`.
- **Your own Apple certificate:**
  1. On the Mac, follow `docs/specs/dgtl-pass/18-iphone-demo.md` ("DGTL's own Apple
     certificate"), which uses `npm run passkit:setup`.
  2. Copy the `PASSKIT_*` lines and `PASS_WALLET_PROVIDER=apple` into the VPS `.env`.
  3. Recreate the container.

Passes already in someone's Wallet keep working either way.

## Rollback

| What | How | Effect |
|---|---|---|
| Turn passes off | Remove `PASS_PUBLIC_BASE_URL` from `.env`, then `docker compose up -d content-funnel` | Holder pages 404, issuing and scanning stop (503). All pass data is kept |
| Previous code | `git -C /opt/dgtl checkout --detach <previous sha>`, then `docker compose build content-funnel && docker compose up -d content-funnel` (return later with `git -C /opt/dgtl checkout main`) | Migrations 015–016 are additive: older code ignores them, so no database rollback |
| DNS | Delete the `pass` A record | **Only before go-live.** Once passes are out, their links depend on it |
| Database | `RESTORE_CONFIRM=… scripts/restore-db.sh backups/<file>.dump` | Last resort: undoes every write since the backup |
