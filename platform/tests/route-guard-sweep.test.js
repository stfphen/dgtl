// T-R1 (docs/specs/dgtl-pass/14-test-plan.md): a door-staff `verifier` session,
// and an `issuer`, must be refused by every workspace API route, current and
// future. The sweep walks app/api, imports each route handler and calls every
// exported method with that session. A route with no session guard at all
// must be on the explicit PUBLIC list below, so a new unguarded route fails
// here instead of shipping.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { __setSessionLoaderForTests, PASS_ONLY_ROLES } from "../lib/permissions.js";

register("./support/next-resolve-hook.mjs", import.meta.url);

// No database: a guard that reaches for one before checking the role would
// throw, and the sweep reports it.
delete process.env.DATABASE_URL;

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(platformRoot, "app", "api");
const GUARD = /\b(requireSession|requireRole|requireCoreWrite|requireCoreApproval|requireCallDelete|requirePassCapability|loadSession|getAdminSession|getCorePageContext)\b/;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Routes that are public or authenticated by something other than a staff
// session (signed webhooks, cron tokens, the sign-in flow itself). Adding to
// this list is a security decision: say why in the comment.
const PUBLIC = new Map([
  ["auth/google/start", "starts sign-in"],
  ["auth/google/callback", "completes sign-in"],
  ["admin/login", "password sign-in"],
  ["admin/logout", "clears the caller's own session"],
  ["checkout", "public tenant checkout"],
  ["leads", "public lead capture"],
  ["funding/survey", "public funding survey"],
  ["unsubscribe", "signed unsubscribe token"],
  ["webhooks/stripe", "Stripe-signed webhook"],
  ["cron/outreach/drain", "bearer cron token"],
  ["telephony/inbound", "Twilio-signed webhook"],
  ["telephony/status", "Twilio-signed webhook"],
  ["telephony/recording", "Twilio-signed webhook"],
  ["telephony/transcription", "Twilio webhook (see Known Issues L4)"],
  ["webhooks/resend", "Svix-signed Resend webhook (verifyResendWebhook)"],
  ["core/generation-worker/jobs/claim", "generation-worker credential (authenticateGenerationWorker)"],
  ["core/generation-worker/jobs/[id]/heartbeat", "generation-worker credential"],
  ["core/generation-worker/jobs/[id]/result", "generation-worker credential"],
  ["core/generation-worker/jobs/[id]/fail", "generation-worker credential"],
  ["core/generation-worker/deployments/claim", "generation-worker credential"],
  ["core/generation-worker/deployments/[id]/result", "generation-worker credential"]
]);

async function routeFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await routeFiles(full)));
    else if (entry.name === "route.js") out.push(full);
  }
  return out.sort();
}

const routeKey = (file) => path.relative(apiRoot, path.dirname(file)).split(path.sep).join("/");
const anyParams = { params: Promise.resolve(new Proxy({}, { get: (_, key) => (typeof key === "string" ? "sweep_test_id" : undefined) })) };

function requestFor(key, method) {
  const url = `http://localhost/api/${key.replace(/\[[^\]]+\]/g, "sweep_test_id")}`;
  const headers = { accept: "application/json", "content-type": "application/json", "sec-fetch-dest": "empty" };
  return new Request(url, method === "GET" || method === "DELETE" ? { method, headers } : { method, headers, body: "{}" });
}

const files = await routeFiles(apiRoot);
after(() => __setSessionLoaderForTests(null));

test("every route without a session guard is a declared public route", async () => {
  const unguarded = [];
  for (const file of files) {
    if (!GUARD.test(await readFile(file, "utf8"))) unguarded.push(routeKey(file));
  }
  const undeclared = unguarded.filter((key) => !PUBLIC.has(key));
  assert.deepEqual(undeclared, [], `unguarded routes not on the PUBLIC list: ${undeclared.join(", ")}`);
  const stale = [...PUBLIC.keys()].filter((key) => !unguarded.includes(key));
  assert.deepEqual(stale, [], `PUBLIC entries that now have a guard (remove them): ${stale.join(", ")}`);
});

for (const role of PASS_ONLY_ROLES) {
  test(`a ${role} session is refused by every guarded workspace route`, async () => {
    __setSessionLoaderForTests(async () => ({
      id: "session_sweep",
      userId: "user_sweep",
      email: `${role}@venue.test`,
      teamId: "team_venue",
      role,
      user: { id: "user_sweep", email: `${role}@venue.test`, name: role, status: "active" },
      team: { id: "team_venue", name: "Venue", slug: "venue" }
    }));
    const leaks = [];
    let checked = 0;
    for (const file of files) {
      const key = routeKey(file);
      const source = await readFile(file, "utf8");
      if (PUBLIC.has(key) || /\brequirePassCapability\b/.test(source)) continue;
      const mod = await import(pathToFileURL(file).href);
      for (const method of METHODS) {
        if (typeof mod[method] !== "function") continue;
        checked += 1;
        let status;
        let location = "";
        try {
          const response = await mod[method](requestFor(key, method), anyParams);
          status = response?.status;
          location = response?.headers?.get?.("location") || "";
        } catch (error) {
          status = `threw: ${error?.message?.slice(0, 80)}`;
        }
        const refused = status === 401 || status === 403 || (status === 303 && /\/admin\/login/.test(location));
        if (!refused) leaks.push(`${method} /api/${key} -> ${status}`);
      }
    }
    assert.ok(checked > 50, `expected to exercise the workspace API, checked ${checked}`);
    assert.deepEqual(leaks, [], `${role} reached:\n${leaks.join("\n")}`);
  });
}

test("Core pages send pass-only staff to the scanner, not into the workspace", async () => {
  const { getCorePageContext } = await import("../lib/core/server.js");
  __setSessionLoaderForTests(async () => ({ role: "verifier", teamId: "team_venue", user: { id: "u" } }));
  await assert.rejects(getCorePageContext(), (error) => String(error?.digest || error?.message).includes("/scan"));
});
