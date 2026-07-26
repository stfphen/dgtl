/**
 * Section variant registry — the closed set of alternate compositions a funnel
 * section may render, and the resolver that picks one per section.
 *
 * Pure data + pure functions, zero imports (tests run under node --test with
 * no JSX transform, and designDirections.js imports this module — keeping it
 * import-free keeps the dependency graph acyclic).
 *
 * Contract rules:
 * - Each section's defaultId is the pre-variants FunnelPage rendering,
 *   verbatim. Tenants that never set a variant render byte-identical.
 * - Unknown/invalid variant ids at any tier fall through to the next tier;
 *   the default composition is the failure mode, never a broken section.
 * - `hero` ids must stay a superset of HERO_VARIANTS in designDirections.js
 *   (cross-checked by tests); the shipped direction data is frozen.
 */

export const SECTION_VARIANTS = {
  hero: {
    defaultId: "full-bleed",
    ids: ["full-bleed", "split", "typographic"]
  },
  packages: {
    defaultId: "cards",
    ids: ["cards", "comparison", "single-offer"]
  },
  references: {
    defaultId: "testimonial-grid",
    ids: ["testimonial-grid", "logo-wall", "stat-band", "case-strip", "testimonial-editorial"]
  }
};

export const VARIANT_SECTION_IDS = Object.keys(SECTION_VARIANTS);

function pick(sectionId, candidate) {
  const spec = SECTION_VARIANTS[sectionId];
  if (!spec) return null;
  const key = typeof candidate === "string" ? candidate : "";
  return spec.ids.includes(key) ? key : null;
}

/**
 * Resolve the complete variant map for every variant-capable section.
 * Precedence per section: explicit tenant value > vertical preset preference
 * > direction (hero only, via its heroVariant) > the section's default.
 * Always returns a full, valid map — callers never need to re-validate.
 */
export function resolveSectionVariants(explicit, presetPrefs, directionHeroVariant) {
  const resolved = {};
  for (const sectionId of VARIANT_SECTION_IDS) {
    resolved[sectionId] =
      pick(sectionId, explicit?.[sectionId]) ??
      pick(sectionId, presetPrefs?.[sectionId]) ??
      (sectionId === "hero" ? pick("hero", directionHeroVariant) : null) ??
      SECTION_VARIANTS[sectionId].defaultId;
  }
  return resolved;
}

/**
 * Sanitize a stored design.sectionVariants block: keep only known section ids
 * mapped to known variant ids. Anything else is dropped (never coerced), so
 * absence stays the safe state and stored bytes for untouched tenants never
 * change.
 */
export function sanitizeSectionVariants(input) {
  const clean = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return clean;
  for (const [sectionId, variantId] of Object.entries(input)) {
    const valid = pick(sectionId, variantId);
    if (valid) clean[sectionId] = valid;
  }
  return clean;
}
