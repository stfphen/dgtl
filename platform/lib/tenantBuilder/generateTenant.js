import { aiMode, generateJson } from "../ai/claudeBackend.js";
import { normalizeTenantConfig } from "../defaultTenant.js";
import { validateTenantConfig } from "../tenantValidation.js";
import { applyCopyLimits, enforceCopyLimits } from "./copyLimits.js";
import { DEFAULT_DIRECTION_ID, getDesignDirection, isValidDirectionId } from "./designDirections.js";
import { getVerticalPreset } from "./verticalPresets.js";

const MODEL = "claude-opus-4-8";
const MAX_DOCUMENTS = 6;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // keep the request comfortably under the 32MB API limit

// Sections we ask the model to author. Everything else (media, routing,
// contractorSettings, checkout, defaults) is filled in by normalizeTenantConfig.
// Exported for the edit flow (lib/tenantBuilder/editTenant.js), which reuses it
// verbatim: additionalProperties:false doubles as the clobber-guard that keeps
// the model away from non-copy config (checkout, routing, media, domains…).
export const TENANT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        eyebrow: { type: "string" },
        logoText: { type: "string" },
        tagline: { type: "string" },
        primaryColor: { type: "string", description: "Hex color, e.g. #0071e3" },
        accentColor: { type: "string", description: "Hex color, e.g. #050505" }
      },
      required: ["name", "eyebrow", "logoText", "tagline", "primaryColor", "accentColor"]
    },
    hero: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string" },
        subheadline: { type: "string" },
        primaryCta: { type: "string" },
        secondaryCta: { type: "string" },
        stats: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              value: { type: "string" },
              label: { type: "string" }
            },
            required: ["value", "label"]
          }
        }
      },
      required: ["headline", "subheadline", "primaryCta", "secondaryCta", "stats"]
    },
    problem: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        points: { type: "array", items: { type: "string" } }
      },
      required: ["eyebrow", "headline", "points"]
    },
    system: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        features: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"]
          }
        }
      },
      required: ["eyebrow", "headline", "body", "features"]
    },
    process: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            },
            required: ["title", "body"]
          }
        }
      },
      required: ["eyebrow", "headline", "steps"]
    },
    output: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        tiles: { type: "array", items: { type: "string" } }
      },
      required: ["eyebrow", "headline", "body", "tiles"]
    },
    packageSection: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" }
      },
      required: ["eyebrow", "headline", "body"]
    },
    packages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "lowercase-dashed unique id, e.g. starter-package" },
          name: { type: "string" },
          summary: { type: "string" },
          price: { type: "string", description: "Display price, e.g. $1,500" },
          priceQualifier: { type: "string", description: "e.g. / month, one time" },
          priceDisplay: { type: "string" },
          action: { type: "string", enum: ["checkout", "booking", "capture"] },
          cta: { type: "string" },
          featured: { type: "boolean" },
          description: { type: "string" },
          features: { type: "array", items: { type: "string" } }
        },
        required: [
          "id",
          "name",
          "summary",
          "price",
          "priceQualifier",
          "priceDisplay",
          "action",
          "cta",
          "featured",
          "description",
          "features"
        ]
      }
    },
    enterprise: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        cta: { type: "string" }
      },
      required: ["eyebrow", "headline", "body", "cta"]
    },
    faq: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
              answer: { type: "string" }
            },
            required: ["question", "answer"]
          }
        }
      },
      required: ["eyebrow", "headline", "items"]
    },
    finalCta: {
      type: "object",
      additionalProperties: false,
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        cta: { type: "string" }
      },
      required: ["eyebrow", "headline", "body", "cta"]
    },
    mobileCta: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: { type: "string" },
        secondary: { type: "string" }
      },
      required: ["primary", "secondary"]
    }
  },
  required: [
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
    "mobileCta"
  ]
};

