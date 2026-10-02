import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  ALL_ROLES,
  PASS_CAPABILITIES,
  PASS_ONLY_ROLES,
  __setSessionLoaderForTests,
  canUsePass,
  canViewDashboard,
  canWriteCore,
  passHomeFor,
  requirePassCapability,
  requireRole,
  requireSession
} from "../lib/permissions.js";
import { readPassesConfig } from "../lib/passes/config.js";

afterEach(() => __setSessionLoaderForTests(null));
const as = (role) => __setSessionLoaderForTests(async () => ({ userId: "u", email: "u@x.test", teamId: "t", role }));

test("the capability matrix matches docs/specs/dgtl-pass/10-auth-and-roles.md exactly", () => {
  const expected = {
    owner: ["pass.view", "pass.issue", "pass.verify", "pass.revoke", "pass.configure", "pass.export"],
    admin: ["pass.view", "pass.issue", "pass.verify", "pass.revoke", "pass.configure", "pass.export"],
    sales: ["pass.view", "pass.issue", "pass.verify"],
    issuer: ["pass.view", "pass.issue", "pass.verify"],
    verifier: ["pass.verify"],
    contractor: [],
    viewer: ["pass.view"]
  };
  for (const [role, caps] of Object.entries(expected)) {
    const actual = Object.keys(PASS_CAPABILITIES).filter((cap) => canUsePass({ role }, cap));
    assert.deepEqual(actual, caps, role);
  }
  assert.throws(() => canUsePass({ role: "owner" }, "pass.fly"), /Unknown pass capability/);
});

test("pass-only roles hold no workspace rights at all", () => {
  for (const role of PASS_ONLY_ROLES) {
    assert.ok(!ALL_ROLES.includes(role), `${role} must not be in ALL_ROLES (lead export allows ALL_ROLES)`);
    assert.equal(canViewDashboard({ role }), false, `${role} dashboard`);
    assert.equal(canWriteCore({ role }), false, `${role} core write`);
  }
  assert.equal(passHomeFor({ role: "verifier" }), "/scan");
});

test("requireSession refuses pass-only staff; workspace roles pass through", async () => {
  for (const role of PASS_ONLY_ROLES) {
    as(role);
    await assert.rejects(requireSession(), (e) => e.status === 403, role);
    await assert.rejects(requireRole(ALL_ROLES), (e) => e.status === 403, `${role} via requireRole(ALL_ROLES)`);
  }
  as("viewer");
  assert.equal((await requireSession()).role, "viewer");
  __setSessionLoaderForTests(async () => null);
  await assert.rejects(requireSession(), (e) => e.status === 401);
});

test("requirePassCapability lets each role in exactly where the matrix says", async () => {
  as("verifier");
  assert.equal((await requirePassCapability("pass.verify")).role, "verifier");
  await assert.rejects(requirePassCapability("pass.issue"), (e) => e.status === 403);
  as("issuer");
  assert.equal((await requirePassCapability("pass.issue")).role, "issuer");
  await assert.rejects(requirePassCapability("pass.revoke"), (e) => e.status === 403);
  as("contractor");
  await assert.rejects(requirePassCapability("pass.verify"), (e) => e.status === 403);
  __setSessionLoaderForTests(async () => null);
  await assert.rejects(requirePassCapability("pass.verify"), (e) => e.status === 401);
});

const SECRET = Buffer.alloc(32, 7).toString("base64");

test("pass config: off by default, on when base URL + secrets are set", () => {
  assert.equal(readPassesConfig({}).enabled, false);
  const config = readPassesConfig({
    PASS_PUBLIC_BASE_URL: "https://pass.dgtl.ltd",
    PASS_CREDENTIAL_SECRETS: `k1:${SECRET}`,
    PASS_CREDENTIAL_ACTIVE_KEY: "k1",
    PASS_ALLOWED_SCAN_HOSTS: "Pass.DGTLmag.com, pass.dgtl.ltd"
  });
  assert.equal(config.enabled, true);
  assert.equal(config.baseUrl, "https://pass.dgtl.ltd");
  assert.deepEqual(config.allowedScanHosts, ["pass.dgtl.ltd", "pass.dgtlmag.com"]);
  assert.equal(config.walletEnabled, false);
  assert.equal(config.smsEnabled, false);
});

