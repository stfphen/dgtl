import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { statusTone } from "../lib/core/statusTone.js";

// The brand contract. CLAUDE.md makes black + gold + Manrope non-negotiable and
// forbids hardcoding a brand value into a component or page — these assertions
// are what stop that rule from being aspirational.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readCss = (...parts) => readFile(path.join(root, ...parts), "utf8");

test("the canonical token layer carries the exact DGTL brand-kit values", async () => {
  const tokens = await readCss("app", "dgtl-tokens.css");
  const required = {
    "--gold": "#F0CF50",
    "--gold-tint": "rgba(240, 207, 80, 0.08)",
    "--gold-ring": "rgba(240, 207, 80, 0.15)",
    "--gold-tan": "#b3a06a",
    "--text-primary": "#F0F0F0",
    "--text-secondary": "#D0D0D0",
    "--text-dim": "#8a8a8a",
    "--placeholder": "#6a6a6a",
    "--success": "#7BC47F",
    "--warning": "#E8A33D",
    "--error": "#E5484D",
    "--info": "#6E9FDB",
    "--r-control": "7px",
    "--r-card": "16px",
    "--r-pill": "9999px"
  };
  for (const [name, value] of Object.entries(required)) {
    assert.match(tokens, new RegExp(`${name}:\\s*${value.replace(/[()]/g, "\\$&")}\\s*;`), `${name} must be ${value}`);
  }
  assert.match(tokens, /--bg:\s*#000000/, "the ground is pure black");
  assert.match(tokens, /--border:\s*#2a2a2a/, "the default border is #2a2a2a");
  assert.match(tokens, /--font-sans:\s*var\(--font-manrope\)/, "Manrope is the base family");
  // --brand and --font-display are :root-baked (legacy blue / Geist) and must
  // be re-declared here or they leak into the authenticated surfaces.
  assert.match(tokens, /--brand:\s*var\(--gold\)/, "--brand must be re-pointed off the legacy blue");
  assert.match(tokens, /--font-display:\s*var\(--font-sans\)/, "--font-display must be re-pointed off Geist");
  // A keyword in a comma-separated box-shadow list invalidates the whole
  // declaration at computed-value time.
  assert.doesNotMatch(tokens, /--glow:\s*none/, "--glow must be a transparent shadow, never `none`");
});

test("both authenticated layouts load the canonical tokens and the preloaded brand face", async () => {
  const coreLayout = await readFile(path.join(root, "app", "(core)", "layout.jsx"), "utf8");
  const adminLayout = await readFile(path.join(root, "app", "admin", "layout.jsx"), "utf8");
  for (const [name, source] of [["core", coreLayout], ["admin", adminLayout]]) {
    assert.match(source, /dgtl-tokens\.css/, `${name} layout imports the canonical token layer`);
    assert.match(source, /from "\.\.\/\.\.\/lib\/fonts"/, `${name} layout uses the shared Manrope instance`);
  }
  const fonts = await readFile(path.join(root, "lib", "fonts.js"), "utf8");
  assert.match(fonts, /preload:\s*true/, "the authenticated surfaces preload their own primary face");
});

// Comments explain the values they replaced, so the rule check reads
// declarations only.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

test("brand values are not hardcoded outside the token layer", async () => {
  const core = await readCss("app", "(core)", "core.css");
  const admin = await readCss("app", "admin", "dgtl-admin.css");
  for (const [name, raw] of [["core.css", core], ["dgtl-admin.css", admin]]) {
    const source = stripComments(raw);
    assert.doesNotMatch(source, /#F0CF50/i, `${name} must reference the gold token, not the literal`);
    assert.doesNotMatch(source, /#8a8a8a|#D0D0D0|#F0F0F0/i, `${name} must reference the text tokens, not literals`);
    assert.doesNotMatch(source, /#2a2a2a/i, `${name} must reference the border token, not the literal`);
  }
  // The one deliberate exception: a generated client artifact renders in an
  // iframe and must be judged on its own ground, not the OS's.
  assert.match(core, /\.core-preview[^}]*background:\s*#fff/, "artifact previews keep their white ground");
});

test("gold is rationed: hover states no longer spend the accent", async () => {
  const core = await readCss("app", "(core)", "core.css");
  assert.doesNotMatch(core, /\.core-button:hover\s*\{[^}]*var\(--core-accent\)/, "a plain button hover must not turn gold");
  assert.doesNotMatch(core, /\.core-record-link:hover strong\s*\{[^}]*var\(--core-accent\)/, "list rows must not turn gold on hover");
  assert.doesNotMatch(core, /\.core-table a:hover\s*\{[^}]*var\(--core-accent\)/, "table links must not turn gold on hover");
  // Gold is still spent where the kit says it should be.
  assert.match(core, /\.core-button\.is-primary\s*\{[^}]*background:\s*var\(--core-accent\)/, "the primary action stays gold");
  assert.match(core, /\.core-nav__item\.is-active\s*\{[^}]*var\(--gold-tint\)/, "the active nav item stays gold");
});

test("every interactive element gets the brand focus ring", async () => {
  const core = await readCss("app", "(core)", "core.css");
  const admin = await readCss("app", "admin", "dgtl-admin.css");
  for (const [name, source] of [["core.css", core], ["dgtl-admin.css", admin]]) {
    assert.match(source, /:focus-visible\s*\{[^}]*box-shadow:/, `${name} defines a visible focus ring`);
  }
});

test("statusTone maps real vocabularies onto the functional palette", () => {
  assert.equal(statusTone("succeeded"), "success");
  assert.equal(statusTone("executed"), "success");
  assert.equal(statusTone("healthy"), "success");
  assert.equal(statusTone("failed"), "error");
  assert.equal(statusTone("dead_letter"), "error");
  assert.equal(statusTone("validation_failed"), "error");
  assert.equal(statusTone("outcome_unknown"), "warning");
  assert.equal(statusTone("stale"), "warning");
  assert.equal(statusTone("draft"), "info");
  assert.equal(statusTone("proposed"), "info");
  // Formatting must not change the tone.
  assert.equal(statusTone("Due Today"), "warning");
  assert.equal(statusTone("not queued"), "info");
  // Values with no state meaning, and anything unrecognised from the database,
  // must fall through rather than being forced into a colour.
  assert.equal(statusTone("discovery"), "neutral");
  assert.equal(statusTone("message_drafted"), "neutral");
  assert.equal(statusTone(""), "neutral");
  assert.equal(statusTone(undefined), "neutral");
  assert.equal(statusTone(null), "neutral");
});
