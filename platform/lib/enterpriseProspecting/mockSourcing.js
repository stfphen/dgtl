// Mock account & contact sourcing so the MVP demo runs fully offline (no API
// keys, no external calls). When real adapters (OpenCorporates, SEC EDGAR,
// Apollo/Hunter) are wired in later, they should return this same shape behind
// the providerResponse graceful-degradation contract; routes fall back to these
// mocks when no provider is configured.
//
// Company names here are FICTIONAL placeholders for demo data only.

const MOCK_ACCOUNTS = [
  {
    name: "NorthPeak Logistics",
    domain: "northpeaklogistics.com",
    segment: "enterprise",
    sourceType: "open_db",
    firmographics: { industry: "Logistics & Supply Chain", headcountBand: "1,000–5,000", revenueBand: "$500M–$1B", hqGeo: "Toronto, Canada", ownership: "private" },
    signals: [
      { type: "funding", fact: "Closed a $120M growth round in Q2", source: "press release", whyItMatters: "Fresh budget + mandate to raise brand profile", confidence: "high" },
      { type: "hiring", fact: "3 open senior marketing roles incl. Head of Brand", source: "careers page", whyItMatters: "Active investment in marketing capability", confidence: "medium" }
    ],
    buyingCommittee: [
      { roleLabel: "economic_buyer", name: "Dana Whitfield", title: "VP Marketing", isPrimary: false, email: "dana.whitfield@northpeaklogistics.com", emailStatus: "pattern_unverified", source: "pattern", confidence: "medium" },
      { roleLabel: "champion", name: "Marcus Lee", title: "Head of Growth", isPrimary: true, email: "marcus.lee@northpeaklogistics.com", emailStatus: "verified", source: "provider", confidence: "high" }
    ]
  },
  {
    name: "Halcyon Health",
    domain: "halcyonhealth.io",
    segment: "enterprise",
    sourceType: "open_db",
    firmographics: { industry: "Healthtech", headcountBand: "1,000–5,000", revenueBand: "$250M–$500M", hqGeo: "Boston, USA", ownership: "public" },
    signals: [
      { type: "leadership", fact: "Named a new Chief Marketing Officer last month", source: "SEC 8-K / news", whyItMatters: "New CMO = new agency mandate window", confidence: "high" },
      { type: "launch", fact: "Launching a consumer telehealth app this fall", source: "company blog", whyItMatters: "Needs a consumer brand campaign", confidence: "high" },
      { type: "seo_gap", fact: "Thin organic presence vs. two main competitors", source: "SEO audit", whyItMatters: "Content+creative engine opportunity", confidence: "medium" }
    ],
    buyingCommittee: [
      { roleLabel: "economic_buyer", name: "Priya Raman", title: "Chief Marketing Officer", isPrimary: true, email: "priya.raman@halcyonhealth.io", emailStatus: "pattern_unverified", source: "pattern", confidence: "medium" },
      { roleLabel: "champion", name: "Tom Becker", title: "Director, Brand", isPrimary: false, email: "", emailStatus: "unknown", source: "", confidence: "low" }
    ]
  },
  {
    name: "Verge Financial",
    domain: "vergefinancial.com",
    segment: "enterprise",
    sourceType: "open_db",
    firmographics: { industry: "Financial Services", headcountBand: "5,000+", revenueBand: "$1B+", hqGeo: "New York, USA", ownership: "public" },
    signals: [
      { type: "rebrand", fact: "Quietly updated logo but messaging is inconsistent", source: "website", whyItMatters: "Half-finished rebrand = relaunch opportunity", confidence: "medium" }
    ],
    buyingCommittee: [
      { roleLabel: "economic_buyer", name: "Helen Ortiz", title: "SVP Brand & Communications", isPrimary: true, email: "helen.ortiz@vergefinancial.com", emailStatus: "pattern_unverified", source: "pattern", confidence: "medium" }
    ]
  },
  {
    name: "Cedar & Bloom",
    domain: "cedarandbloom.com",
    segment: "mid-market",
    sourceType: "open_db",
    firmographics: { industry: "CPG / Home", headcountBand: "200–1,000", revenueBand: "$80M–$150M", hqGeo: "Vancouver, Canada", ownership: "private" },
    signals: [
      { type: "expansion", fact: "Expanding from DTC into US retail this year", source: "news", whyItMatters: "Needs awareness in a new market", confidence: "high" },
      { type: "award", fact: "Won a national design award", source: "press", whyItMatters: "Proof to amplify into pipeline", confidence: "medium" }
    ],
    buyingCommittee: [
      { roleLabel: "champion", name: "Sofia Marchetti", title: "Head of Marketing", isPrimary: true, email: "sofia@cedarandbloom.com", emailStatus: "verified", source: "provider", confidence: "high" },
      { roleLabel: "influencer", name: "Reuben Clarke", title: "Creative Director", isPrimary: false, email: "reuben@cedarandbloom.com", emailStatus: "pattern_unverified", source: "pattern", confidence: "medium" }
    ]
  },
  {
    name: "Latitude SaaS",
    domain: "latitudesaas.com",
    segment: "mid-market",
    sourceType: "open_db",
    firmographics: { industry: "B2B SaaS", headcountBand: "200–1,000", revenueBand: "$50M–$100M", hqGeo: "Austin, USA", ownership: "private" },
    signals: [
      { type: "funding", fact: "Series C announced two months ago", source: "press", whyItMatters: "Budget + growth pressure", confidence: "high" },
      { type: "hiring", fact: "Hiring a Demand Gen Lead and a Brand Manager", source: "careers", whyItMatters: "Marketing build-out underway", confidence: "high" }
    ],
    buyingCommittee: [
      { roleLabel: "economic_buyer", name: "Aisha Bello", title: "VP Marketing", isPrimary: true, email: "aisha.bello@latitudesaas.com", emailStatus: "verified", source: "provider", confidence: "high" },
      { roleLabel: "blocker", name: "", title: "Procurement", isPrimary: false, email: "", emailStatus: "unknown", source: "", confidence: "low" }
    ]
  },
  {
    name: "Meridian Hospitality Group",
    domain: "meridianhospitality.com",
    segment: "mid-market",
    sourceType: "open_db",
    firmographics: { industry: "Hospitality", headcountBand: "500–1,000", revenueBand: "$120M–$200M", hqGeo: "Miami, USA", ownership: "private" },
    signals: [
      { type: "launch", fact: "Opening a new flagship property next quarter", source: "news", whyItMatters: "Launch campaign needed", confidence: "high" }
    ],
    buyingCommittee: [
      { roleLabel: "economic_buyer", name: "Grace Sullivan", title: "Director of Marketing", isPrimary: true, email: "gsullivan@meridianhospitality.com", emailStatus: "pattern_unverified", source: "pattern", confidence: "medium" }
    ]
  }
];

