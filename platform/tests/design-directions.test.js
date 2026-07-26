import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIRECTION_ID,
  DEFAULT_SECTION_ORDER,
  DIRECTION_FONT_VARIABLES,
  DIRECTION_TOKEN_KEYS,
  HERO_VARIANTS,
  getDesignDirection,
  isValidDirectionId,
  listDesignDirections,
  resolveDesign,
  resolveSectionOrder
} from "../lib/tenantBuilder/designDirections.js";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { sanitizeTenantConfig, validateTenantConfig } from "../lib/tenantValidation.js";

const BRAND_CONTRACT_TOKENS = ["--blue", "--blue-dark", "--accent", "--on-blue"];

test("design directions have unique ids and complete metadata", () => {
  const directions = listDesignDirections();
  assert.ok(directions.length >= 4 && directions.length <= 6);

  const ids = directions.map((direction) => direction.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(DEFAULT_DIRECTION_ID));

  for (const direction of directions) {
    assert.ok(direction.label, `${direction.id} needs a label`);
    assert.ok(direction.blurb, `${direction.id} needs a blurb`);
    assert.ok(direction.copyTone, `${direction.id} needs a copyTone`);
    assert.ok(HERO_VARIANTS.includes(direction.heroVariant), `${direction.id} hero variant`);
    assert.ok(Array.isArray(direction.preview?.swatches) && direction.preview.swatches.length >= 3);
    assert.ok(direction.preview?.fontStack, `${direction.id} needs a preview font stack`);
  }
});

test("premium-agency resolves to empty vars — the backwards-compat anchor", () => {
  const direction = getDesignDirection(DEFAULT_DIRECTION_ID);
  assert.deepEqual(direction.vars, {});
  assert.deepEqual(resolveDesign({ direction: DEFAULT_DIRECTION_ID }).vars, {});
});

test("every non-default direction defines the full --fp-* token set and nothing else", () => {
  const expected = [...DIRECTION_TOKEN_KEYS].sort();
  for (const direction of listDesignDirections()) {
    if (direction.id === DEFAULT_DIRECTION_ID) continue;
    const keys = Object.keys(direction.vars).sort();
    assert.deepEqual(keys, expected, `${direction.id} token keys`);
    for (const [key, value] of Object.entries(direction.vars)) {
      assert.ok(key.startsWith("--fp-"), `${direction.id} ${key} must be --fp- namespaced`);
      assert.ok(typeof value === "string" && value.trim(), `${direction.id} ${key} needs a value`);
    }
  }
});

test("direction vars never define brand-contract tokens", () => {
  for (const direction of listDesignDirections()) {
    for (const token of BRAND_CONTRACT_TOKENS) {
      assert.ok(!(token in direction.vars), `${direction.id} must not set ${token}`);
    }
  }
});

