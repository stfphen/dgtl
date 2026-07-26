/**
 * Copy-length limits for AI-authored tenant copy.
 *
 * One table drives both enforcement surfaces so they can never drift:
 * - applyCopyLimits(schema): injects maxLength/minItems/maxItems into the
 *   generation JSON schema (hard-enforced in API-key structured-output mode).
 * - enforceCopyLimits(config): advisory pass over a normalized config that
 *   returns human-readable warnings. It NEVER truncates and never affects
 *   validity — the design brief is "surface it, don't silently clip it".
 *
 * Path syntax: dot paths; a segment ending in "[]" descends into array items
 * ("faq.items[].answer"). A path whose spec has minItems/maxItems targets the
 * array itself ("problem.points").
 */

export const COPY_LIMITS = {
  "brand.name": { max: 40 },
  "brand.eyebrow": { max: 30 },
  "brand.logoText": { max: 30 },
  "brand.tagline": { max: 60 },
  "hero.headline": { max: 70 },
  "hero.subheadline": { max: 140 },
  "hero.primaryCta": { max: 28 },
  "hero.secondaryCta": { max: 28 },
  "hero.stats": { minItems: 2, maxItems: 4 },
  "hero.stats[].value": { max: 12 },
  "hero.stats[].label": { max: 32 },
  "problem.eyebrow": { max: 30 },
  "problem.headline": { max: 70 },
  "problem.points": { minItems: 3, maxItems: 5 },
  "problem.points[]": { max: 90 },
  "system.eyebrow": { max: 30 },
  "system.headline": { max: 70 },
  "system.body": { max: 280 },
  "system.features": { minItems: 3, maxItems: 4 },
  "system.features[].title": { max: 40 },
  "system.features[].body": { max: 140 },
  "process.eyebrow": { max: 30 },
  "process.headline": { max: 70 },
  "process.steps": { minItems: 3, maxItems: 5 },
  "process.steps[].title": { max: 40 },
  "process.steps[].body": { max: 140 },
  "output.eyebrow": { max: 30 },
  "output.headline": { max: 70 },
  "output.body": { max: 280 },
  "output.tiles": { minItems: 4, maxItems: 9 },
  "output.tiles[]": { max: 18 },
  "packageSection.eyebrow": { max: 30 },
  "packageSection.headline": { max: 70 },
  "packageSection.body": { max: 280 },
  "packages": { minItems: 2, maxItems: 4 },
  "packages[].name": { max: 40 },
  "packages[].summary": { max: 90 },
  "packages[].price": { max: 20 },
  "packages[].priceQualifier": { max: 20 },
  "packages[].priceDisplay": { max: 40 },
  "packages[].cta": { max: 28 },
  "packages[].description": { max: 200 },
  "packages[].features": { minItems: 3, maxItems: 7 },
  "packages[].features[]": { max: 70 },
  "enterprise.eyebrow": { max: 30 },
  "enterprise.headline": { max: 90 },
  "enterprise.body": { max: 280 },
  "enterprise.cta": { max: 28 },
  "faq.eyebrow": { max: 30 },
  "faq.headline": { max: 70 },
  "faq.items": { minItems: 3, maxItems: 6 },
  "faq.items[].question": { max: 90 },
  "faq.items[].answer": { max: 300 },
  "finalCta.eyebrow": { max: 30 },
  "finalCta.headline": { max: 70 },
  "finalCta.body": { max: 160 },
  "finalCta.cta": { max: 28 },
  "mobileCta.primary": { max: 24 },
  "mobileCta.secondary": { max: 24 }
};

function splitPath(path) {
  return path.split(".").map((segment) => ({
    key: segment.endsWith("[]") ? segment.slice(0, -2) : segment,
    isArray: segment.endsWith("[]")
  }));
}

function schemaNodeFor(schema, path) {
  let node = schema;
  for (const { key, isArray } of splitPath(path)) {
    node = node?.properties?.[key];
    if (isArray) node = node?.items;
    if (!node) return null;
  }
  return node;
}

/**
 * Deep-clone a JSON schema and inject the copy limits (maxLength on strings,
 * minItems/maxItems on arrays). Unknown paths are skipped so the table can
 * lead the schema during development without crashing generation.
 */
export function applyCopyLimits(schema) {
  const limited = structuredClone(schema);
  for (const [path, spec] of Object.entries(COPY_LIMITS)) {
    const node = schemaNodeFor(limited, path);
    if (!node) continue;
    if (spec.max && node.type === "string") node.maxLength = spec.max;
    if (node.type === "array") {
      if (spec.minItems) node.minItems = spec.minItems;
      if (spec.maxItems) node.maxItems = spec.maxItems;
    }
  }
  return limited;
}

// Resolve a limits path against a config object, returning every concrete
// (indexed) value it matches.
function valuesFor(config, path) {
  let entries = [{ path: "", value: config }];
  for (const { key, isArray } of splitPath(path)) {
    const next = [];
    for (const entry of entries) {
      const value = entry.value?.[key];
      if (value === undefined || value === null) continue;
      const base = entry.path ? `${entry.path}.${key}` : key;
      if (isArray) {
        if (!Array.isArray(value)) continue;
        value.forEach((item, index) => next.push({ path: `${base}[${index}]`, value: item }));
      } else {
        next.push({ path: base, value });
      }
    }
    entries = next;
  }
  return entries;
}

/**
 * Advisory copy-limit pass. Returns warnings (empty when clean); never
 * mutates or truncates the config.
 */
export function enforceCopyLimits(config) {
  const warnings = [];
  if (!config || typeof config !== "object") return warnings;

  for (const [path, spec] of Object.entries(COPY_LIMITS)) {
    for (const entry of valuesFor(config, path)) {
      if (spec.max && typeof entry.value === "string" && entry.value.length > spec.max) {
        warnings.push(
          `${entry.path}: ${entry.value.length} chars (limit ${spec.max}) — shorten so the design keeps its whitespace.`
        );
      }
      if (Array.isArray(entry.value)) {
        if (spec.maxItems && entry.value.length > spec.maxItems) {
          warnings.push(
            `${entry.path}: ${entry.value.length} items (limit ${spec.maxItems}) — trim to the strongest ${spec.maxItems}.`
          );
        }
        if (spec.minItems && entry.value.length > 0 && entry.value.length < spec.minItems) {
          warnings.push(
            `${entry.path}: only ${entry.value.length} item(s) (minimum ${spec.minItems}) — the section will look sparse.`
          );
        }
      }
    }
  }

  return warnings;
}