function matchesQuery(account, query) {
  if (!query) return true;
  const q = String(query).toLowerCase();
  const hay = [account.name, account.domain, account.firmographics?.industry, account.firmographics?.hqGeo]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * mockAccountSearch({ query, segment, limit }) -> array of account preview objects.
 * Deterministic; safe to call with no arguments.
 */
export function mockAccountSearch({ query = "", segment = "", limit = 25 } = {}) {
  return MOCK_ACCOUNTS.filter((a) => (!segment || a.segment === segment) && matchesQuery(a, query))
    .slice(0, limit)
    .map((a) => ({ ...a }));
}

/**
 * mockResearchDossier(account) -> simulated researchLead-style dossier used when
 * the AI backend is not configured. Echoes the account's known committee/signals
 * and flags realistic data gaps so the demo shows the verification step.
 */
export function mockResearchDossier(account = {}) {
  const committee = Array.isArray(account.buyingCommittee) ? account.buyingCommittee : [];
  const signals = Array.isArray(account.signals) ? account.signals : [];
  const dataGaps = [];
  if (!committee.some((c) => c.emailStatus === "verified")) dataGaps.push("No verified email yet — verify before outreach.");
  if (committee.some((c) => !c.name)) dataGaps.push("Some committee roles unnamed (e.g. procurement).");
  if (signals.length < 2) dataGaps.push("Only one timing signal — gather more before scoping.");

  return {
    source: "mock",
    businessProfile: {
      summary: `${account.name} — ${account.firmographics?.industry || "company"} in ${account.firmographics?.hqGeo || "unknown geo"}.`,
      confidence: "medium"
    },
    buyingCommittee: committee,
    signals,
    dataGaps,
    compliance: { publicDataOnly: true, notes: "Mock/demo dossier; no scraping. Replace with researchLead when AI is configured." },
    generatedAt: new Date().toISOString()
  };
}

export const __mockAccountsForTests = MOCK_ACCOUNTS;
