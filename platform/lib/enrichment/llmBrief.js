import { buildSalesBrief } from "./salesBrief.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null;
  return Math.round(numeric);
}

function getGoogleListingMetadata(lead) {
  const metadata = isPlainObject(lead?.metadata) ? lead.metadata : {};
  const candidates = [
    metadata.googlePlaces,
    metadata.google_places,
    metadata.place,
    metadata
  ];

  return candidates.find((candidate) =>
    isPlainObject(candidate) &&
    (
      candidate.rating !== undefined ||
      candidate.userRatingCount !== undefined ||
      Array.isArray(candidate.types)
    )
  ) || {};
}

function getWebsiteContacts(enrichment) {
  const contacts = asArray(enrichment?.contacts);
  return {
    emails: uniqueValues(
      contacts
        .filter((contact) => contact?.type === "email")
        .map((contact) => contact?.value)
    ).slice(0, 8),
    phones: uniqueValues(
      contacts
        .filter((contact) => contact?.type === "phone")
        .map((contact) => contact?.value)
    ).slice(0, 8)
  };
}

function getWebsiteSignals(enrichment) {
  return asArray(enrichment?.signals)
    .map((signal) => {
      if (!isPlainObject(signal)) return null;
      return {
        type: typeof signal.type === "string" ? signal.type : "",
        category: typeof signal.category === "string" ? signal.category : "",
        platform: typeof signal.platform === "string" ? signal.platform : "",
        schemaType: typeof signal.schemaType === "string" ? signal.schemaType : "",
        value: typeof signal.value === "string" ? signal.value : ""
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function getSchemaTypes(schemaOrg) {
  return uniqueValues(
    asArray(schemaOrg)
      .map((entry) => {
        if (!isPlainObject(entry)) return "";
        if (typeof entry["@type"] === "string") return entry["@type"];
        if (Array.isArray(entry["@type"])) return entry["@type"].find((value) => typeof value === "string") || "";
        return "";
      })
      .filter(Boolean)
  );
}

export function buildPublicSalesBriefContext(lead) {
  const enrichment = isPlainObject(lead?.metadata?.enrichment) ? lead.metadata.enrichment : {};
  const website = isPlainObject(enrichment.website) ? enrichment.website : {};
  const googleListing = getGoogleListingMetadata(lead);
  const contacts = getWebsiteContacts(enrichment);

  return {
    business: lead?.business || "",
    websiteUrl: lead?.websiteUrl || website.finalUrl || website.url || "",
    businessPhone: lead?.phone || "",
    sourceType: lead?.sourceType || "",
    googleListing: {
      rating: typeof googleListing.rating === "number" ? googleListing.rating : Number(googleListing.rating || 0) || null,
      reviewCount:
        typeof googleListing.userRatingCount === "number"
          ? googleListing.userRatingCount
          : Number(googleListing.userRatingCount || 0) || null,
      categories: asArray(googleListing.types).slice(0, 12)
    },
    website: {
      title: website.title || "",
      metaDescription: website.metaDescription || "",
      canonicalUrl: website.canonicalUrl || "",
      headings: {
        h1: asArray(website.headings?.h1).slice(0, 6),
        h2: asArray(website.headings?.h2).slice(0, 8),
        h3: asArray(website.headings?.h3).slice(0, 8)
      },
      textSample: String(website.textSample || "").slice(0, 500),
      priorityPages: asArray(website.priorityPages)
        .map((page) => ({
          category: typeof page?.category === "string" ? page.category : "",
          url: typeof page?.url === "string" ? page.url : ""
        }))
        .filter((page) => page.category && page.url)
        .slice(0, 6),
      schemaTypes: getSchemaTypes(website.schemaOrg)
    },
    contacts,
    socialProfiles: isPlainObject(enrichment.socialProfiles) ? enrichment.socialProfiles : {},
    signals: getWebsiteSignals(enrichment)
  };
}

function getCompletionText(payload) {
  const message = payload?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string") return message.content;

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateSalesBriefShape(value) {
  if (!isPlainObject(value)) return null;

  const summary = typeof value.summary === "string" ? value.summary.trim() : "";
  const likelyNeeds = isStringArray(value.likelyNeeds) ? value.likelyNeeds.map((item) => item.trim()).filter(Boolean) : null;
  const outreachAngles = isStringArray(value.outreachAngles) ? value.outreachAngles.map((item) => item.trim()).filter(Boolean) : null;
  const callerOpeningLine =
    typeof value.callerOpeningLine === "string" ? value.callerOpeningLine.trim() : "";
  const objectionsToExpect =
    isStringArray(value.objectionsToExpect) ? value.objectionsToExpect.map((item) => item.trim()).filter(Boolean) : null;
  const suggestedOffer = typeof value.suggestedOffer === "string" ? value.suggestedOffer.trim() : "";
  const confidenceScore = sanitizeScore(value.confidenceScore);
  const fitScore = sanitizeScore(value.fitScore);
  const evidence = Array.isArray(value.evidence)
    ? value.evidence
        .map((item) => {
          if (!isPlainObject(item)) return null;
          const field = typeof item.field === "string" ? item.field.trim() : "";
          const detail = typeof item.detail === "string" ? item.detail.trim() : "";
          const rawValue = item.value;
          const normalizedValue = typeof rawValue === "string"
            ? rawValue.trim()
            : typeof rawValue === "number" || typeof rawValue === "boolean"
              ? String(rawValue)
              : rawValue === null
                ? "null"
                : "";

          if (!field || !detail || !normalizedValue) return null;
          return {
            field,
            detail,
            value: normalizedValue
          };
        })
        .filter(Boolean)
    : null;

  if (
    !summary ||
    !likelyNeeds ||
    !outreachAngles ||
    !callerOpeningLine ||
    !objectionsToExpect ||
    !suggestedOffer ||
    confidenceScore === null ||
    fitScore === null ||
    !evidence
  ) {
    return null;
  }

  return {
    summary,
    likelyNeeds,
    outreachAngles,
    callerOpeningLine,
    objectionsToExpect,
    suggestedOffer,
    confidenceScore,
    fitScore,
    evidence
  };
}

function buildRequestBody({ context, model }) {
  return {
    model,
    messages: [
      {
        role: "system",
        content:
          "You write concise B2B sales intelligence briefs from public business website and listing data. Use only the provided public professional information. Do not invent private notes, personal details, or unsupported claims. Return strict JSON that matches the schema exactly."
      },
      {
        role: "user",
        content: [
          "Build a sales intelligence brief for this prospect.",
          "Keep the tone practical and specific for a caller.",
          "Use evidence only from the supplied public data.",
          JSON.stringify(context, null, 2)
        ].join("\n\n")
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sales_intelligence_brief",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            likelyNeeds: {
              type: "array",
              items: { type: "string" }
            },
            outreachAngles: {
              type: "array",
              items: { type: "string" }
            },
            callerOpeningLine: { type: "string" },
            objectionsToExpect: {
              type: "array",
              items: { type: "string" }
            },
            suggestedOffer: { type: "string" },
            confidenceScore: {
              type: "number",
              minimum: 0,
              maximum: 100
            },
            fitScore: {
              type: "number",
              minimum: 0,
              maximum: 100
            },
            evidence: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  field: { type: "string" },
                  detail: { type: "string" },
                  value: { type: "string" }
                },
                required: ["field", "detail", "value"]
              }
            }
          },
          required: [
            "summary",
            "likelyNeeds",
            "outreachAngles",
            "callerOpeningLine",
            "objectionsToExpect",
            "suggestedOffer",
            "confidenceScore",
            "fitScore",
            "evidence"
          ]
        }
      }
    }
  };
}

export async function buildOptionalSalesBrief({
  lead,
  fallbackBrief,
  model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
} = {}) {
  const fallback = fallbackBrief || buildSalesBrief({ lead });
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  const context = buildPublicSalesBriefContext(lead);
  const requestBody = buildRequestBody({ context, model });

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = await response.json();
    if (payload?.choices?.[0]?.message?.refusal) {
      return fallback;
    }

    const content = getCompletionText(payload);
    if (!content) return fallback;

    const parsed = JSON.parse(content);
    return validateSalesBriefShape(parsed) || fallback;
  } catch {
    return fallback;
  }
}
