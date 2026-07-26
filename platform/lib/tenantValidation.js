import { normalizeTenantConfig } from "./defaultTenant.js";
import { sanitizeHeroVideo } from "./media/youtube.js";
import { DEFAULT_DIRECTION_ID, isValidDirectionId } from "./tenantBuilder/designDirections.js";
import { isValidVerticalPresetId } from "./tenantBuilder/verticalPresets.js";
import { sanitizeSectionVariants } from "./tenantBuilder/sectionVariants.js";

const VALID_STATUSES = new Set(["active", "draft", "archived"]);
const VALID_PACKAGE_ACTIONS = new Set(["checkout", "booking", "capture"]);
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const ARRAY_PATHS = [
  ["hero", "stats"],
  ["problem", "points"],
  ["system", "features"],
  ["process", "steps"],
  ["output", "tiles"],
  ["portfolio", "items"],
  ["references", "testimonials"],
  ["references", "logos"],
  ["faq", "items"],
  ["contractorSettings", "serviceAreas"]
];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeStripeConfig(value) {
  if (!isObject(value)) return undefined;
  const stripe = {
    priceId: trimString(value.priceId),
    currency: trimString(value.currency).toLowerCase(),
    productName: trimString(value.productName),
    mode: value.mode === "subscription" ? "subscription" : "payment"
  };
  const amount = Number(value.amount);
  if (Number.isFinite(amount) && amount > 0) stripe.amount = Math.round(amount);
  // Drop the block entirely if no price was configured.
  if (!stripe.priceId && !stripe.amount) return undefined;
  return stripe;
}

function normalizeStringArray(value) {
  return normalizeArray(value).map((item) => (typeof item === "string" ? item.trim() : ""));
}

// Media src/thumbnail/link values may only be root-relative ("/assets/...") or
// http(s) URLs — same rule as media.heroImage. Protocol-relative "//host" is
// rejected along with javascript:/data:/bare values.
function sanitizeMediaSrc(value) {
  const src = trimString(value);
  if (!src) return "";
  if (HTTP_URL_PATTERN.test(src)) return src;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  return "";
}

const VALID_PORTFOLIO_MEDIA_TYPES = new Set(["image", "video", "embed"]);

function sanitizePortfolioItem(item) {
  if (!isObject(item)) return null;
  const src = sanitizeMediaSrc(item.src);
  const mediaId = trimString(item.mediaId);
  // An item with neither a direct asset nor a media-library reference renders
  // nothing — drop it entirely. A mediaId-only item is kept: the render-time
  // resolver substitutes the asset url (or the slot degrades to empty).
  if (!src && !mediaId) return null;
  return {
    id: trimString(item.id),
    title: trimString(item.title),
    caption: trimString(item.caption),
    client: trimString(item.client),
    result: trimString(item.result),
    mediaType: VALID_PORTFOLIO_MEDIA_TYPES.has(item.mediaType) ? item.mediaType : "image",
    src,
    mediaId,
    thumbnail: sanitizeMediaSrc(item.thumbnail),
    alt: trimString(item.alt),
    tags: {
      industry: normalizeStringArray(item.tags?.industry).filter(Boolean),
      format: normalizeStringArray(item.tags?.format).filter(Boolean)
    },
    link: sanitizeMediaSrc(item.link)
  };
}

function sanitizeTestimonial(entry) {
  if (!isObject(entry)) return null;
  const quote = trimString(entry.quote);
  if (!quote) return null;
  return {
    quote,
    name: trimString(entry.name),
    role: trimString(entry.role),
    company: trimString(entry.company)
  };
}

function sanitizeReferenceLogo(entry) {
  if (!isObject(entry)) return null;
  const src = sanitizeMediaSrc(entry.src);
  const mediaId = trimString(entry.mediaId);
  if (!src && !mediaId) return null;
  return {
    name: trimString(entry.name),
    src,
    mediaId,
    alt: trimString(entry.alt),
    link: sanitizeMediaSrc(entry.link)
  };
}