// Shared copy discipline — also appended to the edit-route prompt so generated
// and edited copy obey the same budgets. Prose restates the schema limits
// because subscription mode has no structured-output guarantee and models
// follow prose budgets more reliably than schema maxLength either way.
export const COPY_RULES = [
  "Copy discipline — whitespace is part of the design:",
  "- Benefit-led and specific. One idea per block. No filler openers, no hype clichés (\"elevate\", \"seamless\", \"unleash\", \"next-gen\", \"game-changer\").",
  "- Hero headline: 3 to 5 words, <= 32 characters. It renders at display size, sometimes in a half-width column; long headlines wrap into a broken hero.",
  "- Hard character budgets, stay under them: headlines <= 70; hero subheadline <= 140; section body paragraphs <= 280 (final CTA body <= 160); list bullets <= 90; feature titles <= 40 with bodies <= 140; CTA button labels <= 28 (mobile <= 24); FAQ answers <= 300.",
  "- List sizes: 3-5 problem points and process steps; 3-4 system features; 2-4 packages; 3-6 FAQs; 2-4 hero stats.",
  "- Short sentences. Cut every word that does not earn its place. If a section reads long, it is wrong.",
  "- Never use an em-dash (—) or en-dash (–) anywhere. Restructure with a period, comma, colon, or parentheses.",
  "- No fake-precise numbers. Stats come from the brief or read as plainly plausible; never invent decimal-precision metrics to sound engineered.",
  "- One copy register for the whole page. Do not mix technical shorthand, editorial prose, and hype in one config.",
  "- Eyebrows are rationed (max 1 per 3 sections). Write eyebrow text ONLY for brand.eyebrow and packageSection.eyebrow; set eyebrow to an empty string for problem, system, process, output, enterprise, faq, and finalCta.",
  "- Never fabricate image URLs, stock-photo links, or media of any kind — media slots are managed separately by the operator."
].join("\n");

const SYSTEM_PROMPT = [
  "You build white-label B2B marketing and content funnel landing pages for a multi-tenant SaaS.",
  "Given a brief and any reference documents, produce a complete tenant configuration that fills every section: brand, hero, problem, system, process, output, package section, packages (with realistic pricing), enterprise, FAQ, final CTA, and mobile CTA.",
  "Write specific, conversion-focused marketing copy grounded in the brief and documents. Where the brief is silent, invent reasonable, on-brand copy rather than leaving fields generic or empty.",
  "When the brief names a design direction, match its copy tone exactly — the visual system and the voice must feel like one decision.",
  "Reference documents may include existing HTML landing pages or JSON configs from prior drafts — when present, adapt their copy, sections, and pricing into the schema rather than starting from scratch.",
  "Always include between 2 and 4 packages. Each package needs a unique lowercase-dashed id and an action of checkout, booking, or capture. Use brand colors as valid hex (e.g. #0071e3); pick tasteful colors if none are given.",
  "Do not fabricate live domains, payment links, or booking links — those are configured separately by the operator.",
  COPY_RULES
].join("\n");

// Generation schema = the authoring schema + copy budgets (hard-enforced in
// API-key structured-output mode; advisory warnings cover subscription mode).
const GENERATION_SCHEMA = applyCopyLimits(TENANT_OUTPUT_SCHEMA);

function slugify(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tenant"
  );
}

/**
 * Turn raw model output into a full, normalized tenant draft config plus any
 * validation warnings. Pure (no network) so it can be unit-tested directly.
 *
 * @param {object} args
 * @param {object} args.modelOutput  The sections the model authored.
 * @param {string} [args.brandName]
 * @param {string} [args.slug]
 * @param {string} [args.direction]  Design direction id picked by the operator
 *                                   (authoritative — the model never authors it).
 * @param {string} [args.verticalPreset]  Vertical preset id picked by the operator
 *                                        (same policy as direction: never model-authored).
 * @returns {{config: object, warnings: string[]}}
 */
