import { providerFailure, providerSuccess } from "./providerResponse.js";

// SEC EDGAR — free, no API key. Public-company discovery + firmographics.
// SEC requires a descriptive User-Agent with contact info, or it returns 403.
// Override via SEC_EDGAR_USER_AGENT.

function edgarUserAgent() {
  return process.env.SEC_EDGAR_USER_AGENT || "DGTL Content Checkout Funnel admin@dgtlmag.com";
}

function pad10(cik) {
  return String(cik || "").replace(/\D/g, "").padStart(10, "0");
}

/**
 * searchSecEdgar({ query, limit }) -> providerResponse with data: account previews
 * Discovery only (name + ticker + CIK + ownership=public). Firmographics are
 * filled later by getEdgarFirmographics() at the research step (keeps search cheap).
 */
export async function searchSecEdgar({ query = "", limit = 15 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) {
    // EDGAR discovery needs a term; empty query is not an error, just no results.
    return providerSuccess("sec_edgar", [], { query, count: 0, note: "Provide a search term." });
  }
  try {
    const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": edgarUserAgent(), Accept: "application/json" }
    });
    if (!response.ok) {
      return providerFailure("sec_edgar", `SEC EDGAR returned ${response.status}.`, { status: response.status });
    }
    const data = await response.json();
    const rows = Array.isArray(data) ? data : Object.values(data || {});
    const matches = rows
      .filter((r) => String(r.title || "").toLowerCase().includes(q))
      .slice(0, Math.max(1, Number(limit) || 15))
      .map((r) => ({
        name: titleCase(r.title),
        domain: "",
        segment: "enterprise", // public filers skew large; refine after firmographics
        sourceType: "open_db",
        firmographics: { ownership: "public", ticker: r.ticker || "", cik: pad10(r.cik_str) },
        signals: [],
        buyingCommittee: []
      }));
    return providerSuccess("sec_edgar", matches, { query, count: matches.length });
  } catch (error) {
    return providerFailure("sec_edgar", `SEC EDGAR request failed: ${error.message}`, { query });
  }
}

/**
 * getEdgarFirmographics({ cik }) -> providerResponse with data: { industry, hqGeo, name }
 * Uses the submissions API; safe to call only for accounts that have a CIK.
 */
export async function getEdgarFirmographics({ cik } = {}) {
  const padded = pad10(cik);
  if (!padded || padded === "0000000000") {
    return providerFailure("sec_edgar", "A CIK is required for EDGAR firmographics.", { cik });
  }
  try {
    const response = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
      headers: { "User-Agent": edgarUserAgent(), Accept: "application/json" }
    });
    if (!response.ok) {
      return providerFailure("sec_edgar", `SEC EDGAR returned ${response.status}.`, { status: response.status, cik: padded });
    }
    const data = await response.json();
    const biz = data.addresses?.business || {};
    const hqGeo = [biz.city, biz.stateOrCountryDescription || biz.stateOrCountry].filter(Boolean).join(", ");
    return providerSuccess("sec_edgar", {
      name: data.name || "",
      industry: data.sicDescription || "",
      hqGeo,
      ownership: "public",
      ticker: (data.tickers || [])[0] || ""
    }, { cik: padded });
  } catch (error) {
    return providerFailure("sec_edgar", `SEC EDGAR request failed: ${error.message}`, { cik: padded });
  }
}

function titleCase(s) {
  const str = String(s || "");
  // Company filer names are ALL CAPS in EDGAR; make them readable but keep short acronyms.
  return str
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Inc|Llc|Ltd|Corp|Co|Plc|Lp|Sa|Nv|Ag)\b/g, (m) => m.toUpperCase());
}
