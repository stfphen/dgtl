import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTenantClaimingHost } from "../lib/store.js";
import {
  DGTL_HOUSE_APP,
  DGTL_HOUSE_APPLE_TOUCH_ICON,
  DGTL_HOUSE_ICONS,
  buildAppManifest
} from "../lib/branding/appManifest.js";

// The web-app install identity. These exist because of a real, shipped bug:
// /manifest.webmanifest and /branding/icon resolved the host with
// getTenantForHost, whose final clause returned an ARBITRARY active tenant for
// an unclaimed host — from a `select ... where status = 'active'` with no
// ORDER BY. dgtl.chat, dgtlmag.com and www.dgtlmag.com are all unclaimed, so
// all three installed to the home screen branded "DMTV", a client.
//
// The invariant used to be asserted only on getTenantClaimingHost (see
// stage6-5-internal-alpha.test.js) while the routes called the other function,
// so the test passed and the bug shipped. These tests close that gap.

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFile(path.join(platformRoot, ...parts), "utf8");

// Every brand a tenant could leak into a DGTL install.
const TENANT_BRAND_NAMES = ["DMTV", "ELiXR", "Content Day", "ON Home Decor", "Polish Stone"];

// The hosts Traefik actually routes to this container (platform/docker-compose.yml),
// plus the dev hosts. None is claimed by a tenant: defaultTenant.domains is [].
const UNCLAIMED_HOSTS = [
  "dgtl.chat",
  "www.dgtl.chat",
  "dgtlmag.com",
  "www.dgtlmag.com",
  "localhost",
  "127.0.0.1",
  ""
];

test("an unclaimed host installs as DGTL, never as a tenant", async () => {
  for (const host of UNCLAIMED_HOSTS) {
    const tenant = await getTenantClaimingHost(host);
    assert.equal(tenant, null, `${host || "(empty host)"} must not be claimed by any tenant`);

    const manifest = buildAppManifest(tenant);
    assert.equal(manifest.name, "DGTL.chat", `${host} manifest name`);
    assert.equal(manifest.short_name, "DGTL", `${host} home-screen label`);
    assert.equal(manifest.theme_color, "#000000", `${host} theme colour`);
    assert.notEqual(manifest.theme_color, "#f7d64a", `${host} must not inherit DMTV's yellow`);

    const serialized = JSON.stringify(manifest);
    for (const brand of TENANT_BRAND_NAMES) {
      assert.doesNotMatch(serialized, new RegExp(brand, "i"), `${host} manifest must not mention ${brand}`);
    }
  }
});

test("buildAppManifest(null) is exactly the DGTL house identity", () => {
  assert.deepEqual(buildAppManifest(null), { ...DGTL_HOUSE_APP, icons: [...DGTL_HOUSE_ICONS] });
  assert.equal(DGTL_HOUSE_APP.start_url, "/home");
  assert.equal(DGTL_HOUSE_APP.display, "standalone", "installability requires a display mode");
});

test("no regression: a host a tenant explicitly claims still installs as that tenant", async () => {
  // Both are built-in tenants, so this needs no database.
  for (const host of ["on-homedecor.com", "polishstone.ca"]) {
    const tenant = await getTenantClaimingHost(host);
    assert.ok(tenant, `${host} must still resolve to its tenant`);

    const manifest = buildAppManifest(tenant);
    assert.equal(manifest.name, tenant.brand.name, `${host} keeps its own name`);
    assert.equal(manifest.theme_color, tenant.brand.primaryColor, `${host} keeps its own theme colour`);
    assert.equal(manifest.start_url, "/", "a tenant funnel starts at its own root, not /home");
    assert.notEqual(manifest.name, "DGTL.chat", `${host} must not be rebranded to DGTL`);
  }
});

