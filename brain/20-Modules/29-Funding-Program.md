---
title: 29 · Funding Program Engine
type: module
tags: [module, funding]
status: stable
updated: 2026-06-27
source: docs/FUNDED_GROWTH_ENGINE.md, docs/funding-program*.md
---

# Funding Program Engine

## Purpose
A white-label B2B **funding-readiness** funnel that helps (Canadian) businesses turn growth goals
into "fundable projects" — **without claiming eligibility or approval.** The largest and newest
subsystem (`lib/funding/`, 17 files). Built-in tenant: **`funded-growth`** (DGTL Funded Growth Studio),
served on `funding.dgtlmag.com` / `grants.dgtlmag.com`.

> Core message: *"Do not start with a grant application. Start with a fundable project."*

## ⚖️ Compliance boundary (non-negotiable)
- Matching is **category-based and human-reviewed**, never an eligibility decision.
- ✅ Use: "may qualify", "likely lane", "readiness signals", "potential pathway".
- 🚫 Avoid: "you qualify", "guaranteed funding", "approved grant", "free government money", implied government affiliation.
- Does NOT scrape grant sites, import RFPs, send autonomous recommendations, or submit applications.

## Offer ladder
Free **Funding Fit Scan** → **Fundable Project Blueprint** → **Application Support** → **Funded Growth Execution** → **Monthly Opportunity Intelligence**.

## The 8 funding lanes
`digital_adoption`, `ecommerce_growth`, `export_marketing`, `creative_tech`, `clean_tech`,
`workforce_training`, `public_procurement`, `market_expansion`.

## MVP flow
visitor → Funding Fit Scan (survey) → lead stored with `sourceType: funding_scan` (answers in `metadata.fundingScan`) → admin reviews in Funding Scan Leads panel (fit score / lane / next step / gaps) → optional draft follow-up → route to Blueprint / Application Support / Execution / Opportunity Intelligence.

## Key files (`lib/funding/`)
| File | Role |
|---|---|
| `index.js` | Barrel re-export. |
| `constants.js` | `FUNDING_LANES` (8), `FUNDING_LANE_LABELS`, `FUNDING_RECOMMENDED_OFFERS`. |
| `scoring.js` | Deterministic `scoreFundingFit(input)` → `overallFit` (0-100), `laneScores`, `bestFundingLane`, `recommendedOffer`, `eligibilityGaps`, `reasoning`. |
| `matching.js` | Category triage `matchFundingPrograms(fundingScan, programs)` → top/weak/disqualified + `requiresHumanReview: true`. |
| `programs.js` | `manualFundingProgramCategories` (broad manual categories). |
| `programDatabase.js` (42KB, largest) | **15 real named Canadian programs** (canexport-smes, ontario-dmap, irap, canada-digital-adoption-program, ontario-creates IDM IP fund, CMF programs, …). `PROGRAM_STATUSES`, `manualFundingPrograms`, `matchFundingProgramsForInput`, `findFundingProgram`, `listFundingProgramsForTenant`, `validateManualFundingPrograms`. |
| `surveyQuestions.js` | `FUNDING_SURVEY_QUESTIONS` schema w/ dynamic branching; `getVisibleQuestions`, `getSurveyQuestionIds`. |
| `surveyNormalize.js` | `normalizeSurveyAnswers`, `midpointForRevenue/Budget`. |
| `surveyScoring.js` | `scoreSurvey`, `estimateFundingRange`, `checkRequirements`, `surveyConfidence`. |
| `surveyResults.js` | `buildSurveyResult`/`buildTeaserResult`/`buildSurveyPatch`, `SURVEY_DISCLAIMER`. |
| `admin.js` | `isFundingScanLead`, `fundingScanFromLead`, `scoreFundingLead`, `matchFundingProgramsForLead`, `buildFundingOpportunityDashboard`, `buildFundingOpportunityOutreachAngle`, `buildFundingProposalChecklist`. |
| `review.js` | Human-review checklist: `FUNDING_REVIEW_ITEMS`, `buildReviewState`, `isReviewComplete`, `buildReviewPatch`. |
| `handoff.js` | `buildCloserHandoff(lead)` — setter→closer summary. |
| `ingestion.js` | **Future-ingestion safe placeholders** only: `normalizeFundingOpportunity`, `dedupeFundingOpportunities`, `validateFundingOpportunity`. No fetch/scrape/cron/DB. Dedupe by canonical source URL → source ID → funder/title/deadline. |
| `normalizeLocation.js` | `parseJurisdiction`, `canonicalCountry`, `canonicalProvince`. |
| `tenant.js` | `fundedGrowthTenant` config. |

## UI & API
- Components: `FundingSurveyWidget.jsx` (multi-step, driven by `FUNDING_SURVEY_QUESTIONS`/`getVisibleQuestions`) + `FundingProgressBar`, `FundingQuestionStep`, `FundingResultCard`, `FundingTrustNotice`. The `.module.css` is the **mobile-first reference pattern** ([[16-Design-System]]).
- Public API: `POST /api/funding/survey` (teaser w/o email; full result + funding-scan lead w/ email; re-scores server-side). ⚠️ SSRF vector via website field ([[24-Enrichment]], C2).
- Admin API: `POST /api/admin/funding/review` (completion gated on required items; reviewer + timestamp persisted on lead metadata).
- Admin **Funding tab:** opportunity dashboard, per-lead program matches, funding-scan lead cards, human review checklist (pinned to top of lead card on mobile), closer handoff.

## Outreach integration
Funding outreach sequence (intro / fit-summary / book-a-call) in `lib/outreachSequence.js` with funding
merge fields. 8 outreach angles by vertical exist in the positioning doc. See [[26-Outreach]].

## Demo seed
`npm run seed:funding-demo` — idempotent funded-growth leads across all match states.

## ⚠️ Do not start yet
**Automated live funding-source ingestion** — matching is intentionally manual/human-reviewed; needs a
data-quality plan first. `ingestion.js` is the future boundary. [[34-Do-Not-Start-Yet]]

## Related
[[26-Outreach]] · [[22-Lead-Pipeline]] · [[63-Tenants-Catalog]] · [[33-Sprint-2-Productization]] · [[16-Design-System]]

Up: [[20-Modules-MOC]]
