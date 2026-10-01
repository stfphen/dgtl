import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DGTL_GEOMETRY, DGTL_TOKENS, contrastRatio, readableForeground, resolveBrandKit, walletColor } from "./brand.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function tokenValue(css, name) {
  const match = new RegExp(`${name.replace(/[-]/g, "\\-")}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return match?.[1] ?? null;
}

for (const file of ["engine/dgtl-brand-kit/assets/dgtl-tokens.css", "journal/_shared/dgtl-editorial.css"]) {
  test(`DGTL_TOKENS mirror ${file} exactly`, async () => {
    const css = await readFile(path.join(repoRoot, file), "utf8");
    for (const [name, value] of Object.entries(DGTL_TOKENS)) {
      assert.equal(tokenValue(css, name)?.toLowerCase(), value.toLowerCase(), `${name} drifted from ${file}`);
    }
  });
}

test("the platform's canonical token layer (platform/app/dgtl-tokens.css) carries the same values", async () => {
  const css = await readFile(path.join(repoRoot, "platform/app/dgtl-tokens.css"), "utf8");
  // kit name -> platform name (CLAUDE.md: dgtl-tokens.css is canonical for every authenticated surface)
  const pairs = { "--gold": "--gold", "--gold-tan": "--gold-tan", "--bg": "--bg", "--surface-1": "--surface", "--surface-2": "--surface-2",
    "--border": "--border", "--text": "--text-primary", "--text-muted": "--text-secondary", "--text-dim": "--text-dim",
    "--text-ghost": "--text-ghost", "--placeholder": "--placeholder" };
  for (const [kitName, platformName] of Object.entries(pairs)) {
    assert.equal(tokenValue(css, platformName)?.toLowerCase(), DGTL_TOKENS[kitName].toLowerCase(), `platform ${platformName} ≠ kit ${kitName}`);
  }
});

test("geometry is the kit's three radii", () => {
  assert.deepEqual(DGTL_GEOMETRY, { control: 7, card: 16, pill: 9999 });
});

test("with no tenant overrides the kit is DGTL black + gold, Manrope", () => {
  const kit = resolveBrandKit({});
  assert.equal(kit.name, "DGTL");
  assert.equal(kit.theme, "dark");
  assert.equal(kit.colors.background, "#000000");
  assert.equal(kit.colors.accent, "#F0CF50");
  assert.equal(kit.colors.onAccent, "#050505", "black text on gold");
  assert.equal(kit.colors.kicker, "#b3a06a", "kickers are gold-tan, not gold");
  assert.match(kit.fontStack, /^Manrope/);
  assert.match(kit.fontCssUrl, /Manrope:wght@400;500;600;700;800/);
  assert.equal(kit.logoIncludesName, false);
  assert.equal(kit.walletLogoText, "");
});

test("tenant brand feeds the kit; malformed colors fall back instead of breaking", () => {
  const kit = resolveBrandKit({
    brand: { name: "Northside Club", logoText: "NORTHSIDE", primaryColor: "#2266ff" },
    passes: { brandKit: { colors: { background: "red", surface: "#101010" }, logoUrl: "http://insecure.example/logo.png" } }
  });
  assert.equal(kit.name, "Northside Club");
  assert.equal(kit.logoText, "NORTHSIDE");
  assert.equal(kit.colors.accent, "#2266ff");
  assert.equal(kit.colors.onAccent, "#ffffff");
  assert.equal(kit.colors.background, "#000000", "invalid color ignored");
  assert.equal(kit.colors.surface, "#101010");
  assert.equal(kit.logoUrl, "", "email logos must be https");
});

test("a light theme swaps the surface ladder", () => {
  const kit = resolveBrandKit({ passes: { brandKit: { theme: "light" } } });
  assert.equal(kit.theme, "light");
  assert.equal(kit.colors.background, "#f7f6f2", "the kit's light-mode paper");
  assert.equal(kit.colors.line, "#e5e2d9");
  assert.ok(contrastRatio(kit.colors.text, kit.colors.surface) > 12);
  assert.ok(contrastRatio(kit.colors.kicker, kit.colors.surface) >= 4.5);
});

test("color helpers", () => {
  assert.equal(walletColor("#F0CF50"), "rgb(240, 207, 80)");
  assert.equal(readableForeground("#000000"), "#ffffff");
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
});