test("a tenant with a custom icon still serves it through /branding/icon", async () => {
  const tenant = await getTenantClaimingHost("on-homedecor.com");
  const manifest = buildAppManifest(tenant, { hasCustomIcon: true });
  assert.ok(manifest.icons.every((icon) => icon.src === "/branding/icon"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});

test("every icon the house manifest advertises exists on disk", () => {
  for (const icon of DGTL_HOUSE_ICONS) {
    const file = path.join(platformRoot, "public", icon.src.replace(/^\//, ""));
    assert.ok(existsSync(file), `manifest advertises a missing icon: ${icon.src}`);
  }
  const apple = path.join(platformRoot, "public", DGTL_HOUSE_APPLE_TOUCH_ICON.replace(/^\//, ""));
  assert.ok(existsSync(apple), `missing apple-touch icon: ${DGTL_HOUSE_APPLE_TOUCH_ICON}`);
  assert.match(DGTL_HOUSE_APPLE_TOUCH_ICON, /\.png$/, "iOS ignores SVG apple-touch icons");

  // Chrome's installability bar: at least one 192 and one 512.
  for (const size of ["192x192", "512x512"]) {
    assert.ok(DGTL_HOUSE_ICONS.some((icon) => icon.sizes === size && icon.purpose === "any"), `missing a ${size} "any" icon`);
  }
});

test("the unsafe host resolver is gone and cannot be called again", async () => {
  const store = await read("lib", "store.js");
  assert.doesNotMatch(store, /export async function getTenantForHost/, "getTenantForHost must stay deleted");
  assert.doesNotMatch(
    store,
    /tenants\.find\(\(tenant\) => getRenderableTenantConfig\(tenant, "published"\)\.status === "active"\)/,
    "the arbitrary-active-tenant fallback must not come back"
  );

  for (const route of [["app", "manifest.webmanifest", "route.js"], ["app", "branding", "icon", "route.js"]]) {
    const source = await read(...route);
    assert.match(source, /getTenantClaimingHost/, `${route.join("/")} must resolve hosts with no fallback`);
    assert.doesNotMatch(source, /await getTenantForHost/, `${route.join("/")} must not call getTenantForHost`);
  }
});

test("the manifest's colours stay pinned to the brand stylesheet", async () => {
  // The token layer moved in #34: every brand value now lives in the one
  // canonical app/dgtl-tokens.css rather than in the admin sheet. The assertion
  // is unchanged in intent — it just follows the source.
  const css = await read("app", "dgtl-tokens.css");

  // A JSON manifest cannot reference a CSS custom property, so the two colours
  // are duplicated. This asserts the duplicate still matches its source.
  const bg = css.match(/--bg:\s*(#[0-9a-fA-F]{3,8})/);
  assert.ok(bg, "dgtl-admin.css must declare --bg");
  assert.equal(DGTL_HOUSE_APP.background_color.toLowerCase(), bg[1].toLowerCase());
  assert.equal(DGTL_HOUSE_APP.theme_color.toLowerCase(), bg[1].toLowerCase());

  assert.match(css, /--gold:\s*#F0CF50/, "the accent must be declared under its real name");
  const declarations = css.match(/^\s*--[a-z-]+:\s*#F0CF50\s*;/gim) || [];
  assert.equal(declarations.length, 1, `#F0CF50 must be declared exactly once, found ${declarations.length}`);
});

test("the Core surface names itself and never host-resolves its icon", async () => {
  const layout = await read("app", "(core)", "layout.jsx");
  assert.match(layout, /appleWebApp/, "appleWebApp emits apple-mobile-web-app-title, which the platform lacked");
  assert.match(layout, /title: "DGTL\.chat"/, "the iOS home-screen title must be set explicitly");
  assert.match(layout, /themeColor/, "in Next 15 themeColor belongs on the viewport export");
  assert.match(layout, /viewportFit: "cover"/, "env(safe-area-inset-*) rules depend on viewport-fit=cover");

  // Comments are allowed to name /branding/icon; no code path may reference it.
  const layoutCode = layout.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(layoutCode, /\/branding\/icon/, "Core points at the static house icon, so no host resolution runs here");
  assert.match(layoutCode, /apple: "\/assets\/brand\/icons\/apple-touch-icon\.png"/, "Core's apple icon is the static house PNG");

  // The root layout keeps its tenant-facing title: every funnel-template tenant
  // inherits it, so changing it would rename their browser tabs.
  const root = await read("app", "layout.jsx");
  assert.match(root, /title: "Content Day"/, "changing the root title is a separate, tenant-facing change");

  // ...which is why /admin/login names ITSELF rather than the root being changed
  // to suit it. A DGTL sign-in page showing a tenant's brand in the tab is the
  // bug; renaming the shared root would have been a worse one.
  const adminLayout = await read("app", "admin", "layout.jsx");
  assert.match(adminLayout, /template: "%s · DGTL"/, "the admin shell names itself instead of the root being changed");

  // absolute, so the shell's template does not turn this into "DGTL Login · DGTL".
  const login = await read("app", "admin", "login", "page.jsx");
  assert.match(login, /title: \{ absolute: "DGTL Login" \}/, "the login page opts out of the admin title template");
});

test("the DGTL wordmark is one component with no brand literal in it", async () => {
  const mark = await read("components", "brand", "DgtlWordmark.jsx");
  const literals = mark.split("\n").filter((line) => !line.trim().startsWith("//") && /#F0CF50/i.test(line));
  assert.equal(literals.length, 0, "the bolt takes var(--gold) from CSS, not a hardcoded hex");
  assert.match(mark, /dgtl-logo__bolt/, "the bolt needs the hook the stylesheet fills");

  const css = await read("app", "admin", "dgtl-admin.css");
  assert.match(css, /\.dgtl-logo__bolt[\s\S]{0,120}fill: var\(--gold\)/, "the stylesheet must fill the bolt");

  // All three surfaces share the one component — no fourth inline copy.
  for (const file of [
    ["components", "core", "CoreShell.jsx"],
    ["components", "admin", "AdminTabbedShell.jsx"],
    ["app", "admin", "login", "page.jsx"]
  ]) {
    const source = await read(...file);
    assert.match(source, /<DgtlWordmark/, `${file.join("/")} must render the shared wordmark`);
    assert.doesNotMatch(source, /viewBox="73 148 987 453"/, `${file.join("/")} must not inline the wordmark again`);
  }

  const shell = await read("components", "core", "CoreShell.jsx");
  assert.doesNotMatch(shell, /core-brand__mark/, "the text brandmark is replaced by the logo");
});
