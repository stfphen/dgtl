// Deterministic high-ticket campaign concept builder.
// Pure (no I/O). Produces a scoped creative concept from an account + its top
// signal. An optional AI pass can later replace/enhance this, but the MVP must
// generate a credible concept offline.

// Budget anchors by segment. Enterprise budgets respect ambition; anchor high.
const BUDGET_BANDS = {
  enterprise: { band: "$150k–$400k", floor: 150000, label: "enterprise" },
  "mid-market": { band: "$60k–$150k", floor: 60000, label: "mid-market" }
};

const SIGNAL_ANGLE = {
  funding: (a) => `You just raised — now make the market feel it. A launch campaign that turns ${a.name}'s momentum into category attention.`,
  leadership: (a) => `A new leader is a new mandate. A brand moment that lets ${a.name}'s incoming exec plant a flag.`,
  launch: (a) => `Your launch deserves more than a press release. A campaign that makes ${a.name}'s new offering impossible to ignore.`,
  hiring: (a) => `You're scaling the team — scale the story. An employer-brand + demand campaign matched to ${a.name}'s growth.`,
  rebrand: (a) => `Half a rebrand is a liability. A campaign that finishes the job and relaunches ${a.name} with conviction.`,
  seo_gap: (a) => `Your competitors own the search results you should. A content+creative engine that closes ${a.name}'s visibility gap.`,
  award: (a) => `Proof is your best creative. A campaign that turns ${a.name}'s recognition into pipeline.`,
  expansion: (a) => `New market, new audience, no awareness. A go-to-market campaign for ${a.name}'s expansion.`,
  other: (a) => `A bold, ownable brand campaign built specifically for ${a.name}.`
};

const DELIVERABLES_BY_SEGMENT = {
  enterprise: [
    "Brand platform + campaign idea (positioning, narrative, key art)",
    "Hero film + cutdowns for paid social and CTV",
    "Integrated paid media creative system (display, social, search)",
    "Landing experience + conversion funnel",
    "Measurement framework + quarterly creative refresh"
  ],
  "mid-market": [
    "Campaign idea + key visual system",
    "Hero video + social cutdowns",
    "Paid social + search creative pack",
    "Conversion landing page",
    "30-day performance readout"
  ]
};

function topSignal(account) {
  const signals = Array.isArray(account?.signals) ? account.signals : [];
  if (!signals.length) return null;
  // Prefer signals with a known angle, else the first.
  const known = signals.find((s) => SIGNAL_ANGLE[s.type]);
  return known || signals[0];
}

function campaignName(account, signal) {
  const base = String(account?.name || "Account").split(/\s+/)[0];
  const theme =
    {
      funding: "Momentum",
      leadership: "New Era",
      launch: "Launch Loud",
      hiring: "Built to Scale",
      rebrand: "Relaunch",
      seo_gap: "Outrank",
      award: "Proof",
      expansion: "New Ground"
    }[signal?.type] || "Signature";
  return `${base}: ${theme}`;
}

/**
 * buildCampaignConcept({ account, serviceFocus }) -> concept object matching the
 * account_campaigns shape (minus persistence fields).
 */
export function buildCampaignConcept({ account = {}, serviceFocus = "" } = {}) {
  const segment = BUDGET_BANDS[account.segment] ? account.segment : "mid-market";
  const budget = BUDGET_BANDS[segment];
  const signal = topSignal(account);
  const angleFn = SIGNAL_ANGLE[signal?.type] || SIGNAL_ANGLE.other;

  const focus = serviceFocus ? ` (${serviceFocus})` : "";
  const bigIdea = `${angleFn(account)}${focus}`;
  const primaryContact = (account.buyingCommittee || []).find((c) => c.isPrimary) || (account.buyingCommittee || [])[0];

  const opener = signal
    ? `Saw ${account.name}'s ${humanSignal(signal)} — we put together a campaign concept built specifically around it.`
    : `We built a campaign concept specifically for ${account.name} — would a 20-minute look be worth it?`;

  return {
    name: campaignName(account, signal),
    bigIdea,
    deliverables: DELIVERABLES_BY_SEGMENT[segment],
    budgetBand: budget.band,
    budgetRationale: `${cap(budget.label)} scope; anchored to a flagship creative program with media-ready assets and a measurement loop.`,
    successMetric: segment === "enterprise" ? "Brand lift + qualified pipeline influenced" : "Qualified pipeline + cost-per-qualified-lead",
    outreachOpener: opener,
    targetContactName: primaryContact?.name || "",
    basedOnSignal: signal ? signal.type : "none"
  };
}

function humanSignal(signal) {
  const map = {
    funding: "recent funding",
    leadership: "leadership change",
    launch: "product launch",
    hiring: "marketing hiring push",
    rebrand: "rebrand",
    seo_gap: "search-visibility gap",
    award: "recent recognition",
    expansion: "market expansion"
  };
  return map[signal.type] || (signal.fact ? String(signal.fact).slice(0, 60) : "recent move");
}

function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}
