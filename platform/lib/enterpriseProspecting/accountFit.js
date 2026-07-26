// Deterministic ICP fit-scoring + tiering for target accounts.
// Pure functions (no I/O). An optional AI pass can refine these later, but the
// MVP must run fully offline, so scoring is rule-based and explainable.

export const SEGMENTS = ["enterprise", "mid-market"];

// Default ICP. Tenant/campaign-configurable later; never hardcode one client.
export const DEFAULT_ICP = {
  segments: ["enterprise", "mid-market"],
  geos: [],                          // empty = any geo accepted
  minSignals: 1,
  // Disqualifier flags we look for in firmographics.
  disqualifiers: ["agencyOfRecordLocked", "noMarketingLeadership", "recentBigAgencyWin"]
};

const TIER1_MIN = 80;
const TIER2_MIN = 60;
const TIER3_MIN = 40;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function geoMatches(account, icp) {
  if (!icp.geos || icp.geos.length === 0) return true;
  const hq = String(account?.firmographics?.hqGeo || "").toLowerCase();
  if (!hq) return false;
  return icp.geos.some((g) => hq.includes(String(g).toLowerCase()));
}

/**
 * scoreAccountFit(account, icp) -> { fitScore, tier, rationale, disqualified, reasons }
 * fitScore: 0..100. tier: 1|2|3|null (null = recommend deprioritize).
 */
export function scoreAccountFit(account = {}, icp = DEFAULT_ICP) {
  const reasons = [];
  let score = 0;

  const segment = String(account.segment || "").toLowerCase();
  const firmo = account.firmographics || {};
  const signals = Array.isArray(account.signals) ? account.signals : [];
  const committee = Array.isArray(account.buyingCommittee) ? account.buyingCommittee : [];

  // Disqualifiers first (hard ceiling).
  const hitDisqualifiers = (icp.disqualifiers || []).filter((flag) => firmo[flag] === true);
  const disqualified = hitDisqualifiers.length > 0;

  // Segment match (the core gate).
  if (icp.segments.includes(segment)) {
    score += 25;
    reasons.push(`In-ICP segment (${segment}).`);
  } else {
    reasons.push(`Segment "${segment || "unknown"}" not in ICP.`);
  }

  // Firmographic completeness / size proxy for budget.
  if (firmo.headcountBand) {
    score += 15;
    reasons.push(`Headcount band known (${firmo.headcountBand}).`);
  }
  if (firmo.revenueBand) {
    score += 10;
    reasons.push(`Revenue band known (${firmo.revenueBand}).`);
  }

  // Geo match.
  if (geoMatches(account, icp)) {
    score += 10;
    if (icp.geos && icp.geos.length) reasons.push("Geo matches ICP.");
  } else {
    reasons.push("Geo outside ICP.");
  }

  // Timing signals (the "why now"). 5 pts each, capped at 25.
  const signalPts = clamp(signals.length * 5, 0, 25);
  score += signalPts;
  if (signals.length) reasons.push(`${signals.length} timing signal(s) found.`);
  else reasons.push("No timing signals yet.");

  // Discoverable buying committee.
  if (committee.length >= 2) {
    score += 15;
    reasons.push(`Buying committee mapped (${committee.length} roles).`);
  } else if (committee.length === 1) {
    score += 8;
    reasons.push("Partial committee (1 contact).");
  }

  score = clamp(Math.round(score), 0, 100);

  // Disqualifiers cap the score below the Tier-3 floor.
  if (disqualified) {
    score = Math.min(score, TIER3_MIN - 1);
    reasons.push(`Disqualified: ${hitDisqualifiers.join(", ")}.`);
  }

  let tier = null;
  if (score >= TIER1_MIN) tier = 1;
  else if (score >= TIER2_MIN) tier = 2;
  else if (score >= TIER3_MIN) tier = 3;

  const rationale = buildRationale({ score, tier, segment, disqualified });

  return { fitScore: score, tier, rationale, disqualified, reasons };
}

function buildRationale({ score, tier, segment, disqualified }) {
  if (disqualified) return `Deprioritize: disqualifier present (score ${score}).`;
  if (tier === null) return `Below ICP threshold (score ${score}); deprioritize or enrich further.`;
  const label = tier === 1 ? "Tier 1 (1:1, marquee)" : tier === 2 ? "Tier 2 (1:few)" : "Tier 3 (1:many)";
  return `${label} — ${segment || "unknown"} account, fit score ${score}.`;
}

// Recommend the next gate after scoring.
export function recommendedGateAfterScore(fit) {
  if (!fit || fit.tier === null || fit.disqualified) return "deprioritize";
  return "gate1_account_approval";
}
