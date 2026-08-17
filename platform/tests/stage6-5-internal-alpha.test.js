import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Stage 6.5 — dgtl.chat internal-alpha deployment guarantees. These pin the
// operational contract that promotes the merged Stage 1-6 build to
// https://dgtl.chat: host routing, release identity, compose env passthrough,
// baseline security headers, and the retired open-CORS legacy AI proxies.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("dgtl.chat is not claimed by any built-in tenant, so it lands on the authenticated app host", async () => {
  const { getTenantClaimingHost } = await import("../lib/store.js");
  assert.equal(await getTenantClaimingHost("dgtl.chat"), null, "dgtl.chat must stay an app host — an active tenant claiming it would serve a public funnel on the OS domain");
  assert.equal(await getTenantClaimingHost("www.dgtl.chat"), null, "www.dgtl.chat must not be tenant-claimed either");
  const page = await readFile(path.join(root, "platform", "app", "page.jsx"), "utf8");
  assert.match(page, /if \(!tenant\) redirect\("\/home"\)/, "unclaimed hosts land on HOME (login-gated)");
});

test("compose passes the Stage 4/6 env contracts through and routes dgtl.chat on the same container", async () => {
  const compose = await readFile(path.join(root, "platform", "docker-compose.yml"), "utf8");
  for (const name of ["CORE_WORKLOG_BASE_URL", "CORE_WORKLOG_EMAIL", "CORE_WORKLOG_PASSWORD", "CORE_WORKLOG_TEAM_ID", "CORE_CHAT_PROVIDER", "CORE_CHAT_MODEL", "CORE_RELEASE_SHA"]) {
    assert.match(compose, new RegExp(`${name}: \\$\\{${name}:-\\}`), `${name} is passed through from .env, never hardcoded`);
  }
  assert.match(compose, /Host\(`dgtl\.chat`\)/, "Traefik routes dgtl.chat");
  assert.match(compose, /traefik\.http\.routers\.dgtlchat\.tls\.certresolver: "letsencrypt"/, "dgtl.chat gets a Let's Encrypt certificate");
  assert.match(compose, /traefik\.http\.routers\.dgtlchat-http\.middlewares: "dgtlmag-redirect"/, "plain HTTP on dgtl.chat redirects to HTTPS");
  assert.doesNotMatch(compose, /CORE_WORKLOG_PASSWORD: (?!\$\{)/, "no literal Worklog password in compose");
  assert.match(compose, /healthcheck:/, "the app container has a process health check");
});

test("the authenticated health endpoint exposes a non-sensitive release identifier", async () => {
  const route = await readFile(path.join(root, "platform", "app", "api", "core", "health", "route.js"), "utf8");
  assert.match(route, /requireSession/, "health stays authenticated");
  assert.match(route, /release: process\.env\.CORE_RELEASE_SHA \|\| ""/, "release identity comes from CORE_RELEASE_SHA only");
  assert.doesNotMatch(route, /DATABASE_URL|ANTHROPIC_API_KEY|CORE_WORKLOG_PASSWORD/, "health never touches secret env values");
});

test("baseline security headers ship globally without a rushed CSP", async () => {
  const config = await readFile(path.join(root, "platform", "next.config.mjs"), "utf8");
  assert.match(config, /X-Content-Type-Options.*nosniff/s, "nosniff everywhere");
  assert.match(config, /Referrer-Policy/, "referrer policy set");
  assert.match(config, /X-Frame-Options.*SAMEORIGIN/s, "SAMEORIGIN, because the generation-job page frames the same-origin sandboxed artifact preview");
  assert.doesNotMatch(config, /key: "Content-Security-Policy"/, "CSP is a deliberate route-aware follow-up, not a global rush job");
});

test("auth redirects are host-preserving — never pinned to PUBLIC_APP_URL", async () => {
  const files = [
    ["app/api/admin/login/route.js"],
    ["app/api/admin/logout/route.js"],
    ["lib/permissions.js"],
    ["lib/stage2/api.js"],
  ];
  for (const [rel] of files) {
    const source = await readFile(path.join(root, "platform", rel), "utf8");
    assert.doesNotMatch(source, /redirect\(new URL\([^)]*PUBLIC_APP_URL/, `${rel}: a redirect built from PUBLIC_APP_URL strands a dgtl.chat login on dgtlmag.com without its host-scoped cookie`);
  }
  const login = await readFile(path.join(root, "platform", "app", "api", "admin", "login", "route.js"), "utf8");
  assert.match(login, /Location: location/, "login redirects via relative Location");
  const permissions = await readFile(path.join(root, "platform", "lib", "permissions.js"), "utf8");
  assert.match(permissions, /Location: "\/admin\/login"/, "auth bounce is a relative Location");
});

test("legacy DGTL OS AI proxies deny unknown origins instead of shipping wildcard CORS", async () => {
  const worker = await readFile(path.join(root, "apps", "dgtl-os", "api", "worker.js"), "utf8");
  const vercel = await readFile(path.join(root, "apps", "dgtl-os", "api", "api", "llm.js"), "utf8");
  for (const [name, source] of [["worker.js", worker], ["api/llm.js", vercel]]) {
    assert.doesNotMatch(source, /Allow-Origin['"]?\s*[:,]\s*['"]\*/, `${name} must not allow every origin`);
    assert.match(source, /ALLOWED_ORIGINS/, `${name} requires an explicit origin allowlist`);
    assert.match(source, /403/, `${name} refuses disallowed origins`);
  }
  const chatServer = await readFile(path.join(root, "platform", "lib", "stage6", "modelAdapter.js"), "utf8");
  assert.doesNotMatch(chatServer, /workers\.dev|dgtl-os/, "Core /chat never routes through the legacy proxy");
});
