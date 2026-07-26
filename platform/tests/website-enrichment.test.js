import assert from "node:assert/strict";
import test from "node:test";
import { enrichWebsite } from "../lib/enrichment/website.js";
import { getDomainFromUrl, isHttpUrl, normalizeUrl, sameDomain } from "../lib/enrichment/url.js";

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

test("url helpers normalize and compare website URLs", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("mailto:test@example.com"), null);
  assert.equal(getDomainFromUrl("https://www.example.com/about"), "example.com");
  assert.equal(isHttpUrl("https://example.com"), true);
  assert.equal(isHttpUrl("ftp://example.com"), false);
  assert.equal(sameDomain("https://www.example.com/contact", "https://example.com/about"), true);
});

test("extracts title, meta description, contacts, social links, and priority pages", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    const value = String(url);
    calls.push(value);

    if (value === "https://example.com/") {
      return htmlResponse(
        `
          <html>
            <head>
              <title>Example Dental</title>
              <meta name="description" content="Cosmetic dentistry in Toronto">
              <meta property="og:title" content="Example Dental OG">
              <meta property="og:description" content="Smile transformations">
              <meta property="og:image" content="https://cdn.example.com/hero.jpg">
              <link rel="canonical" href="/home" />
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Dentist","name":"Example Dental"}
              </script>
            </head>
            <body>
              <h1>Modern dental care</h1>
              <h2>Services</h2>
              <p>Call us at (416) 555-0199 for Invisalign and implants.</p>
              <a href="/contact">Contact</a>
              <a href="/about">About our clinic</a>
              <a href="/services">Services</a>
              <a href="/team">Team</a>
              <a href="https://instagram.com/exampledental">Instagram</a>
              <a href="https://linkedin.com/company/exampledental">LinkedIn</a>
              <a href="https://facebook.com/exampledental">Facebook</a>
              <a href="https://x.com/exampledental">X</a>
              <a href="https://youtube.com/@exampledental">YouTube</a>
              <a href="https://tiktok.com/@exampledental">TikTok</a>
              <a href="https://bsky.app/profile/exampledental.bsky.social">Bluesky</a>
              <a href="https://reddit.com/u/exampledental">Reddit</a>
            </body>
          </html>
        `,
        "https://example.com/"
      );
    }

    if (value === "https://example.com/contact") {
      return htmlResponse(
        `
          <html>
            <body>
              <h1>Contact us</h1>
              <a href="mailto:hello@example.com">hello@example.com</a>
              <a href="tel:+14165550199">+1 416 555 0199</a>
            </body>
          </html>
        `,
        value
      );
    }

    if (value === "https://example.com/about") {
      return htmlResponse("<html><body><h1>About Example Dental</h1></body></html>", value);
    }

    if (value === "https://example.com/services") {
      return htmlResponse("<html><body><h1>Implants and veneers</h1></body></html>", value);
    }

    throw new Error(`Unexpected URL: ${value}`);
  };

  try {
    const result = await enrichWebsite({
      url: "example.com",
      business: "Example Dental"
    });

    assert.equal(result.ok, true);
    assert.equal(result.reason, null);
    assert.equal(result.website.title, "Example Dental");
    assert.equal(result.website.metaDescription, "Cosmetic dentistry in Toronto");
    assert.equal(result.website.openGraph.title, "Example Dental OG");
    assert.equal(result.website.canonicalUrl, "https://example.com/home");
    assert.equal(result.website.priorityPages.length, 3);
    assert.deepEqual(
      result.website.priorityPages.map((page) => page.category),
      ["contact", "about", "services"]
    );
    assert.equal(result.contacts.some((contact) => contact.type === "email" && contact.value === "hello@example.com"), true);
    assert.equal(result.contacts.some((contact) => contact.type === "phone" && contact.value === "+1 416 555 0199"), true);
    assert.deepEqual(result.socialProfiles.instagram, [
      {
        url: "https://instagram.com/exampledental",
        handle: "@exampledental",
        sourceUrl: "https://example.com/"
      }
    ]);
    assert.deepEqual(result.socialProfiles.linkedin, [
      {
        url: "https://linkedin.com/company/exampledental",
        handle: "company/exampledental",
        sourceUrl: "https://example.com/"
      }
    ]);
    assert.deepEqual(result.socialProfiles.facebook[0].handle, "exampledental");
    assert.deepEqual(result.socialProfiles.x[0].handle, "@exampledental");
    assert.deepEqual(result.socialProfiles.youtube[0].handle, "@exampledental");
    assert.deepEqual(result.socialProfiles.tiktok[0].handle, "@exampledental");
    assert.deepEqual(result.socialProfiles.bluesky[0].handle, "exampledental.bsky.social");
    assert.deepEqual(result.socialProfiles.reddit[0].handle, "u/exampledental");
    assert.equal(result.website.schemaOrg[0]["@type"], "Dentist");
    assert.equal(result.compliance.requestCount, 4);
    assert.deepEqual(calls, [
      "https://example.com/",
      "https://example.com/contact",
      "https://example.com/about",
      "https://example.com/services"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("handles timeout and fetch failure gracefully with structured output", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (_url, options = {}) =>
    new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      });
    });

  try {
    const result = await enrichWebsite({
      url: "https://example.com",
      timeoutMs: 5
    });

    assert.equal(result.ok, false);
    assert.match(result.reason, /timed out/i);
    assert.equal(result.contacts.length, 0);
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].ok, false);
    assert.equal(result.compliance.requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not throw on invalid HTML and still returns structured partial data", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    htmlResponse(
      `
        <html>
          <head>
            <title>Broken markup
            <meta name="description" content="Still parse what you can">
            <script type="application/ld+json">{not valid json</script>
          </head>
          <body>
            <h1>Broken page
            <a href="/contact">Contact
        `,
      "https://example.com/"
    );

  try {
    const result = await enrichWebsite({
      url: "https://example.com"
    });

    assert.equal(result.ok, true);
    assert.equal(Array.isArray(result.website.schemaOrg), true);
    assert.equal(Array.isArray(result.website.headings.h1), true);
    assert.equal(Array.isArray(result.contacts), true);
    assert.equal(Array.isArray(result.sources), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