test("direction font stacks only reference registered next/font variables", () => {
  const registered = new Set([...DIRECTION_FONT_VARIABLES, "--font-sans", "--font-mono"]);
  for (const direction of listDesignDirections()) {
    const stacks = [direction.vars["--fp-font-display"], direction.vars["--fp-eyebrow-font"]];
    for (const stack of stacks) {
      if (!stack) continue;
      for (const match of stack.matchAll(/var\((--font-[a-z-]+)/g)) {
        assert.ok(registered.has(match[1]), `${direction.id} references unregistered ${match[1]}`);
      }
    }
  }
});

test("every direction's section order resolves to a full permutation with invariants", () => {
  for (const direction of listDesignDirections()) {
    const resolved = resolveSectionOrder(direction.sectionOrder);
    assert.deepEqual([...resolved].sort(), [...DEFAULT_SECTION_ORDER].sort(), direction.id);
    assert.equal(resolved[0], "hero", `${direction.id} hero first`);
    assert.ok(
      resolved.indexOf("checkout") > resolved.indexOf("packages"),
      `${direction.id} checkout must follow packages`
    );
  }
});

test("resolveSectionOrder repairs hostile input", () => {
  const resolved = resolveSectionOrder(["checkout", "packages", "nope", "faq", "faq", 42]);
  assert.deepEqual([...resolved].sort(), [...DEFAULT_SECTION_ORDER].sort());
  assert.equal(resolved[0], "hero");
  assert.ok(resolved.indexOf("checkout") > resolved.indexOf("packages"));

  assert.deepEqual(resolveSectionOrder(undefined), DEFAULT_SECTION_ORDER);
  assert.deepEqual(resolveSectionOrder([]), DEFAULT_SECTION_ORDER);
});

test("resolveDesign falls back to the default direction on missing or unknown input", () => {
  for (const input of [undefined, null, {}, { direction: "does-not-exist" }, { direction: 7 }]) {
    const resolved = resolveDesign(input);
    assert.equal(resolved.id, DEFAULT_DIRECTION_ID, JSON.stringify(input));
    assert.deepEqual(resolved.vars, {});
    assert.equal(resolved.heroVariant, "full-bleed");
  }
  assert.equal(isValidDirectionId("does-not-exist"), false);
});

test("resolveDesign applies only safe --fp-* overrides on top of direction vars", () => {
  const resolved = resolveDesign({
    direction: "bold-brutalist",
    overrides: {
      "--fp-radius": "4px",
      "--blue": "#ff0000",
      "background": "url(javascript:x)",
      "--fp-empty": "   ",
      "--fp-extra": 12
    }
  });
  assert.equal(resolved.id, "bold-brutalist");
  assert.equal(resolved.vars["--fp-radius"], "4px");
  assert.ok(!("--blue" in resolved.vars));
  assert.ok(!("background" in resolved.vars));
  assert.ok(!("--fp-empty" in resolved.vars));
  assert.ok(!("--fp-extra" in resolved.vars));
});

test("normalizeTenantConfig fills and preserves the design block", () => {
  assert.deepEqual(normalizeTenantConfig({}).design, {
    direction: DEFAULT_DIRECTION_ID,
    overrides: {}
  });

  const tenant = normalizeTenantConfig({
    design: { direction: "warm-boutique", overrides: { "--fp-radius": "24px" } }
  });
  assert.equal(tenant.design.direction, "warm-boutique");
  assert.deepEqual(tenant.design.overrides, { "--fp-radius": "24px" });
});

test("sanitizeTenantConfig coerces unknown directions to the default without erroring", () => {
  const tenant = sanitizeTenantConfig({ ...defaultTenant, design: { direction: "vaporwave" } });
  assert.equal(tenant.design.direction, DEFAULT_DIRECTION_ID);

  const result = validateTenantConfig({ ...defaultTenant, design: { direction: "vaporwave" } });
  assert.equal(result.ok, true);
  assert.equal(result.tenant.design.direction, DEFAULT_DIRECTION_ID);
});

test("design block survives a draft save/load round trip in the file store", async (t) => {
  const previousStorePath = process.env.APP_STORE_PATH;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");

  const dir = await mkdtemp(path.join(tmpdir(), "design-store-"));
  process.env.APP_STORE_PATH = path.join(dir, "store.json");
  delete process.env.DATABASE_URL;

  t.after(async () => {
    if (previousStorePath === undefined) delete process.env.APP_STORE_PATH;
    else process.env.APP_STORE_PATH = previousStorePath;
    if (previousDatabaseUrl !== undefined) process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(dir, { recursive: true, force: true });
  });

  const { saveTenantDraftConfig, getTenantByIdOrSlug, getRenderableTenantConfig } = await import(
    "../lib/store.js"
  );

  const saved = await saveTenantDraftConfig(
    null,
    {
      ...defaultTenant,
      id: "tenant_design_rt",
      slug: "design-rt",
      domains: ["design-rt.local"],
      design: { direction: "dark-cinematic", overrides: { "--fp-radius": "8px" } }
    },
    { teamId: "team_default" }
  );

  const loaded = await getTenantByIdOrSlug(saved.id, { teamId: "team_default" });
  const draft = getRenderableTenantConfig(loaded, "draft");
  assert.equal(draft.design.direction, "dark-cinematic");
  assert.deepEqual(draft.design.overrides, { "--fp-radius": "8px" });
});
