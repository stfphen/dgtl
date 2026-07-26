import assert from "node:assert/strict";
import test from "node:test";
import { enrichLeadContext } from "../lib/enrichment/index.js";
import { enrichJobs } from "../lib/enrichment/providers/jobs.js";
import { enrichNews } from "../lib/enrichment/providers/news.js";
import { enrichReviews } from "../lib/enrichment/providers/reviews.js";
import { enrichTechStack } from "../lib/enrichment/providers/techStack.js";

function htmlResponse(html, url, contentType = "text/html; charset=utf-8") {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers({ "content-type": contentType }),
    async text() {
      return html;
    }
  };
}

test("stub providers skip cleanly when not configured", async () => {
  const originalValues = {
    REVIEWS_API_KEY: process.env.REVIEWS_API_KEY,
    YELP_API_KEY: process.env.YELP_API_KEY,
    BING_PLACES_API_KEY: process.env.BING_PLACES_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    BING_NEWS_API_KEY: process.env.BING_NEWS_API_KEY,
    JOBS_API_KEY: process.env.JOBS_API_KEY,
    TECH_STACK_API_KEY: process.env.TECH_STACK_API_KEY,
    BUILTWITH_API_KEY: process.env.BUILTWITH_API_KEY
  };

  delete process.env.REVIEWS_API_KEY;
  delete process.env.YELP_API_KEY;
  delete process.env.BING_PLACES_API_KEY;
  delete process.env.NEWS_API_KEY;
  delete process.env.BING_NEWS_API_KEY;
  delete process.env.JOBS_API_KEY;
  delete process.env.TECH_STACK_API_KEY;
  delete process.env.BUILTWITH_API_KEY;

  try {
    const results = await Promise.all([
      enrichReviews({ lead: { business: "Example Dental" } }),
      enrichNews({ lead: { business: "Example Dental" } }),
      enrichJobs({ lead: { business: "Example Dental" } }),
      enrichTechStack({ lead: { business: "Example Dental" } })
    ]);

    for (const result of results) {
      assert.deepEqual(result, {
        ok: false,
        skipped: true,
        reason: "Provider not configured",
        signals: []
      });
    }
  } finally {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("enrichLeadContext returns website data and skipped provider results without failing", async () => {
  const originalFetch = globalThis.fetch;
  const originalValues = {
    REVIEWS_API_KEY: process.env.REVIEWS_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    JOBS_API_KEY: process.env.JOBS_API_KEY,
    TECH_STACK_API_KEY: process.env.TECH_STACK_API_KEY
  };

  delete process.env.REVIEWS_API_KEY;
  delete process.env.NEWS_API_KEY;
  delete process.env.JOBS_API_KEY;
  delete process.env.TECH_STACK_API_KEY;

  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://example.com/");
    return htmlResponse(
      `
        <html>
          <head>
            <title>Example Dental</title>
            <meta name="description" content="Cosmetic dentistry in Toronto">
          </head>
          <body>
            <h1>Modern dental care</h1>
            <p>Call us at (416) 555-0199 for Invisalign and implants.</p>
          </body>
        </html>
      `,
      "https://example.com/"
    );
  };

  try {
    const result = await enrichLeadContext({
      lead: {
        business: "Example Dental",
        websiteUrl: "https://example.com"
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.website.title, "Example Dental");
    assert.equal(result.providers.reviews.skipped, true);
    assert.equal(result.providers.news.skipped, true);
    assert.equal(result.providers.jobs.skipped, true);
    assert.equal(result.providers.techStack.skipped, true);
    assert.equal(Array.isArray(result.contacts), true);
    assert.equal(Array.isArray(result.signals), true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("configured but unimplemented providers still skip without failing enrichment", async () => {
  const originalFetch = globalThis.fetch;
  const originalValues = {
    YELP_API_KEY: process.env.YELP_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    JOBS_API_KEY: process.env.JOBS_API_KEY,
    BUILTWITH_API_KEY: process.env.BUILTWITH_API_KEY
  };

  process.env.YELP_API_KEY = "configured";
  process.env.NEWS_API_KEY = "configured";
  process.env.JOBS_API_KEY = "configured";
  process.env.BUILTWITH_API_KEY = "configured";

  globalThis.fetch = async (url) =>
    htmlResponse("<html><head><title>Example Dental</title></head><body><h1>Dental</h1></body></html>", String(url));

  try {
    const result = await enrichLeadContext({
      lead: {
        business: "Example Dental",
        websiteUrl: "https://example.com"
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.providers.reviews.reason, "Reviews provider interface not implemented");
    assert.equal(result.providers.news.reason, "News provider interface not implemented");
    assert.equal(result.providers.jobs.reason, "Jobs provider interface not implemented");
    assert.equal(result.providers.techStack.reason, "Tech stack provider interface not implemented");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
