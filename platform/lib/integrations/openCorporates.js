import { providerFailure, providerSuccess } from "./providerResponse.js";

// OpenCorporates — open company registry (210M+ entities). The API works without
// a token at a limited/anonymous rate; a token (OPENCORPORATES_API_TOKEN) raises
// limits and unlocks more fields. We attempt anonymously when no token is set,
// and degrade gracefully on rate-limit/failure.

/**
 * searchOpenCorporates({ query, limit }) -> providerResponse with data: account previews
 */
export async function searchOpenCorporates({ query = "", limit = 10 } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    return providerSuccess("opencorporates", [], { query, count: 0, note: "Provide a search term." });
  }

  const url = new URL("https://api.opencorporates.com/v0.4/companies/search");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(Math.min(Math.max(1, Number(limit) || 10), 30)));
  const token = process.env.OPENCORPORATES_API_TOKEN;
  if (token) url.searchParams.set("api_token", token);

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      // 401/403 = token needed for this query; 429 = rate limited.
      return providerFailure(
        "opencorporates",
        response.status === 429
          ? "OpenCorporates rate limit hit (set OPENCORPORATES_API_TOKEN to raise limits)."
          : `OpenCorporates returned ${response.status}.`,
        { status: response.status }
      );
    }
    const data = await response.json();
    const companies = data.results?.companies || [];
    const accounts = companies.slice(0, Number(limit) || 10).map(({ company }) => ({
      name: company?.name || "",
      domain: "",
      segment: "",
      sourceType: "open_db",
      firmographics: {
        ownership: "private",
        jurisdiction: company?.jurisdiction_code || "",
        companyNumber: company?.company_number || "",
        hqGeo: company?.registered_address_in_full || "",
        incorporationDate: company?.incorporation_date || ""
      },
      signals: [],
      buyingCommittee: []
    }));
    return providerSuccess("opencorporates", accounts, { query, count: accounts.length, tokenUsed: Boolean(token) });
  } catch (error) {
    return providerFailure("opencorporates", `OpenCorporates request failed: ${error.message}`, { query });
  }
}
