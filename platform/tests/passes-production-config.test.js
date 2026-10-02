// DGTL Pass in production: docker-compose passes the container an explicit
// list of variables, so a setting the code reads but compose omits is silently
// unset in production (passes would stay off however .env is written). These
// tests pin that contract, the pass host's routing, and the tenant setup merge.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newPassTenantConfig, withPassSettings } from "../lib/passes/tenantSetup.js";
import { DGTL_TOKENS } from "../lib/passes/brandKit.js";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(platformRoot, ...parts), "utf8");
// Test-only overrides that must never be set in production.
const NOT_FOR_PRODUCTION = new Set(["NODE_ENV", "WALLETWALLET_API_URL"]);

test("compose passes every DGTL Pass and staff sign-in setting through from .env", async () => {
  const compose = await read("docker-compose.yml");
  const sources = [await read("lib", "passes", "config.js"), await read("lib", "oauth", "google.js")].join("\n");
  const names = [...new Set([...sources.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))].filter((name) => !NOT_FOR_PRODUCTION.has(name));
  assert.ok(names.includes("PASS_PUBLIC_BASE_URL") && names.includes("WALLETWALLET_API_KEY") && names.includes("GOOGLE_OAUTH_CLIENT_ID"), names.join(","));
  const missing = names.filter((name) => !new RegExp(`\\n\\s+${name}: \\$\\{${name}:-[^}]*\\}`).test(compose));
  assert.deepEqual(missing, [], `read by the code but not passed through docker-compose.yml: ${missing.join(", ")}`);
  assert.match(compose, /PASSES_DRY_RUN: \$\{PASSES_DRY_RUN:-true\}/, "pass messaging defaults to dry run");
  for (const secret of ["PASS_CREDENTIAL_SECRETS", "WALLETWALLET_API_KEY", "PASSKIT_SIGNER_KEY_B64", "OAUTH_STATE_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET"]) {
    assert.match(compose, new RegExp(`${secret}: \\$\\{${secret}:-\\}`), `${secret} has no literal default`);
  }
});

test("pass.dgtl.ltd routes holder pages only, over HTTPS, to the same app", async () => {
  const compose = await read("docker-compose.yml");
  const rule = /traefik\.http\.routers\.dgtlpass\.rule: "([^"]+)"/.exec(compose)?.[1];
  assert.ok(rule, "a router for the pass host");
  assert.match(rule, /^Host\(`pass\.dgtl\.ltd`\) && \(/, "host-scoped");
  assert.match(rule, /PathPrefix\(`\/p\/`\)/, "holder pages");
  assert.match(rule, /PathPrefix\(`\/_next\/static\/`\)/, "their static files");
  assert.doesNotMatch(rule, /\/admin|\/api|\/scan|\/passes|PathPrefix\(`\/`\)/, "no admin, API, scanner or catch-all on the pass host");
  assert.match(compose, /traefik\.http\.routers\.dgtlpass\.tls\.certresolver: "letsencrypt"/);
  assert.match(compose, /traefik\.http\.routers\.dgtlpass\.service: "dgtlmag"/);
  assert.match(compose, /traefik\.http\.routers\.dgtlpass-http\.middlewares: "dgtlmag-redirect"/, "http redirects to https");
});

test("tenant setup: sets only the passes block, validates, and never claims a host", () => {
  const existing = { id: "tenant_x", slug: "x", brand: { name: "Venue", primaryColor: "#123456" }, template: "funnel", passes: { gates: ["Side"], brandKit: { legal: { termsUrl: "https://venue.test/terms" } } } };
  const merged = withPassSettings(existing, { supportEmail: "help@venue.test", timeZone: "America/Vancouver" });
  assert.equal(merged.template, "funnel", "the rest of the tenant config is untouched");
  assert.deepEqual(merged.brand, existing.brand);
  assert.deepEqual(merged.passes.gates, ["Side"], "existing gates kept unless given");
  assert.equal(merged.passes.timeZone, "America/Vancouver");
  assert.equal(merged.passes.dayCutoffHour, 4);
  assert.deepEqual(merged.passes.brandKit.legal, { termsUrl: "https://venue.test/terms", supportEmail: "help@venue.test" });
  assert.equal(merged.passes.brandKit.walletLogoText, "PASS");
  assert.equal(withPassSettings(existing, { supportEmail: "a@b.co", dgtlLockup: false }).passes.brandKit.walletLogoText, undefined, "a tenant with its own logo opts out of the DGTL lockup");

  for (const [options, pattern] of [
    [{}, /support-email/],
    [{ supportEmail: "a@b.co", timeZone: "Mars/Olympus" }, /time ?zone/i],
    [{ supportEmail: "a@b.co", dayCutoffHour: 12 }, /0 to 8/],
    [{ supportEmail: "a@b.co", termsUrl: "http://venue.test/terms" }, /https/]
  ]) assert.throws(() => withPassSettings(existing, options), pattern);

  const created = newPassTenantConfig({ id: "tenant_dgtl_pass", slug: "dgtl-pass", teamId: "team_default" });
  assert.equal(created.status, "draft", "never published as a funnel");
  assert.deepEqual(created.domains, [], "claims no host");
  assert.equal(created.brand.primaryColor, DGTL_TOKENS["--gold"], "the brand mark from the gold token, not tenant normalisation's legacy blue");
});
