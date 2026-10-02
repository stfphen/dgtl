import assert from "node:assert/strict";
import test from "node:test";
import {
  CREDENTIAL_LENGTH,
  base32Crockford,
  credentialUrl,
  deriveCredential,
  deriveWalletAuthToken,
  formatShortCode,
  generateShortCode,
  hashCredential,
  normalizeCode,
  parseCredentialSecrets,
  parseScannedPayload,
  safeEqual
} from "../lib/passes/credentials.js";

const SECRET_A = Buffer.alloc(32, 7).toString("base64");
const SECRET_B = Buffer.alloc(32, 9).toString("base64");
const secrets = parseCredentialSecrets(`k1:${SECRET_A}, k2:${SECRET_B}`);
const HOSTS = { allowedHosts: ["pass.example.com"] };

test("base32Crockford uses the unambiguous alphabet", () => {
  assert.equal(base32Crockford(Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff])), "ZZZZZZZZ");
  assert.equal(base32Crockford(Buffer.from([0, 0, 0, 0, 0])), "00000000");
  assert.doesNotMatch(base32Crockford(Buffer.from("any bytes at all, repeated".repeat(4))), /[ILOU]/);
});

test("parseCredentialSecrets rejects short, malformed and duplicate keys", () => {
  assert.equal(secrets.size, 2);
  assert.throws(() => parseCredentialSecrets(`k1:${Buffer.alloc(16).toString("base64")}`), /at least 32 bytes/);
  assert.throws(() => parseCredentialSecrets("nocolon"), /<keyId>:<base64>/);
  assert.throws(() => parseCredentialSecrets(`k1:${SECRET_A},k1:${SECRET_B}`), /Duplicate/);
  assert.throws(() => parseCredentialSecrets(`bad key!:${SECRET_A}`), /Invalid credential key id/);
});

test("deriveCredential is deterministic, 26 chars, and changes with pass, version and key", () => {
  const base = deriveCredential({ passId: "pass_1", version: 1, keyId: "k1", secrets });
  assert.equal(base.length, CREDENTIAL_LENGTH);
  assert.match(base, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(deriveCredential({ passId: "pass_1", version: 1, keyId: "k1", secrets }), base);
  assert.notEqual(deriveCredential({ passId: "pass_2", version: 1, keyId: "k1", secrets }), base);
  assert.notEqual(deriveCredential({ passId: "pass_1", version: 2, keyId: "k1", secrets }), base, "rotation changes the code");
  assert.notEqual(deriveCredential({ passId: "pass_1", version: 1, keyId: "k2", secrets }), base);
  assert.throws(() => deriveCredential({ passId: "pass_1", keyId: "missing", secrets }), /No credential secret/);
  assert.throws(() => deriveCredential({ passId: "pass_1", version: 0, keyId: "k1", secrets }), /positive integer/);
});

test("hashCredential is a stable sha256 hex digest and never the credential itself", () => {
  const credential = deriveCredential({ passId: "pass_1", keyId: "k1", secrets });
  const hash = hashCredential(credential);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashCredential(credential), hash);
  assert.ok(!hash.includes(credential.toLowerCase()));
});

test("wallet auth token is derived, long enough for Apple, and compared in constant time", () => {
  const token = deriveWalletAuthToken({ passId: "pass_1", keyId: "k1", secrets });
  assert.equal(token.length, 32);
  assert.ok(safeEqual(token, deriveWalletAuthToken({ passId: "pass_1", keyId: "k1", secrets })));
  assert.ok(!safeEqual(token, deriveWalletAuthToken({ passId: "pass_2", keyId: "k1", secrets })));
  assert.ok(!safeEqual(token, token.slice(1)));
});

test("normalizeCode folds case, separators and Crockford aliases; rejects foreign characters", () => {
  assert.equal(normalizeCode(" k7m2-qx9p "), "K7M2QX9P");
  assert.equal(normalizeCode("O1IL"), "0111");
  assert.equal(normalizeCode("ABCU"), null, "U is not in the alphabet");
  assert.equal(normalizeCode("<script>"), null);
  assert.equal(normalizeCode(""), null);
  assert.equal(normalizeCode("A".repeat(27)), null);
});

test("short codes are 8 chars and display as XXXX-XXXX", () => {
  const code = generateShortCode(() => Buffer.from([1, 2, 3, 4, 5]));
  assert.equal(code.length, 8);
  assert.equal(formatShortCode(code), `${code.slice(0, 4)}-${code.slice(4)}`);
  assert.equal(formatShortCode("odd"), "odd");
});

test("parseScannedPayload accepts our QR URL, raw credentials and short codes", () => {
  const credential = deriveCredential({ passId: "pass_1", keyId: "k1", secrets });
  const url = credentialUrl("https://pass.example.com/", credential);
  assert.equal(url, `https://pass.example.com/p/${credential}`);
  assert.deepEqual(parseScannedPayload(url, HOSTS), { kind: "credential", credential });
  assert.deepEqual(parseScannedPayload(`${url}/`, HOSTS), { kind: "credential", credential });
  assert.deepEqual(parseScannedPayload(url.replace("/p/", "/p/").toLowerCase(), HOSTS), { kind: "credential", credential });
  assert.deepEqual(parseScannedPayload(credential, HOSTS), { kind: "credential", credential });
  assert.deepEqual(parseScannedPayload("k7m2-qx9p", HOSTS), { kind: "short_code", shortCode: "K7M2QX9P" });
});

test("parseScannedPayload refuses anything that is not ours before it reaches the database", () => {
  const credential = deriveCredential({ passId: "pass_1", keyId: "k1", secrets });
  const cases = [
    ["", "empty"],
    [`https://evil.example/p/${credential}`, "foreign_host"],
    [`http://pass.example.com/p/${credential}`, "insecure_url"],
    ["https://pass.example.com/admin", "bad_path"],
    ["https://pass.example.com/p/short", "bad_path"],
    ["javascript:alert(1)", "insecure_url"],
    ["WIFI:S:guest;T:WPA;P:hunter2;;", "insecure_url"],
    ["hello world", "unrecognized"],
    ["x".repeat(600), "too_long"]
  ];
  for (const [input, reason] of cases) {
    assert.deepEqual(parseScannedPayload(input, HOSTS), { kind: "invalid", reason }, input.slice(0, 40));
  }
  assert.deepEqual(parseScannedPayload(`http://localhost:8088/p/${credential}`, { allowedHosts: ["localhost"] }), {
    kind: "credential",
    credential
  });
});