export function buildTenantConfigFromModelOutput({ modelOutput, brandName, slug, direction, verticalPreset } = {}) {
  const resolvedSlug = slugify(slug || brandName || modelOutput?.brand?.name);

  // Point defaultPackageId at a generated package (prefer a featured one);
  // otherwise normalizeTenantConfig keeps the built-in default that won't match.
  const packages = Array.isArray(modelOutput?.packages) ? modelOutput.packages : [];
  const featured = packages.find((pkg) => pkg?.featured && pkg?.id);
  const defaultPackageId = featured?.id || packages.find((pkg) => pkg?.id)?.id || "";

  const warnings = [];
  const requestedDirection = String(direction || "").trim();
  const directionId =
    requestedDirection && isValidDirectionId(requestedDirection)
      ? requestedDirection
      : DEFAULT_DIRECTION_ID;
  if (requestedDirection && directionId !== requestedDirection) {
    warnings.push(`Unknown design direction "${requestedDirection}" — using Premium Agency.`);
  }

  // Eyebrow rationing is a hard page invariant (max 1 per 3 sections; the
  // taste pre-flight counts them mechanically) and models don't reliably obey
  // the prose rule, so enforce it deterministically: hero (brand) and
  // packages keep their eyebrows, the rest are cleared with a warning. The
  // operator can add any back in the Tenant Editor.
  const RATIONED_EYEBROW_SECTIONS = ["problem", "system", "process", "output", "enterprise", "faq", "finalCta"];
  const authored = { ...modelOutput };
  const clearedEyebrows = [];
  for (const key of RATIONED_EYEBROW_SECTIONS) {
    if (typeof authored?.[key]?.eyebrow === "string" && authored[key].eyebrow.trim()) {
      authored[key] = { ...authored[key], eyebrow: "" };
      clearedEyebrows.push(key);
    }
  }
  if (clearedEyebrows.length) {
    warnings.push(
      `Eyebrow rationing: cleared ${clearedEyebrows.join(", ")} (max 1 eyebrow per 3 sections; hero and packages keep theirs).`
    );
  }

  // Optional and never defaulted in: an absent/unknown preset produces a
  // design block byte-identical to pre-preset generation output.
  const requestedPreset = String(verticalPreset || "").trim();
  const preset = getVerticalPreset(requestedPreset);
  if (requestedPreset && !preset) {
    warnings.push(`Unknown vertical preset "${requestedPreset}" — generating without one.`);
  }

  const config = normalizeTenantConfig({
    ...authored,
    id: `tenant_${resolvedSlug}`,
    slug: resolvedSlug,
    status: "draft",
    defaultPackageId,
    // White-label drafts never inherit the platform default's enabled funding
    // cross-promo (another brand's offer + an extra section/eyebrow/CTA). The
    // operator can switch it on per tenant in the editor.
    fundingPromo: { enabled: false },
    design: {
      direction: directionId,
      overrides: {},
      ...(preset ? { verticalPreset: preset.id } : {})
    },
    // Validation requires at least one non-empty domain. Seed a placeholder the
    // operator replaces with the real domain before publishing.
    domains: [`${resolvedSlug}.example.com`]
  });

  const { ok, errors } = validateTenantConfig(config);
  if (!ok) {
    warnings.push(...errors.map((item) => `${item.path}: ${item.message}`));
  }
  // Advisory only: over-budget copy is surfaced, never truncated, and never
  // blocks saving the draft.
  warnings.push(...enforceCopyLimits(config));
  warnings.push("Replace the placeholder domain with the real domain before publishing.");

  return { config, warnings, valid: ok };
}

