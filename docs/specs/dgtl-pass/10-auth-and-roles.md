# 10 · Auth (Google OAuth) and roles

## What exists

`lib/auth.js` runs database sessions. The session token is 32 random bytes, and only its SHA-256
is stored in `sessions`. It travels in the `content_funnel_admin` cookie (`httpOnly`,
`sameSite=lax`, `secure` in production, 12 h TTL). Login is email + bcrypt password with timing
equalisation. `lib/permissions.js` gates on the membership role. **Keep all of it.** OAuth is
another way to *create the same session*, not a second auth system.

## Google sign-in (OIDC authorization code + PKCE)

Why Google first: every door-staff member has a Google account or can make one, it works
identically on iPhone and Android, and it avoids another password for casual staff. Sign in with
Apple and Microsoft slot into the same `user_identities` table later.

**Invite-only. No self-signup.** A Google login succeeds only when an admin has already added that
person to a team. Anyone else gets "You don't have access. Ask your manager to add
<email>."

```
GET /api/auth/google/start?next=/scan
  state    = 32 random bytes (base64url)
  nonce    = 32 random bytes
  verifier = 32 random bytes → challenge = base64url(sha256(verifier))
  Set-Cookie: oauth_tx=<HMAC-signed {state, nonce, verifier, next, exp:+10min}>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google
  302 → https://accounts.google.com/o/oauth2/v2/auth
          ?client_id=…&redirect_uri=<PUBLIC_APP_URL>/api/auth/google/callback
          &response_type=code&scope=openid%20email%20profile
          &state=…&nonce=…&code_challenge=…&code_challenge_method=S256
          &prompt=select_account

GET /api/auth/google/callback?code=…&state=…
  1. oauth_tx cookie present, signature valid, not expired, state matches (constant-time)
  2. POST https://oauth2.googleapis.com/token (code, client_id, client_secret, redirect_uri, code_verifier)
  3. verify id_token: signature against Google JWKS (https://www.googleapis.com/oauth2/v3/certs, cached),
     iss ∈ {https://accounts.google.com, accounts.google.com}, aud = client_id, exp in future, nonce matches,
     email_verified = true
  4. resolve user:
       user_identities (provider=google, subject=sub) → user          (normal case)
       else users.email = lower(email) AND user active AND has a team membership
            → insert user_identities (link on first login)            (invited case)
       else → reject (no JIT provisioning)
  5. createSession(user) (same table + cookie as password login; extract a shared helper from createAdminSession)
  6. clear oauth_tx; logAudit({ action: "auth.login", metadata: { method: "google" } })
  7. 303 → next if it is in the allow-list [/scan, /admin] else role home (verifier → /scan, others → /admin)
```

- Use **`jose`** (`createRemoteJWKSet` + `jwtVerify`) for ID-token verification. Don't
  hand-roll JWT checks.
- Rate limit `/start` and `/callback` like login (`consumeRateLimit` per IP).
- A membership that is removed or a user who is deactivated loses access on the next session
  lookup, because `getAdminSessionForToken` already checks `users.status`. Removing a door staff
  member ends their shift.
- Once linked, the identity is matched by **`sub`**, so a later email change at Google can't
  capture a different platform account.
- `users.password_hash` becomes nullable (migration 009). `verifyPassword(password, null)` must
  return `false` without calling bcrypt, and the dummy-hash timing path stays for the no-user
  case. **Test it:** a Google-only user can never log in with any password, including an empty one.
- Env: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `OAUTH_STATE_SECRET` (≥ 32 bytes).
  Google Cloud console: OAuth consent screen (External, publishing status "In production", scopes
  `openid email profile`) and authorized redirect URIs for each environment.

## Roles and capabilities

Two roles are added to the flat role list: **`issuer`** and **`verifier`**. Capabilities live in
`lib/passes/permissions.js` (or extend `lib/permissions.js`) as explicit lists, matching the
existing style:

| Capability | owner | admin | sales | issuer | verifier | contractor | viewer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `pass.view` (Passes module, lists, ledger) | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| `pass.issue` (issue, resend, import) | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `pass.verify` (`/scan`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `pass.revoke` (revoke, suspend, reactivate, rotate, extend) | ✓ | ✓ | — | — | — | — | — |
| `pass.configure` (pass types, brand kit, offers, gates) | ✓ | ✓ | — | — | — | — | — |
| `pass.export` (CSV) | ✓ | ✓ | — | — | — | — | — |
| staff management (Team tab: add/remove, roles) | ✓ | ✓ | — | — | — | — | — |

- **`verifier`** has *no* `/admin` access. `app/admin/page.jsx` redirects a verifier to `/scan`,
  and every existing `can*` helper already excludes an unknown role. **Add a test** that walks
  every existing admin API route with a verifier session and expects 403. This is the regression
  that matters most.
- **`issuer`** sees only the Passes module. `CoreShell.jsx` navigation is filtered by capability,
  and every other Core page denies it server-side, not just hidden.
- `sales` gets issue + verify because front-of-house sales staff commonly do both. Remove it from
  the lists if a tenant objects. It is one line.
- Team tab: "Add staff" takes an email + role (+ optional name). It creates the `users` row with a
  null password when new, and a `team_memberships` row. It sends no email in MVP. The admin tells
  staff "sign in with Google at <host>/scan". An invite email is a roadmap nicety.

**Cross-team "super admin"** (DGTL operating every tenant) is not an MVP feature. DGTL staff are
members of each client team they operate, which the platform already supports and which keeps the
isolation model intact.
