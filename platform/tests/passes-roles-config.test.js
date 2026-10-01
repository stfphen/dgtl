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
