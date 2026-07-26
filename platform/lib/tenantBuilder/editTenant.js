import { aiMode, generateJson } from "../ai/claudeBackend.js";
import { normalizeTenantConfig } from "../defaultTenant.js";
import { validateTenantConfig } from "../tenantValidation.js";
import { COPY_RULES, TENANT_OUTPUT_SCHEMA } from "./generateTenant.js";
import { enforceCopyLimits, applyCopyLimits } from "./copyLimits.js";
import { getDesignDirection, isValidDirectionId } from "./designDirections.js";

const MODEL = "claude-opus-4-8";

/**
 * The editable surface. The model (and the manual patch mode) may only touch
 * these top-level sections — everything else on the config (checkout, routing,
 * telephony, media, portfolio, references, domains, slug, id, status,
 * defaultPackageId, brand.appIcon…) is carried over from the existing draft
 * untouched. TENANT_OUTPUT_SCHEMA's additionalProperties:false means the model
 * physically cannot emit non-copy keys.
 */
export const EDITABLE_KEYS = [
  "brand",
  "hero",
  "problem",
  "system",
  "process",
  "output",
  "packageSection",
  "packages",
  "enterprise",
  "faq",
  "finalCta",
  "mobileCta",
  "design"
];

// Manual (form/picker) patches may additionally address media slots (hero
// image, portfolio items, reference logos) — deterministic paths only; the AI
// schema still cannot emit any of these.
export const PATCH_ONLY_KEYS = ["media", "portfolio", "references"];
export const PATCHABLE_KEYS = [...EDITABLE_KEYS, ...PATCH_ONLY_KEYS];

// The edit schema is the generation schema (with copy limits) plus an optional
// design block, so "make it brutalist" style instructions can switch direction.
// All properties are optional on edit: the model may return only the sections
// it changed; unchanged ones are carried over from the base draft.
const EDIT_SCHEMA = (() => {
  const schema = applyCopyLimits(TENANT_OUTPUT_SCHEMA);
  schema.properties.design = {
    type: "object",
    additionalProperties: false,
    properties: {
      direction: {
        type: "string",
        description:
          "Design direction id: premium-agency | editorial-minimal | bold-brutalist | warm-boutique | dark-cinematic"
      }
    },
    required: ["direction"]
  };
  schema.required = [];
  return schema;
})();

export const EDIT_SYSTEM_PROMPT = [
  "You are editing an existing, live landing-page configuration for a white-label B2B marketing funnel.",
  "You will receive the current configuration as JSON plus one edit instruction.",
  "Return the configuration sections conforming to the schema, applying ONLY what the instruction requires.",
  "Every field the instruction does not touch must be copied back verbatim, character for character — do not rewrite, rephrase, reformat, translate, or 'improve' untouched copy. You may omit entire sections you did not change.",
  "If the instruction is ambiguous, make the smallest reasonable interpretation. If it asks for something outside these sections (domains, payment links, images), change nothing related and leave the config as-is.",
  "Only include a design block if the instruction explicitly asks for a different visual direction/style.",
  COPY_RULES
].join("\n");

function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merge model output (or a manual patch, pre-merged per section) over the base
 * draft, repair defaultPackageId if packages changed, normalize, and collect
 * copy warnings. Pure — the network boundary stays in editTenantConfig.
 *
 * @returns {{config: object, warnings: string[], valid: boolean}}
 */
