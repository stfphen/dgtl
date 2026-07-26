/**
 * Vertical presets — per-industry conversion data layered on top of design
 * directions: section order tuned to how that vertical's buyers decide,
 * section-variant preferences, copy frames and a proof pattern for the
 * generator prompt, an imagery brief for asset tooling, and a ranked list of
 * direction pairings for the builder UI.
 *
 * Pure data + pure functions, zero imports (same discipline as
 * sectionVariants.js — designDirections.js imports this module).
 *
 * Contract rules:
 * - There is NO default preset. getVerticalPreset(unknown) returns null and
 *   null contributes nothing downstream — absence is the backwards-compat
 *   anchor, exactly like premium-agency's empty vars.
 * - Every preset defines the complete VERTICAL_PRESET_KEYS shape (closed set,
 *   tested) and nothing else.
 * - sectionOrder must already be a legal permutation (hero first, checkout
 *   after packages); the resolver never has to repair authored data.
 * - directionAffinity ids must exist in designDirections.js; index 0 is the
 *   builder UI's recommended pairing, never a constraint.
 * - Research provenance for this data lives in docs/design-research/.
 */

export const VERTICAL_PRESET_KEYS = [
  "id",
  "label",
  "blurb",
  "sectionOrder",
  "sectionVariantPrefs",
  "copyFrames",
  "proofPattern",
  "imageryBrief",
  "directionAffinity"
];

