// DGTL Pass — credential primitives.
//
// A credential is the only thing a QR code or barcode carries. It is an opaque,
// high-entropy string. It holds no PII and no validity claim of its own: the
// server looks it up and decides. See docs/specs/dgtl-pass/05-verification.md.
//
// Design:
//   credential = Crockford-base32( HMAC-SHA256(secret[keyId], "dgtl-pass:v1:<passId>:<version>") )[0..26]
//   passes.credential_hash = sha256(credential)
//
// Consequences:
//   - Verification needs only the hash, never the secret, so the scan path
//     cannot leak or misuse it.
//   - A database dump alone does not yield usable credentials. An attacker
//     needs the dump plus PASS_CREDENTIAL_SECRETS.
//   - Nothing plaintext is stored, but the server can still re-render any
//     pass's QR, Wallet pass or email from passId + version + key.
//   - Rotation bumps credential_version, which changes the credential and the
//     hash. The old QR simply stops resolving.
//

import crypto from "node:crypto";

// Crockford base32: no I, L, O, U — unambiguous when read aloud or typed.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const DECODE_ALIASES = { O: "0", I: "1", L: "1" };

export const CREDENTIAL_LENGTH = 26; // 130 bits
export const SHORT_CODE_LENGTH = 8; // 40 bits — manual entry by authenticated staff only
const CREDENTIAL_CONTEXT = "dgtl-pass:v1";
const WALLET_TOKEN_CONTEXT = "dgtl-pass:wallet:v1";

export function base32Crockford(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

// "k1:<base64>,k2:<base64>" -> Map(keyId -> Buffer). Each secret must decode to
// at least 32 bytes; a short or malformed secret is a deploy error, not a
// runtime surprise, so this throws.
export function parseCredentialSecrets(raw) {
  const secrets = new Map();
  for (const entry of String(raw || "").split(",").map((part) => part.trim()).filter(Boolean)) {
    const sep = entry.indexOf(":");
    if (sep <= 0) throw new Error("PASS_CREDENTIAL_SECRETS entries must look like <keyId>:<base64>.");
    const keyId = entry.slice(0, sep).trim();
    const secret = Buffer.from(entry.slice(sep + 1).trim(), "base64");
    if (!/^[a-z0-9_-]{1,16}$/i.test(keyId)) throw new Error(`Invalid credential key id "${keyId}".`);
    if (secret.length < 32) throw new Error(`Credential secret "${keyId}" must be at least 32 bytes.`);
    if (secrets.has(keyId)) throw new Error(`Duplicate credential key id "${keyId}".`);
    secrets.set(keyId, secret);
  }
  return secrets;
}

function requireSecret(secrets, keyId) {
  const secret = secrets?.get?.(keyId);
  if (!secret) throw new Error(`No credential secret configured for key "${keyId}".`);
  return secret;
}

export function deriveCredential({ passId, version = 1, keyId, secrets }) {
  if (!passId) throw new Error("passId is required.");
  if (!Number.isInteger(version) || version < 1) throw new Error("version must be a positive integer.");
  const mac = crypto
    .createHmac("sha256", requireSecret(secrets, keyId))
    .update(`${CREDENTIAL_CONTEXT}:${passId}:${version}`)
    .digest();
  return base32Crockford(mac).slice(0, CREDENTIAL_LENGTH);
}

// Apple Wallet web-service token (sent back to us as "Authorization: ApplePass <token>").
// Derived the same way so it is never stored; compare with timingSafeEqual.
export function deriveWalletAuthToken({ passId, keyId, secrets }) {
  const mac = crypto
    .createHmac("sha256", requireSecret(secrets, keyId))
    .update(`${WALLET_TOKEN_CONTEXT}:${passId}`)
    .digest();
  return base32Crockford(mac).slice(0, 32);
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashCredential(credential) {
  return crypto.createHash("sha256").update(String(credential)).digest("hex");
}

// Uppercase, drop separators, fold Crockford aliases. Returns null when the
// input cannot be a credential or short code, so callers never hash garbage.
export function normalizeCode(input) {
  const cleaned = String(input ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[OIL]/g, (ch) => DECODE_ALIASES[ch]);
  if (!cleaned || cleaned.length > CREDENTIAL_LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

export function generateShortCode(randomBytes = crypto.randomBytes) {
  return base32Crockford(randomBytes(5)).slice(0, SHORT_CODE_LENGTH);
}

export function formatShortCode(code) {
  const value = String(code || "");
  return value.length === SHORT_CODE_LENGTH ? `${value.slice(0, 4)}-${value.slice(4)}` : value;
}

export function credentialUrl(baseUrl, credential) {
  return `${String(baseUrl).replace(/\/+$/, "")}/p/${credential}`;
}

// What the scanner decoded -> what the verify endpoint should look up.
//
//   https://<allowed host>/p/<credential>  -> { kind: "credential" }   (QR)
//   <26-char credential>                   -> { kind: "credential" }   (Code 128, manual)
//   <8-char short code, with or w/o dash>  -> { kind: "short_code" }   (manual entry)
//   anything else                          -> { kind: "invalid" }
//
// A URL on any other host is rejected before it reaches the database. Scanning a
// random QR at the door must never become a lookup of attacker-chosen input.
export function parseScannedPayload(raw, { allowedHosts = [] } = {}) {
  const text = String(raw ?? "").trim();
  if (!text) return { kind: "invalid", reason: "empty" };
  if (text.length > 512) return { kind: "invalid", reason: "too_long" };

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    let url;
    try {
      url = new URL(text);
    } catch {
      return { kind: "invalid", reason: "bad_url" };
    }
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      return { kind: "invalid", reason: "insecure_url" };
    }
    if (!allowedHosts.map((h) => h.toLowerCase()).includes(host)) {
      return { kind: "invalid", reason: "foreign_host" };
    }
    const match = /^\/p\/([^/?#]+)\/?$/.exec(url.pathname);
    const credential = match && normalizeCode(decodeURIComponent(match[1]));
    if (!credential || credential.length !== CREDENTIAL_LENGTH) return { kind: "invalid", reason: "bad_path" };
    return { kind: "credential", credential };
  }

  const code = normalizeCode(text);
  if (code?.length === CREDENTIAL_LENGTH) return { kind: "credential", credential: code };
  if (code?.length === SHORT_CODE_LENGTH) return { kind: "short_code", shortCode: code };
  return { kind: "invalid", reason: "unrecognized" };
}
