import assert from "node:assert/strict";
import test from "node:test";

import { searchSecEdgar, getEdgarFirmographics } from "../lib/integrations/secEdgar.js";
import { searchOpenCorporates } from "../lib/integrations/openCorporates.js";
import { sourceAccountPreviews, enrichAccountContacts } from "../lib/enterpriseProspecting/sourcing.js";

const realFetch = globalThis.fetch;
function mockFetch(router) {
  globalThis.fetch = async (url, options) => router(String(url), options);
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}
function jsonRes(body, ok = true, status = 200) {
  return { ok, status, async json() { return body; } };
}
function withEnv(name, value, fn) {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) delete process.env[name];
      else process.env[name] = prev;
    });
}

// --- SEC EDGAR ---

test("searchSecEdgar maps company_tickers to public-company accounts", async () => {
  mockFetch((url) => {
    if (url.includes("company_tickers.json")) {
      return jsonRes({ "0": { cik_str: 320193, ticker: "AAPL", title: "APPLE INC" }, "1": { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" } });
    }
    return jsonRes({}, false, 404);
  });
  try {
    const res = await searchSecEdgar({ query: "apple", limit: 10 });
    assert.equal(res.ok, true);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].firmographics.ticker, "AAPL");
    assert.equal(res.data[0].firmographics.ownership, "public");
    assert.equal(res.data[0].firmographics.cik, "0000320193");
    assert.equal(res.data[0].sourceType, "open_db");
  } finally {
    restoreFetch();
  }
});

test("searchSecEdgar degrades on HTTP error (no throw)", async () => {
  mockFetch(() => jsonRes({}, false, 403));
  try {
    const res = await searchSecEdgar({ query: "x" });
    assert.equal(res.ok, false);
    assert.match(res.reason, /403/);
  } finally {
    restoreFetch();
  }
});

test("searchSecEdgar returns empty (ok) for blank query", async () => {
  const res = await searchSecEdgar({ query: "" });
  assert.equal(res.ok, true);
  assert.equal(res.data.length, 0);
});

test("getEdgarFirmographics maps submissions to industry + geo", async () => {
  mockFetch((url) => {
    if (url.includes("submissions/CIK")) {
      return jsonRes({ name: "APPLE INC", sicDescription: "Electronic Computers", addresses: { business: { city: "Cupertino", stateOrCountryDescription: "CA" } }, tickers: ["AAPL"] });
    }
    return jsonRes({}, false, 404);
  });
  try {
    const r = await getEdgarFirmographics({ cik: "320193" });
    assert.equal(r.ok, true);
    assert.equal(r.data.industry, "Electronic Computers");
    assert.match(r.data.hqGeo, /Cupertino/);
    assert.equal(r.data.ownership, "public");
  } finally {
    restoreFetch();
  }
});

// --- OpenCorporates ---

test("searchOpenCorporates maps registry results", async () => {
  mockFetch((url) => {
    if (url.includes("opencorporates")) {
      return jsonRes({ results: { companies: [{ company: { name: "Acme Ltd", jurisdiction_code: "gb", company_number: "123", registered_address_in_full: "London, UK" } }] } });
    }
    return jsonRes({}, false, 404);
  });
  try {
    const r = await searchOpenCorporates({ query: "acme" });
    assert.equal(r.ok, true);
    assert.equal(r.data[0].name, "Acme Ltd");
    assert.equal(r.data[0].firmographics.jurisdiction, "gb");
    assert.equal(r.data[0].firmographics.ownership, "private");
  } finally {
    restoreFetch();
  }
});

test("searchOpenCorporates degrades on rate limit", async () => {
  mockFetch(() => jsonRes({}, false, 429));
  try {
    const r = await searchOpenCorporates({ query: "acme" });
    assert.equal(r.ok, false);
    assert.match(r.reason, /rate limit/i);
  } finally {
    restoreFetch();
  }
});

// --- Composed sourcing ---

test("sourceAccountPreviews falls back to mock when providers return nothing", async () => {
  mockFetch(() => jsonRes({}, false, 500));
  await withEnv("GOOGLE_PLACES_API_KEY", undefined, async () => {
    const { results, usedFallback } = await sourceAccountPreviews({ query: "" });
    assert.equal(usedFallback, true);
    assert.ok(results.length >= 1);
    assert.equal(typeof results[0].fitScore, "number");
  });
  restoreFetch();
});

test("sourceAccountPreviews returns live EDGAR results (no fallback) + scores them", async () => {
  mockFetch((url) => {
    if (url.includes("company_tickers.json")) return jsonRes({ "0": { cik_str: 320193, ticker: "AAPL", title: "APPLE INC" } });
    if (url.includes("opencorporates")) return jsonRes({ results: { companies: [] } });
    return jsonRes({}, false, 404);
  });
  await withEnv("GOOGLE_PLACES_API_KEY", undefined, async () => {
    const { results, usedFallback, sources } = await sourceAccountPreviews({ query: "apple" });
    assert.equal(usedFallback, false);
    assert.ok(results.some((r) => r.name.toLowerCase().includes("apple")));
    assert.equal(typeof results[0].fitScore, "number");
    assert.ok(sources.some((s) => s.provider === "sec_edgar" && s.ok));
  });
  restoreFetch();
});

// --- Contact enrichment ---

test("enrichAccountContacts builds committee from Apollo + Hunter (email backfill)", async () => {
  mockFetch((url) => {
    if (url.includes("apollo.io")) return jsonRes({ people: [{ name: "Jane Roe", title: "VP Marketing", email: "", has_email: true, organization: { name: "Acme" } }] });
    if (url.includes("hunter.io")) return jsonRes({ data: { emails: [{ first_name: "Jane", last_name: "Roe", value: "jane@acme.com", position: "VP Marketing", confidence: 95 }] } });
    return jsonRes({}, false, 404);
  });
  await withEnv("APOLLO_API_KEY", "a", () =>
    withEnv("HUNTER_API_KEY", "h", async () => {
      const { buyingCommittee } = await enrichAccountContacts({ account: { domain: "acme.com", buyingCommittee: [] } });
      const jane = buyingCommittee.find((c) => c.name === "Jane Roe");
      assert.ok(jane, "expected Jane Roe in committee");
      assert.equal(jane.email, "jane@acme.com");
      assert.equal(jane.emailStatus, "verified");
      assert.equal(jane.roleLabel, "economic_buyer");
      assert.equal(jane.isPrimary, true);
    })
  );
  restoreFetch();
});

test("enrichAccountContacts skips Apollo/Hunter without a domain", async () => {
  const acct = { domain: "", buyingCommittee: [{ name: "Existing", email: "e@x.com", emailStatus: "verified" }] };
  const { buyingCommittee, sources } = await enrichAccountContacts({ account: acct });
  assert.equal(buyingCommittee.length, 1);
  assert.ok(sources.some((s) => s.provider === "apollo" && !s.ok));
});