const VERTICAL_PRESETS = [
  {
    id: "agency-creative",
    label: "Agency & Creative Services",
    blurb: "Work-first: the portfolio sells before a single claim is made.",
    sectionOrder: [
      "hero",
      "portfolio",
      "output",
      "system",
      "process",
      "references",
      "problem",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    sectionVariantPrefs: {
      references: "case-strip"
    },
    copyFrames: {
      hero: "Lead with the caliber of the work, not the service category. Name the craft and the outcome in one confident line; the portfolio directly below carries the proof.",
      problem: "Frame the cost of forgettable creative: lost pitches, brand drift, campaigns nobody remembers. Speak to a buyer who has been burned by pretty-but-pointless work.",
      packages: "Package by engagement shape (project, retainer, sprint), not by deliverable count. Buyers here compare commitment levels, not feature lists.",
      faq: "Answer process anxieties: revisions, ownership of files, timelines, what happens after handoff."
    },
    proofPattern:
      "Named client outcomes over volume stats. One case with a concrete before/after result beats ten logos. Awards only when real and recognizable.",
    imageryBrief:
      "Actual work output: campaign stills, brand systems in situ, film frames. 16:9 hero, 4:3 case tiles. Photographic, art-directed, zero stock. Grade follows the direction: cinematic contrast for dark looks, flat daylight for editorial looks.",
    directionAffinity: ["premium-agency", "dark-cinematic", "bold-brutalist"]
  },
  {
    id: "professional-services-b2b",
    label: "Professional Services B2B",
    blurb: "Trust-first: credentials and named outcomes before any offer.",
    sectionOrder: [
      "hero",
      "references",
      "problem",
      "system",
      "process",
      "output",
      "portfolio",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    // No hero pref: the paired direction decides (editorial-minimal's
    // typographic statement hero is this vertical's research pattern B, and
    // serif display sizes don't survive a half-width split column).
    sectionVariantPrefs: {
      references: "logo-wall",
      packages: "comparison"
    },
    copyFrames: {
      hero: "State the specific business outcome and who it is for in plain, measured language. No hype words; a consultative buyer discounts everything that sounds like marketing.",
      problem: "Name the risk of inaction precisely: compliance exposure, missed funding windows, tax overpayment, stalled deals. Specificity is the credibility.",
      packages: "Frame engagements by scope and outcome with transparent pricing logic. This buyer comparison-shops; make the middle option the obvious fit.",
      faq: "Answer diligence questions: qualifications, confidentiality, engagement terms, what happens in the first 30 days."
    },
    proofPattern:
      "Institutional trust signals: client logos the buyer recognizes, engagement outcomes with real figures, named testimonials with full title and firm, credentials stated once without ornament.",
    imageryBrief:
      "Real people and real workplaces: advisors in conversation, document detail shots, office context. 3:2 hero, 1:1 team portraits. Photographic, natural light, no handshake stock. Restraint scales with the direction's formality.",
    directionAffinity: ["editorial-minimal", "premium-agency", "warm-boutique"]
  },
  {
    id: "saas-tech-ecommerce",
    label: "SaaS, Tech & Ecommerce",
    blurb: "Outcome-led: show the product working, quantify the result, price it clearly.",
    sectionOrder: [
      "hero",
      "output",
      "system",
      "references",
      "problem",
      "process",
      "portfolio",
      "packages",
      "fundedOpportunity",
      "fundingPromo",
      "checkout",
      "faq",
      "finalCta"
    ],
    sectionVariantPrefs: {
      hero: "split",
      references: "stat-band",
      packages: "comparison"
    },
    copyFrames: {
      hero: "One outcome-led headline under eight words, subtext that says what the product does in concrete nouns and verbs. The product visual carries the rest.",
      problem: "Quantify the pain being replaced: hours lost, tools stitched together, revenue leaking. Numbers from the brief only, never invented.",
      packages: "Tiered comparison with one recommended plan. Per-seat or per-month clarity, no asterisks; list what changes between tiers, not everything each tier has.",
      faq: "Answer adoption blockers: migration, integrations, security, cancellation, what the free path includes."
    },
    proofPattern:
      "Quantified adoption: a stat band of real usage figures, recognizable customer logos, one short customer quote tied to a metric. Never fake precision.",
    imageryBrief:
      "Product UI in honest frames: real screenshots or generated product-true renders, one abstract system visual maximum. 16:10 hero shots, 16:9 feature supports. Illustrative accents allowed for dark directions; no purple-gradient meshes.",
    directionAffinity: ["premium-agency", "dark-cinematic", "editorial-minimal"]
  },
  {
    id: "local-trades-retail",
    label: "Local, Trades & Retail",
    blurb: "Proof-first and fast to the offer: reviews, license, one clear next step.",
    sectionOrder: [
      "hero",
      "problem",
      "process",
      "portfolio",
      "references",
      "packages",
      "checkout",
      "system",
      "output",
      "fundedOpportunity",
      "fundingPromo",
      "faq",
      "finalCta"
    ],
    sectionVariantPrefs: {
      hero: "full-bleed",
      packages: "single-offer",
      references: "testimonial-editorial"
    },
    copyFrames: {
      hero: "Say what you do, where, and the immediate next step in one breath. Local buyers scan for service, area, and a way to book within three seconds.",
      problem: "Speak to the urgent, concrete situation: the leak, the deadline, the empty chair. Plain words a homeowner uses, zero industry vocabulary.",
      packages: "One clear flagship offer with a plain price or 'free quote' path. Local buyers do not comparison-shop tiers; they want the obvious choice and a fast booking.",
      faq: "Answer logistics: service area, response time, licensing and insurance, payment options, guarantees."
    },
    proofPattern:
      "Local credibility stack: review score with real count, licensed/bonded/insured stated plainly, years serving the area, before/after work photos, testimonials with neighborhood-level names.",
    imageryBrief:
      "Real crew, real premises, real results: on-site work, before/after pairs, storefront. 3:2 hero, 1:1 before/after tiles. Photographic only, honest lighting, no hardhat stock. Warm grade for boutique looks, straight documentary for the rest.",
    directionAffinity: ["warm-boutique", "premium-agency", "bold-brutalist"]
  }
];

const PRESETS_BY_ID = new Map(VERTICAL_PRESETS.map((preset) => [preset.id, preset]));

export function listVerticalPresets() {
  return VERTICAL_PRESETS;
}

export function getVerticalPreset(id) {
  return PRESETS_BY_ID.get(String(id || "")) || null;
}

export function isValidVerticalPresetId(id) {
  return PRESETS_BY_ID.has(String(id || ""));
}
