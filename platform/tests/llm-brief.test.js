import assert from "node:assert/strict";
import test from "node:test";
import { buildOptionalSalesBrief, buildPublicSalesBriefContext, validateSalesBriefShape } from "../lib/enrichment/llmBrief.js";
import { buildSalesBrief } from "../lib/enrichment/salesBrief.js";

function createLeadFixture() {
  return {
    business: "Example Dental",
    websiteUrl: "https://example.com",
    phone: "+1 416 555 0100",
    notes: "Internal note: do not send this to the model.",
    metadata: {
      rating: 4.7,
      userRatingCount: 88,
      enrichment: {
        status: "complete",
        website: {
          title: "Example Dental",
          metaDescription: "Cosmetic and restorative dentistry in Toronto.",
          textSample: "Example Dental provides implants, veneers, whitening, and same-week consultations.",
          priorityPages: [
            { category: "services", url: "https://example.com/services" },
            { category: "contact", url: "https://example.com/contact" }
          ],
          headings: {
            h1: ["Example Dental"],
            h2: ["Implants", "Veneers", "Whitening", "Emergency care"]
          },
          schemaOrg: [{ "@type": "Dentist" }]
        },
        contacts: [
          { type: "phone", value: "+1 416 555 0100", sourceUrl: "https://example.com" },
          { type: "email", value: "hello@example.com", sourceUrl: "https://example.com/contact" }
        ],
        socialProfiles: {
          instagram: ["https://instagram.com/exampledental"]
        },
        signals: [
          { type: "schema_org", schemaType: "Dentist", sourceUrl: "https://example.com" }
        ]
      }
    }
  };
}

test("missing OPENAI_API_KEY returns deterministic fallback brief", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const lead = createLeadFixture();
    const fallback = buildSalesBrief({ lead });
    const result = await buildOptionalSalesBrief({ lead, fallbackBrief: fallback });

    assert.deepEqual(result, fallback);
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("LLM request sends only public business context and returns validated JSON", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  let requestBody;

  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";

  globalThis.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Example Dental has strong review proof and enough service breadth to support tighter offer-driven content.",
                  likelyNeeds: ["Sharper service-page conversion copy."],
                  outreachAngles: ["Reputation angle: turn reviews into clearer trust blocks and consultation CTAs."],
                  callerOpeningLine: "Hi, I was looking at Example Dental's public site and Google presence and saw a strong proof base that could convert more directly.",
                  objectionsToExpect: ["We already get referrals."],
                  suggestedOffer: "Review-led content refresh for service pages and trust sections.",
                  confidenceScore: 82,
                  fitScore: 76,
                  evidence: [
                    {
                      field: "metadata.rating",
                      detail: "Google rating is visible in the supplied context.",
                      value: "4.7"
                    }
                  ]
                })
              }
            }
          ]
        };
      }
    };
  };

  try {
    const lead = createLeadFixture();
    const result = await buildOptionalSalesBrief({ lead });

    assert.equal(result.summary.includes("Example Dental"), true);
    assert.equal(result.confidenceScore, 82);
    assert.equal(result.fitScore, 76);
    assert.equal(requestBody.model, "gpt-4o-mini");
    assert.equal(JSON.stringify(requestBody).includes("Internal note: do not send this to the model."), false);
    assert.equal(
      requestBody.messages[1].content.includes("\"notes\""),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("invalid LLM output falls back to deterministic brief", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = "test-openai-key";
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 42,
                likelyNeeds: []
              })
            }
          }
        ]
      };
    }
  });

  try {
    const lead = createLeadFixture();
    const fallback = buildSalesBrief({ lead });
    const result = await buildOptionalSalesBrief({ lead, fallbackBrief: fallback });

    assert.deepEqual(result, fallback);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("context builder excludes private notes and validator guards schema", () => {
  const context = buildPublicSalesBriefContext(createLeadFixture());
  const invalid = validateSalesBriefShape({
    summary: "x",
    likelyNeeds: [],
    outreachAngles: [],
    callerOpeningLine: "x",
    objectionsToExpect: [],
    suggestedOffer: "x",
    confidenceScore: 200,
    fitScore: 40,
    evidence: []
  });

  assert.equal("notes" in context, false);
  assert.equal(invalid, null);
});
