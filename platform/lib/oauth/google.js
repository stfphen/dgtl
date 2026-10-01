// Google sign-in (OIDC authorization code + PKCE) for DGTL staff.
//
// Invite-only: Google proves who someone is; the platform decides whether they
// get in. A Google account is accepted only if an active user with that
// verified email already has a team membership. There is no self-signup and
// no just-in-time provisioning. After the first sign-in the account is linked
// by Google's stable `sub`, so a later email change at Google cannot capture a
// different platform account. Spec: docs/specs/dgtl-pass/10-auth-and-roles.md.

import { createRemoteJWKSet, jwtVerify } from "jose";

export const GOOGLE = Object.freeze({
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
  issuers: ["https://accounts.google.com", "accounts.google.com"]
});

const CALLBACK_PATH = "/api/auth/google/callback";
let remoteJwks = null;

function origins(env) {
  const list = String(env.GOOGLE_OAUTH_REDIRECT_ORIGINS || env.PUBLIC_APP_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const out = [];
  for (const value of list) {
    try {
      out.push(new URL(value).origin);
    } catch {
      throw new Error(`GOOGLE_OAUTH_REDIRECT_ORIGINS contains a bad URL: "${value}".`);
    }
  }
  return [...new Set(out)];
}

export function googleConfig(env = process.env) {
  const clientId = String(env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = String(env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const stateSecret = String(env.OAUTH_STATE_SECRET || "");
  const allowedOrigins = origins(env);
  return {
    enabled: Boolean(clientId && clientSecret && stateSecret.length >= 32 && allowedOrigins.length),
    clientId,
    clientSecret,
    stateSecret,
    allowedOrigins
  };
}

// The callback must land on the host the sign-in started from (session
// cookies are host-scoped), and only on a host registered with Google.
export function redirectUriFor(requestUrl, config) {
  const origin = new URL(requestUrl).origin;
  const chosen = config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];
  return `${chosen}${CALLBACK_PATH}`;
}

export function buildAuthorizeUrl({ clientId, redirectUri, state, nonce, codeChallenge }) {
  const url = new URL(GOOGLE.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account"
  }).toString();
  return url.toString();
}

export async function exchangeCode({ code, codeVerifier, redirectUri, clientId, clientSecret, fetchImpl = fetch }) {
  const response = await fetchImpl(GOOGLE.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code"
    }).toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id_token) {
    throw new Error(`Google token exchange failed (${response.status}${data.error ? `: ${data.error}` : ""}).`);
  }
  return data.id_token;
}

function googleJwks() {
  if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(GOOGLE.jwksUrl));
  return remoteJwks;
}

export class GoogleTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "GoogleTokenError";
  }
}

/**
 * Verify the ID token's signature (Google JWKS), issuer, audience and expiry,
 * then the nonce and verified email. Returns { sub, email, name }.
 * `jwks` is injectable so tests can sign tokens with a local key.
 */
export async function verifyIdToken(idToken, { clientId, nonce, jwks = googleJwks(), now } = {}) {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE.issuers,
      audience: clientId,
      ...(now ? { currentDate: now } : {})
    }));
  } catch (error) {
    // Internal detail only: the callback shows the person a generic message.
    throw new GoogleTokenError(`ID token rejected (${error.code || "ERR_JWT"}): ${error.message}`);
  }
  if (!nonce || payload.nonce !== nonce) throw new GoogleTokenError("ID token nonce does not match this sign-in.");
  if (payload.email_verified !== true) throw new GoogleTokenError("Google has not verified this email address.");
  if (!payload.sub || !payload.email) throw new GoogleTokenError("ID token is missing sub or email.");
  return { sub: String(payload.sub), email: String(payload.email).trim().toLowerCase(), name: String(payload.name || "") };
}