function hasOwnPath(input, path) {
  let current = input;
  for (const part of path) {
    if (!isObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) return false;
    current = current[part];
  }
  return true;
}

function setArrayPath(tenant, section, key) {
  tenant[section] = {
    ...(isObject(tenant[section]) ? tenant[section] : {}),
    [key]: normalizeArray(tenant[section]?.[key])
  };
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function sanitizeDesignBlock(design) {
  const block = {
    ...(isObject(design) ? design : {}),
    direction: isValidDirectionId(trimString(design?.direction))
      ? trimString(design.direction)
      : DEFAULT_DIRECTION_ID,
    overrides: isObject(design?.overrides) ? design.overrides : {}
  };

  if (isValidVerticalPresetId(trimString(design?.verticalPreset))) {
    block.verticalPreset = trimString(design.verticalPreset);
  } else {
    delete block.verticalPreset;
  }

  const sectionVariants = sanitizeSectionVariants(design?.sectionVariants);
  if (Object.keys(sectionVariants).length > 0) {
    block.sectionVariants = sectionVariants;
  } else {
    delete block.sectionVariants;
  }

  return block;
}

export function sanitizeTenantConfig(input) {
  const normalized = normalizeTenantConfig(isObject(input) ? input : {});
  const tenant = {
    ...normalized,
    id: trimString(normalized.id),
    slug: trimString(normalized.slug),
    status: trimString(normalized.status),
    defaultPackageId: trimString(normalized.defaultPackageId),
    domains: normalizeStringArray(normalized.domains),
    brand: {
      ...(isObject(normalized.brand) ? normalized.brand : {}),
      name: trimString(normalized.brand?.name),
      primaryColor: trimString(normalized.brand?.primaryColor),
      accentColor: trimString(normalized.brand?.accentColor)
    },
    media: {
      ...(isObject(normalized.media) ? normalized.media : {}),
      heroImage: sanitizeMediaSrc(normalized.media?.heroImage),
      heroImageId: trimString(normalized.media?.heroImageId),
      heroAlt: trimString(normalized.media?.heroAlt),
      // Invalid/incomplete YouTube config coerces to the empty block — never
      // an error, so existing tenants keep publishing.
      heroVideo: sanitizeHeroVideo(normalized.media?.heroVideo)
    },
    // An unknown direction id is coerced (never an error) so existing tenants
    // and hand-edited configs always keep publishing with the default look.
    // verticalPreset/sectionVariants are optional: invalid values are DELETED,
    // never coerced to a default — absence is the safe (pre-preset) state.
    design: sanitizeDesignBlock(normalized.design),
    portfolio: {
      ...(isObject(normalized.portfolio) ? normalized.portfolio : {}),
      eyebrow: trimString(normalized.portfolio?.eyebrow),
      headline: trimString(normalized.portfolio?.headline),
      body: trimString(normalized.portfolio?.body),
      items: normalizeArray(normalized.portfolio?.items).map(sanitizePortfolioItem).filter(Boolean)
    },
    references: {
      ...(isObject(normalized.references) ? normalized.references : {}),
      eyebrow: trimString(normalized.references?.eyebrow),
      headline: trimString(normalized.references?.headline),
      testimonials: normalizeArray(normalized.references?.testimonials)
        .map(sanitizeTestimonial)
        .filter(Boolean),
      logos: normalizeArray(normalized.references?.logos).map(sanitizeReferenceLogo).filter(Boolean)
    },
    packages: normalizeArray(normalized.packages).map((pkg) => ({
      ...(isObject(pkg) ? pkg : {}),
      id: trimString(pkg?.id),
      action: trimString(pkg?.action),
      paymentLink: trimString(pkg?.paymentLink),
      bookingLink: trimString(pkg?.bookingLink),
      stripe: sanitizeStripeConfig(pkg?.stripe),
      features: normalizeArray(pkg?.features)
    }))
  };

  for (const [section, key] of ARRAY_PATHS) {
    setArrayPath(tenant, section, key);
  }

  return tenant;
}

export function validateTenantConfig(input) {
  const errors = [];
  const source = isObject(input) ? input : {};
  const tenant = sanitizeTenantConfig(source);

  if (!isObject(input)) {
    addError(errors, "config", "Tenant config must be an object.");
  }

  if (!hasOwnPath(source, ["id"]) || !tenant.id) {
    addError(errors, "id", "Tenant id is required.");
  }

  if (!hasOwnPath(source, ["slug"]) || !tenant.slug) {
    addError(errors, "slug", "Tenant slug is required.");
  } else if (!SLUG_PATTERN.test(tenant.slug)) {
    addError(errors, "slug", "Tenant slug must use lowercase letters, numbers, and dashes only.");
  }

  if (!hasOwnPath(source, ["status"]) || !tenant.status) {
    addError(errors, "status", "Tenant status is required.");
  } else if (!VALID_STATUSES.has(tenant.status)) {
    addError(errors, "status", "Tenant status must be active, draft, or archived.");
  }

  if (!hasOwnPath(source, ["brand", "name"]) || !tenant.brand.name) {
    addError(errors, "brand.name", "Brand name is required.");
  }

  if (!hasOwnPath(source, ["domains"]) || !Array.isArray(source.domains)) {
    addError(errors, "domains", "At least one domain is required.");
  } else if (!tenant.domains.length || tenant.domains.some((domain) => !domain)) {
    addError(errors, "domains", "Domains must be non-empty strings.");
  }

  if (!hasOwnPath(source, ["packages"]) || !Array.isArray(source.packages)) {
    addError(errors, "packages", "At least one package is required.");
  } else if (!tenant.packages.length) {
    addError(errors, "packages", "At least one package is required.");
  }

  const packageIds = tenant.packages.map((pkg) => pkg.id);
  const uniquePackageIds = new Set(packageIds);
  if (packageIds.some((packageId) => !packageId)) {
    addError(errors, "packages", "Each package must have a non-empty id.");
  }
  if (uniquePackageIds.size !== packageIds.length) {
    addError(errors, "packages", "Package ids must be unique.");
  }
  if (tenant.defaultPackageId && !uniquePackageIds.has(tenant.defaultPackageId)) {
    addError(errors, "defaultPackageId", "Default package id must match one of the package ids.");
  }

  tenant.packages.forEach((pkg, index) => {
    if (!VALID_PACKAGE_ACTIONS.has(pkg.action)) {
      addError(
        errors,
        `packages.${index}.action`,
        "Package action must be checkout, booking, or capture."
      );
    }

    for (const field of ["paymentLink", "bookingLink"]) {
      const value = pkg[field];
      if (value && !HTTP_URL_PATTERN.test(value)) {
        addError(errors, `packages.${index}.${field}`, `${field} must start with http:// or https://.`);
      }
    }
  });

  for (const field of ["primaryColor", "accentColor"]) {
    const value = tenant.brand[field];
    if (value && !HEX_COLOR_PATTERN.test(value)) {
      addError(errors, `brand.${field}`, `${field} must be a valid hex color.`);
    }
  }

  if (tenant.routing?.leadWebhookUrl && !HTTP_URL_PATTERN.test(tenant.routing.leadWebhookUrl)) {
    addError(errors, "routing.leadWebhookUrl", "leadWebhookUrl must start with http:// or https://.");
  }

  return {
    ok: errors.length === 0,
    tenant,
    errors
  };
}

export function validateTenantConfigOrThrow(input) {
  const result = validateTenantConfig(input);
  if (!result.ok) {
    const error = new Error(result.errors.map((item) => item.message).join(" "));
    error.name = "TenantValidationError";
    error.errors = result.errors;
    throw error;
  }
  return result.tenant;
}

export function tenantConfigToJson(config) {
  return `${JSON.stringify(sanitizeTenantConfig(config), null, 2)}\n`;
}
