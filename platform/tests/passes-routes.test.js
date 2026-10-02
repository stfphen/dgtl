// T-R2 (docs/specs/dgtl-pass/14-test-plan.md): every pass route enforces the
// capability matrix of docs/specs/dgtl-pass/10-auth-and-roles.md, for every
// role. The workspace sweep (route-guard-sweep.test.js) skips pass routes
// because door staff are SUPPOSED to reach some of them; this file is where
// "which ones" is pinned. A role the matrix allows gets past the gate (and
// then 503, since there is no database here); every other role gets 403.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { __setSessionLoaderForTests, ALL_ROLES, PASS_CAPABILITIES, PASS_ONLY_ROLES } from "../lib/permissions.js";

register("./support/next-resolve-hook.mjs", import.meta.url);
delete process.env.DATABASE_URL;

const apiRoot = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "app", "api");
const MATRIX = [
  ["admin/passes", "GET", "pass.view"],
  ["admin/passes", "POST", "pass.issue"],
  ["admin/passes/detail", "GET", "pass.view"],
  ["admin/passes/overview", "GET", "pass.view"],
  ["admin/passes/action", "POST", "pass.revoke"],
  ["admin/pass-types", "GET", "pass.view"],
  ["admin/pass-types", "POST", "pass.configure"],
  ["scan/session", "GET", "pass.verify"],
  ["scan/verify", "POST", "pass.verify"]
];

async function passRouteKeys(dir = apiRoot) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await passRouteKeys(full)));
    else if (entry.name === "route.js" && /\brequirePassCapability\b/.test(await readFile(full, "utf8"))) {
      out.push(path.relative(apiRoot, dir).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

const request = (key, method) =>
  new Request(`http://localhost/api/${key}?tenantId=tenant_x&passId=pass_x`, {
    method,
    headers: { accept: "application/json", "content-type": "application/json", "sec-fetch-dest": "empty" },
    ...(method === "POST" ? { body: JSON.stringify({ action: key.endsWith("pass-types") ? "install_presets" : "revoke", tenantId: "tenant_x" }) } : {})
  });
const session = (role) => async () => ({ id: "s", userId: "u", email: `${role}@venue.test`, teamId: "team_x", role, user: { id: "u", name: role }, team: { id: "team_x", name: "Venue" } });
after(() => __setSessionLoaderForTests(null));

test("every route guarded by requirePassCapability is in the matrix", async () => {
  const keys = [...new Set(MATRIX.map(([key]) => key))].sort();
  assert.deepEqual(await passRouteKeys(), keys, "a new pass route needs its row in MATRIX");
});

for (const role of [...ALL_ROLES, ...PASS_ONLY_ROLES]) {
  test(`${role}: pass routes allow exactly what the capability matrix says`, async () => {
    __setSessionLoaderForTests(session(role));
    const wrong = [];
    for (const [key, method, capability] of MATRIX) {
      const mod = await import(pathToFileURL(path.join(apiRoot, key, "route.js")).href);
      const response = await mod[method](request(key, method));
      const expected = PASS_CAPABILITIES[capability].includes(role) ? 503 : 403;
      if (response.status !== expected) wrong.push(`${method} /api/${key} (${capability}) -> ${response.status}, expected ${expected}`);
    }
    assert.deepEqual(wrong, []);
  });
}

test("no session: every pass route answers 401", async () => {
  __setSessionLoaderForTests(async () => null);
  for (const [key, method] of MATRIX) {
    const mod = await import(pathToFileURL(path.join(apiRoot, key, "route.js")).href);
    assert.equal((await mod[method](request(key, method))).status, 401, `${method} /api/${key}`);
  }
});

test("door staff reach the scanner and nothing that changes a pass", () => {
  const verifier = Object.entries(PASS_CAPABILITIES).filter(([, roles]) => roles.includes("verifier")).map(([cap]) => cap);
  assert.deepEqual(verifier, ["pass.verify"]);
  const issuer = Object.entries(PASS_CAPABILITIES).filter(([, roles]) => roles.includes("issuer")).map(([cap]) => cap);
  assert.deepEqual(issuer, ["pass.view", "pass.issue", "pass.verify"], "issuers issue and scan, never revoke or configure");
});
