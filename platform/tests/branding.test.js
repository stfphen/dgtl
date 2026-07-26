import assert from "node:assert/strict";
import test from "node:test";
import { getTenantTheme } from "../lib/branding.js";
import { defaultTenant } from "../lib/defaultTenant.js";
import { fundedGrowthTenant } from "../lib/funding/tenant.js";

test("maps a tenant brand to themed CSS custom properties", () => {
  const theme = getTenantTheme({ primaryColor: "#0071e3", accentColor: "#050505" });
  assert.equal(theme.primary, "#0071e3");
  assert.equal(theme.accent, "#050505");
  assert.equal(theme.vars["--blue"], "#0071e3");
  assert.equal(theme.vars["--accent"], "#050505");
  // --blue-dark is a darker shade of the primary, not the primary itself.
  assert.notEqual(theme.vars["--blue-dark"], "#0071e3");
  assert.match(theme.vars["--blue-dark"], /^#[0-9a-f]{6}$/);
});

test("falls back to safe defaults for malformed brand colors", () => {
  const theme = getTenantTheme({ primaryColor: "not-a-color", accentColor: "" });
  assert.equal(theme.vars["--blue"], "#0071e3");
  assert.equal(theme.vars["--accent"], "#050505");
});

test("white-label isolation: two tenants resolve to distinct themes", () => {
  const a = getTenantTheme(defaultTenant.brand);
  const b = getTenantTheme(fundedGrowthTenant.brand);
  assert.notEqual(a.vars["--blue"], b.vars["--blue"]);
  assert.notEqual(a.vars["--accent"], b.vars["--accent"]);
  // The funded-growth tenant ships its own green primary, proving branding
  // is read per-tenant rather than hardcoded.
  assert.equal(b.vars["--blue"], "#0b8a5a");
});

test("handles a missing brand object without throwing", () => {
  const theme = getTenantTheme();
  assert.equal(theme.vars["--blue"], "#0071e3");
});
