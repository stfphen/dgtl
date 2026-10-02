// OAuth transaction state: state + nonce + PKCE verifier + where to land,
// carried in one short-lived, HMAC-signed, httpOnly cookie between
// /api/auth/google/start and /callback. Nothing is stored server-side.
// Spec: docs/specs/dgtl-pass/10-auth-and-roles.md.

import crypto from "node:crypto";

export const OAUTH_TX_COOKIE = "dgtl_oauth_tx";
export const OAUTH_TX_TTL_MS = 10 * 60 * 1000;

// Where a sign-in may land. Anything else falls back to the role's home, so
// `next` can never become an open redirect.
export const ALLOWED_NEXT_PATHS = ["/home", "/admin", "/scan", "/passes"];

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function secretKey(secret) {
  const key = Buffer.from(String(secret || ""), "utf8");
  if (key.length < 32) throw new Error("OAUTH_STATE_SECRET must be at least 32 characters.");
  return key;
}

function mac(body, secret) {
  return crypto.createHmac("sha256", secretKey(secret)).update(body).digest("base64url");
}

export function signTx(payload, secret, now = Date.now()) {
  const body = b64url(JSON.stringify({ ...payload, exp: now + OAUTH_TX_TTL_MS }));
  return `${body}.${mac(body, secret)}`;
}

// Returns the payload, or null if the cookie is missing, tampered or expired.
export function verifyTx(value, secret, now = Date.now()) {
  const [body, signature, extra] = String(value || "").split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
  return payload;
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// "/scan" or "/passes/issue" pass; "//evil.com", "https://evil.com",
// "/admin/../x" and "\\evil" don't.
export function safeNext(next) {
  const value = String(next || "");
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value) || value.includes("..")) return null;
  let url;
  try {
    url = new URL(value, "https://local.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://local.invalid") return null;
  const allowed = ALLOWED_NEXT_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  return allowed ? `${url.pathname}${url.search}` : null;
}
