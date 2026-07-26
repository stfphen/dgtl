// Signed one-click unsubscribe tokens. The token encodes the recipient's email
// + owning tenant/team so the resulting suppression is scoped to that team
// (never a global tenant_id=NULL row — the H4 fix) and so an anonymous caller
// can't forge a suppression for an arbitrary address.

import crypto from "node:crypto";

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SESSION_SECRET || "dev-unsubscribe-secret";
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function hmac(payloadB64) {
  return crypto.createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function signUnsubscribeToken({ email = "", tenantId = "", teamId = "" } = {}) {
  const payloadB64 = b64url(JSON.stringify({ e: String(email).toLowerCase(), t: tenantId, m: teamId }));
  return `${payloadB64}.${hmac(payloadB64)}`;
}

export function verifyUnsubscribeToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = hmac(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return { email: payload.e || "", tenantId: payload.t || "", teamId: payload.m || "" };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl({ email, tenantId, teamId } = {}) {
  const base = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const token = signUnsubscribeToken({ email, tenantId, teamId });
  const path = `/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