// Build the text prompt: the brief plus any inlined text/HTML/JSON references.
// PDFs are NOT inlined here — they're passed to the backend as attachments
// (document blocks in API-key mode, temp-file Read in subscription mode).
function buildPromptText({ prompt, brandName, slug, direction, verticalPreset, documents }) {
  const directionSpec = getDesignDirection(direction);
  const presetSpec = getVerticalPreset(verticalPreset);
  const presetLines = presetSpec
    ? [
        `Vertical: ${presetSpec.label}. ${presetSpec.blurb}`,
        `Proof pattern for this vertical: ${presetSpec.proofPattern}`,
        ...Object.entries(presetSpec.copyFrames).map(
          ([sectionId, frame]) => `Copy frame for the ${sectionId} section: ${frame}`
        )
      ]
    : [];
  const lines = [
    "Build a tenant configuration from this brief.",
    brandName ? `Brand name: ${brandName}` : "",
    slug ? `Preferred slug: ${slug}` : "",
    directionSpec
      ? `Design direction: ${directionSpec.label} (${directionSpec.blurb}) Copy tone: ${directionSpec.copyTone}`
      : "",
    ...presetLines,
    "",
    "Brief:",
    String(prompt || "").trim() || "(no additional prompt provided)"
  ];
  for (const doc of documents) {
    if (doc.mediaType === "application/pdf") continue;
    const decoded = Buffer.from(doc.base64, "base64").toString("utf8");
    const label =
      doc.mediaType === "text/html"
        ? `Reference landing page (HTML) "${doc.name}" — adapt its copy, sections, and structure`
        : doc.mediaType === "application/json"
          ? `Reference config (JSON) "${doc.name}" — use as a starting point to build on`
          : `Reference document "${doc.name}"`;
    lines.push("", `${label}:`, decoded);
  }
  return lines.filter((line) => line !== null && line !== undefined).join("\n");
}

/**
 * Generate a tenant config draft from a prompt and optional reference documents.
 *
 * @param {object} input
 * @param {string} input.prompt        Free-text brief describing the funnel.
 * @param {string} [input.brandName]   Brand name hint.
 * @param {string} [input.slug]        Preferred slug (defaults to slugified brand name).
 * @param {string} [input.direction]   Design direction id from the builder picker.
 * @param {string} [input.verticalPreset]  Vertical preset id from the builder picker.
 * @param {Array<{name:string, mediaType:string, base64:string}>} [input.documents]
 * @returns {Promise<{config: object, warnings: string[]}>}
 */
export async function generateTenantConfig({
  prompt,
  brandName,
  slug,
  direction,
  verticalPreset,
  documents = []
} = {}) {
  if (aiMode() === "off") {
    const error = new Error(
      "AI Tenant Builder is not configured. Set CLAUDE_CODE_OAUTH_TOKEN (Claude subscription) or ANTHROPIC_API_KEY."
    );
    error.name = "TenantBuilderNotConfigured";
    throw error;
  }

  if (!String(prompt || "").trim() && !documents.length) {
    const error = new Error("Provide a prompt or at least one reference document.");
    error.name = "TenantBuilderBadInput";
    throw error;
  }

  const safeDocuments = documents.slice(0, MAX_DOCUMENTS).filter((doc) => {
    const size = Buffer.byteLength(doc.base64 || "", "base64");
    return size > 0 && size <= MAX_DOCUMENT_BYTES;
  });
  const promptText = buildPromptText({
    prompt,
    brandName,
    slug,
    direction,
    verticalPreset,
    documents: safeDocuments
  });
  const pdfDocuments = safeDocuments.filter((doc) => doc.mediaType === "application/pdf");

  const ask = async () => {
    let modelOutput;
    try {
      modelOutput = await generateJson({
        system: SYSTEM_PROMPT,
        prompt: promptText,
        schema: GENERATION_SCHEMA,
        documents: pdfDocuments,
        model: MODEL
      });
    } catch (error) {
      if (error?.name === "AiRefused") {
        const refusal = new Error("The model declined to generate this tenant configuration.");
        refusal.name = "TenantBuilderRefused";
        throw refusal;
      }
      throw error;
    }
    return buildTenantConfigFromModelOutput({ modelOutput, brandName, slug, direction, verticalPreset });
  };

  // Subscription mode has no hard schema guarantee; one corrective retry if the
  // first result fails tenant validation.
  let result = await ask();
  if (!result.valid) {
    const retry = await ask();
    if (retry.valid) result = retry;
  }
  return result;
}
