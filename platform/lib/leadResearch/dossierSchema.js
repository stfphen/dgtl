// JSON schema + shared vocab for the AI Deep Research dossier.
//
// This schema is handed to Claude in STAGE B (the structuring call) via
// output_config.format. Structured outputs cannot be combined with web search
// (web search emits citations, which 400s with output_config) — that is why
// research happens in a separate Stage A call. See researchLead.js.
//
// JSON-schema rules for structured outputs: every object needs
// additionalProperties:false and a required[]; numeric/length constraints and
// recursion are unsupported. Confidence is therefore a string enum, never a
// number.

export const CONFIDENCE_LEVELS = ["verified", "high", "medium", "low", "unverified"];
export const HIGH_CONFIDENCE = new Set(["verified", "high"]);

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "yelp",
  "google",
  "other"
];

export const SIGNAL_TYPES = [
  "hiring",
  "expansion",
  "pain_point",
  "tech_stack",
  "review_theme",
  "press",
  "other"
];

function contactItem(valueType) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "type", "confidence", "sourceUrl"],
    properties: {
      value: { type: "string" },
      type: { enum: [valueType] },
      confidence: { enum: CONFIDENCE_LEVELS },
      sourceUrl: { type: "string", description: "Public URL this contact was found on." },
      note: { type: "string" }
    }
  };
}

export const DOSSIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessProfile",
    "verifiedContacts",
    "decisionMakers",
    "webPresence",
    "servicesOffered",
    "signals",
    "suggestedOffer",
    "citations",
    "compliance"
  ],
  properties: {
    businessProfile: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "category", "locationText", "confidence"],
      properties: {
        summary: { type: "string" },
        category: { type: "string" },
        locationText: { type: "string" },
        foundedOrYears: { type: "string" },
        confidence: { enum: CONFIDENCE_LEVELS }
      }
    },
    verifiedContacts: {
      type: "object",
      additionalProperties: false,
      required: ["emails", "phones"],
      properties: {
        emails: { type: "array", items: contactItem("email") },
        phones: { type: "array", items: contactItem("phone") }
      }
    },
    decisionMakers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "title", "confidence", "sourceUrl"],
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          profileUrl: { type: "string" },
          confidence: { enum: CONFIDENCE_LEVELS },
          sourceUrl: { type: "string" }
        }
      }
    },
    webPresence: {
      type: "object",
      additionalProperties: false,
      required: ["confirmedWebsite", "socialProfiles"],
      properties: {
        confirmedWebsite: {
          type: "object",
          additionalProperties: false,
          required: ["url", "confidence", "sourceUrl"],
          properties: {
            url: { type: "string", description: "Empty string if no official site was found." },
            confidence: { enum: CONFIDENCE_LEVELS },
            sourceUrl: { type: "string" }
          }
        },
        socialProfiles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["platform", "url", "confidence", "sourceUrl"],
            properties: {
              platform: { enum: SOCIAL_PLATFORMS },
              url: { type: "string" },
              confidence: { enum: CONFIDENCE_LEVELS },
              sourceUrl: { type: "string" }
            }
          }
        }
      }
    },
    servicesOffered: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "sourceUrl"],
        properties: {
          name: { type: "string" },
          sourceUrl: { type: "string" }
        }
      }
    },
    signals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "detail", "sourceUrl"],
        properties: {
          type: { enum: SIGNAL_TYPES },
          detail: { type: "string" },
          sourceUrl: { type: "string" }
        }
      }
    },
    suggestedOffer: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "rationale"],
      properties: {
        summary: { type: "string" },
        rationale: { type: "string" }
      }
    },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title"],
        properties: {
          url: { type: "string" },
          title: { type: "string" }
        }
      }
    },
    compliance: {
      type: "object",
      additionalProperties: false,
      required: ["publicDataOnly", "notes"],
      properties: {
        publicDataOnly: { type: "boolean" },
        notes: { type: "string" }
      }
    }
  }
};