test("pass config: malformed values fail loudly at load, not at the door", () => {
  const bad = [
    [{ PASS_PUBLIC_BASE_URL: "http://pass.dgtl.ltd" }, /must be https/],
    [{ PASS_PUBLIC_BASE_URL: "https://pass.dgtl.ltd/p" }, /origin with no path/],
    [{ PASS_PUBLIC_BASE_URL: "http://localhost:8088", NODE_ENV: "production" }, /cannot be localhost/],
    [{ PASS_CREDENTIAL_SECRETS: "k1:c2hvcnQ=" , PASS_CREDENTIAL_ACTIVE_KEY: "k1" }, /at least 32 bytes/],
    [{ PASS_CREDENTIAL_SECRETS: `k1:${SECRET}` }, /ACTIVE_KEY is required/],
    [{ PASS_CREDENTIAL_SECRETS: `k1:${SECRET}`, PASS_CREDENTIAL_ACTIVE_KEY: "k2" }, /not one of the configured/]
  ];
  for (const [env, pattern] of bad) assert.throws(() => readPassesConfig(env), pattern, JSON.stringify(env));
  assert.equal(readPassesConfig({ PASS_PUBLIC_BASE_URL: "http://localhost:8088" }).baseUrl, "http://localhost:8088", "http on localhost is fine in dev");
});

test("pass config: a LAN base URL works for a phone demo in development, never in production", () => {
  const lan = readPassesConfig({ PASS_PUBLIC_BASE_URL: "http://192.168.2.131:8090", PASS_CREDENTIAL_SECRETS: `k1:${SECRET}`, PASS_CREDENTIAL_ACTIVE_KEY: "k1" });
  assert.equal(lan.baseUrl, "http://192.168.2.131:8090");
  assert.deepEqual(lan.insecureScanHosts, ["192.168.2.131"], "the scanner accepts http QR codes from this host only");
  for (const url of ["http://10.0.0.5", "http://172.20.1.1:3000", "http://studio.local:8090"]) {
    assert.equal(readPassesConfig({ PASS_PUBLIC_BASE_URL: url }).baseUrl, new URL(url).origin, url);
  }
  assert.throws(() => readPassesConfig({ PASS_PUBLIC_BASE_URL: "http://8.8.8.8" }), /must be https/, "public addresses still need https");
  assert.throws(() => readPassesConfig({ PASS_PUBLIC_BASE_URL: "http://192.168.2.131:8090", NODE_ENV: "production" }), /must be https/);
  assert.throws(() => readPassesConfig({ PASS_PUBLIC_BASE_URL: "https://192.168.2.131", NODE_ENV: "production" }), /private address/);
  assert.deepEqual(readPassesConfig({ PASS_PUBLIC_BASE_URL: "https://pass.dgtl.ltd" }).insecureScanHosts, [], "an https base URL allows no http QR at all");
});

test("pass config: WalletWallet turns Apple Wallet on without an Apple certificate", () => {
  const key = `ww_live_${"0123456789abcdef".repeat(2)}`;
  const on = readPassesConfig({ WALLETWALLET_API_KEY: key });
  assert.equal(on.walletEnabled, true);
  assert.equal(on.wallet.provider, "walletwallet");
  assert.deepEqual(on.wallet.walletwallet, { apiKey: key, apiUrl: "https://api.walletwallet.dev", branding: "preset" });
  assert.equal(readPassesConfig({ WALLETWALLET_API_KEY: key, WALLETWALLET_BRANDING: "full" }).wallet.walletwallet.branding, "full");
  const bad = [
    [{ WALLETWALLET_API_KEY: "sk_live_nope" }, /malformed/],
    [{ PASS_WALLET_PROVIDER: "walletwallet" }, /needs WALLETWALLET_API_KEY/],
    [{ PASS_WALLET_PROVIDER: "apple" }, /PASSKIT_\* certificate set/],
    [{ PASS_WALLET_PROVIDER: "passkit.io" }, /must be one of/],
    [{ WALLETWALLET_API_KEY: key, WALLETWALLET_BRANDING: "gold" }, /preset.*full/],
    [{ WALLETWALLET_API_KEY: key, WALLETWALLET_API_URL: "http://api.walletwallet.dev" }, /must be https/]
  ];
  for (const [env, pattern] of bad) assert.throws(() => readPassesConfig(env), pattern, JSON.stringify(env));
  // A complete PASSKIT_* set selects DGTL's own certificate, and junk in it
  // fails at load (the real-certificate cases are in passes-wallet-signing).
  const junkApple = {
    PASSKIT_TEAM_ID: "T", PASSKIT_PASS_TYPE_ID: "pass.x", PASSKIT_SIGNER_CERT_B64: "c", PASSKIT_SIGNER_KEY_B64: "k", PASSKIT_WWDR_CERT_B64: "w"
  };
  assert.throws(() => readPassesConfig(junkApple), /PASSKIT_SIGNER_CERT_B64/);
  assert.equal(readPassesConfig({ WALLETWALLET_API_KEY: key, PASS_WALLET_PROVIDER: "walletwallet", ...junkApple }).wallet.provider, "walletwallet", "an explicit provider wins, and the unused certificate set is not parsed");
});