export function applyEditedSections(baseDraft, modelOutput = {}) {
  const edited = pick(modelOutput, EDITABLE_KEYS);

  const merged = {
    ...baseDraft,
    ...edited,
    // Deep-keep brand extras the schema doesn't carry (appIcon, logo).
    brand: { ...baseDraft.brand, ...(isObject(edited.brand) ? edited.brand : {}) },
    // design.direction may change (model or picker); overrides only via manual
    // patch (the AI edit schema has no overrides property).
    design: {
      ...baseDraft.design,
      ...(isObject(edited.design)
        ? {
            ...(edited.design.direction !== undefined ? { direction: edited.design.direction } : {}),
            ...(isObject(edited.design.overrides) ? { overrides: edited.design.overrides } : {}),
            // Manual-patch-only keys (never in the model's EDIT_SCHEMA); the
            // save-time sanitizer deletes anything invalid.
            ...(edited.design.verticalPreset !== undefined
              ? { verticalPreset: edited.design.verticalPreset }
              : {}),
            ...(edited.design.sectionVariants !== undefined
              ? { sectionVariants: edited.design.sectionVariants }
              : {})
          }
        : {})
    }
  };

  // A renamed/replaced package set must not orphan defaultPackageId (validation
  // would reject the save). Same preference order as generation: featured first.
  const packages = Array.isArray(merged.packages) ? merged.packages : [];
  if (!packages.some((pkg) => pkg?.id === merged.defaultPackageId)) {
    const featured = packages.find((pkg) => pkg?.featured && pkg?.id);
    merged.defaultPackageId = featured?.id || packages.find((pkg) => pkg?.id)?.id || "";
  }

  const warnings = [];
  if (isObject(edited.design) && edited.design.direction && !isValidDirectionId(edited.design.direction)) {
    warnings.push(`Unknown design direction "${edited.design.direction}" — keeping the current one.`);
    merged.design = { ...baseDraft.design };
  }

  const config = normalizeTenantConfig(merged);
  const { ok, errors } = validateTenantConfig(config);
  if (!ok) {
    warnings.push(...errors.map((item) => `${item.path}: ${item.message}`));
  }
  warnings.push(...enforceCopyLimits(config));

  return { config, warnings, valid: ok };
}

/**
 * Deterministic form/picker edits: shallow-merge each patched section over the
 * base draft (allowlisted keys only), then run the shared fix-up pipeline.
 */
export function applyManualPatch(baseDraft, patch = {}) {
  const allowed = pick(patch, PATCHABLE_KEYS);
  const merged = {};
  for (const [key, value] of Object.entries(allowed)) {
    if (Array.isArray(value)) {
      merged[key] = value;
    } else if (isObject(value)) {
      merged[key] = { ...baseDraft[key], ...value };
    } else {
      merged[key] = value;
    }
  }
  // Patch-only keys (media/portfolio/references) aren't EDITABLE_KEYS; carry
  // them into the base first so applyEditedSections's allowlist doesn't drop them.
  let base = baseDraft;
  for (const key of PATCH_ONLY_KEYS) {
    if (merged[key] !== undefined) base = { ...base, [key]: merged[key] };
  }
  return applyEditedSections(base, merged);
}

/**
 * Natural-language edit via the model. Same typed errors as generation so the
 * route maps statuses identically.
 *
 * @returns {Promise<{config: object, warnings: string[], valid: boolean}>}
 */
export async function editTenantConfig({ baseDraft, instruction } = {}) {
  if (aiMode() === "off") {
    const error = new Error(
      "AI tenant editing is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (Claude subscription) or ANTHROPIC_API_KEY."
    );
    error.name = "TenantBuilderNotConfigured";
    throw error;
  }

  const text = String(instruction || "").trim();
  if (!text) {
    const error = new Error("Provide an edit instruction.");
    error.name = "TenantBuilderBadInput";
    throw error;
  }
  if (!isObject(baseDraft)) {
    const error = new Error("No tenant draft to edit.");
    error.name = "TenantBuilderBadInput";
    throw error;
  }

  const direction = getDesignDirection(baseDraft.design?.direction);
  const editableConfig = pick(baseDraft, EDITABLE_KEYS);
  const prompt = [
    "Current tenant configuration (JSON):",
    JSON.stringify(editableConfig, null, 2),
    "",
    direction ? `Active design direction: ${direction.label}. Copy tone: ${direction.copyTone}` : "",
    "",
    "Edit instruction:",
    text
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n");

  const ask = async () => {
    let modelOutput;
    try {
      modelOutput = await generateJson({
        system: EDIT_SYSTEM_PROMPT,
        prompt,
        schema: EDIT_SCHEMA,
        model: MODEL
      });
    } catch (error) {
      if (error?.name === "AiRefused") {
        const refusal = new Error("The model declined to apply this edit.");
        refusal.name = "TenantBuilderRefused";
        throw refusal;
      }
      throw error;
    }
    return applyEditedSections(baseDraft, modelOutput);
  };

  // Same corrective policy as generation: one retry if validation fails.
  let result = await ask();
  if (!result.valid) {
    const retry = await ask();
    if (retry.valid) result = retry;
  }
  return result;
}
