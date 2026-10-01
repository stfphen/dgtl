import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { buildAuthorizeUrl, googleConfig, redirectUriFor, verifyIdToken } from "../lib/oauth/google.js";
import { pkceChallenge, safeNext, signTx, verifyTx, OAUTH_TX_TTL_MS } from "../lib/oauth/state.js";

const SECRET = "x".repeat(40);

test("the signed OAuth state cookie round-trips and rejects tampering, expiry and weak secrets", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const cookie = signTx({ state: "s", nonce: "n", codeVerifier: "v", next: "/scan" }, SECRET, now);
  assert.deepEqual({ ...verifyTx(cookie, SECRET, now + 1000), exp: 0 }, { state: "s", nonce: "n", codeVerifier: "v", next: "/scan", exp: 0 });
  assert.equal(verifyTx(cookie, SECRET, now + OAUTH_TX_TTL_MS + 1), null, "expired");
  assert.equal(verifyTx(cookie, "y".repeat(40), now), null, "other secret");
  const [body, sig] = cookie.split(".");
  const forged = Buffer.from(JSON.stringify({ state: "attacker", exp: now + 99999 })).toString("base64url");
  assert.equal(verifyTx(`${forged}.${sig}`, SECRET, now), null, "swapped body");
  assert.equal(verifyTx(`${body}.${sig}x`, SECRET, now), null, "bad signature");
  assert.equal(verifyTx(`${body}.${sig}.extra`, SECRET, now), null, "extra segment");
  assert.equal(verifyTx("", SECRET, now), null);
  assert.throws(() => signTx({}, "short", now), /32 characters/);
});

test("PKCE challenge is the RFC 7636 S256 transform", () => {
  // RFC 7636 appendix B test vector.
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("next is an allow-list of internal paths, never an open redirect", () => {
  assert.equal(safeNext("/scan"), "/scan");
  assert.equal(safeNext("/passes/issue?tenant=x"), "/passes/issue?tenant=x");
  assert.equal(safeNext("/home"), "/home");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/admin/../companies", "/companies", "javascript:alert(1)", "", null, "/scan evil"]) {
    assert.equal(safeNext(bad), null, String(bad));
  }
});

test("the authorize URL asks Google for exactly openid/email/profile with PKCE S256", () => {
  const url = new URL(buildAuthorizeUrl({ clientId: "cid", redirectUri: "https://os.dgtl.ltd/api/auth/google/callback", state: "st", nonce: "no", codeChallenge: "ch" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "st");
  assert.equal(url.searchParams.get("nonce"), "no");
});

test("the callback stays on a registered origin; anything else falls back to the first", () => {
  const config = googleConfig({
    GOOGLE_OAUTH_CLIENT_ID: "cid",
    GOOGLE_OAUTH_CLIENT_SECRET: "sec",
    OAUTH_STATE_SECRET: SECRET,
    GOOGLE_OAUTH_REDIRECT_ORIGINS: "https://os.dgtl.ltd, https://pass.dgtl.ltd"
  });
  assert.equal(config.enabled, true);
  assert.equal(redirectUriFor("https://pass.dgtl.ltd/api/auth/google/start", config), "https://pass.dgtl.ltd/api/auth/google/callback");
  assert.equal(redirectUriFor("https://evil.example/api/auth/google/start", config), "https://os.dgtl.ltd/api/auth/google/callback");
  assert.equal(googleConfig({ GOOGLE_OAUTH_CLIENT_ID: "cid", GOOGLE_OAUTH_CLIENT_SECRET: "sec", OAUTH_STATE_SECRET: "short", PUBLIC_APP_URL: "https://os.dgtl.ltd" }).enabled, false, "weak state secret disables it");
  assert.equal(googleConfig({}).enabled, false);
});

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] });

async function idToken(claims = {}, { issuer = "https://accounts.google.com", audience = "cid", expiresIn = "5m", key = privateKey } = {}) {
  return new SignJWT({ email: "door@venue.test", email_verified: true, nonce: "n1", name: "Door", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject(claims.sub ?? "g-123")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

test("a valid Google ID token yields sub, lowercased email and name", async () => {
  const claims = await verifyIdToken(await idToken({ email: "Door@Venue.Test" }), { clientId: "cid", nonce: "n1", jwks });
  assert.deepEqual(claims, { sub: "g-123", email: "door@venue.test", name: "Door" });
});

test("ID tokens are rejected for wrong audience, issuer, nonce, unverified email, expiry or a foreign key", async () => {
  const other = (await generateKeyPair("RS256")).privateKey;
  const cases = [
    [await idToken({}, { audience: "someone-else" }), /aud/i],
    [await idToken({}, { issuer: "https://evil.example" }), /iss/i],
    [await idToken({ nonce: "replayed" }), /nonce/],
    [await idToken({ email_verified: false }), /not verified/],
    [await idToken({}, { expiresIn: "-1m" }), /exp/i],
    [await idToken({}, { key: other }), /signature/i]
  ];
  for (const [token, pattern] of cases) {
    await assert.rejects(verifyIdToken(token, { clientId: "cid", nonce: "n1", jwks }), pattern);
  }
  await assert.rejects(verifyIdToken(await idToken(), { clientId: "cid", nonce: "", jwks }), /nonce/, "a missing expected nonce fails closed");
});
