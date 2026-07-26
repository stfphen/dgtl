// Sequential lead-enrichment AI workflow.
//
// The enrichment building blocks (website scrape, context/signal providers,
// deterministic sales brief, optional LLM brief) already exist independently.
// This module ties them into ONE ordered, resumable pipeline with explicit
// per-step status, so callers (the enrich route, the batch job, future
// schedulers) all run the same stages in the same order and can observe or
// resume each step.
//
// Order of stages:
//   1. resume-check  — skip work when enrichment is already fresh (resumability)
//   2. gather        — website scrape, plus optional context/signal providers
//   3. brief         — deterministic sales brief + optional LLM brief, merged
//
// No secrets are read here; provider modules own their own key handling and
// degrade to a "not configured" path when a key is absent.

import { isLeadEnrichmentStale } from "./batch.js";
import { enrichLeadContext } from "./index.js";
import { buildLeadEnrichmentNotice, buildLeadEnrichmentUpdateWithOptionalLlm } from "./lead.js";
import { enrichWebsite } from "./website.js";

export const ENRICHMENT_WORKFLOW_STAGES = ["resume-check", "gather", "brief"];

function nowIso() {
  return new Date().toISOString();
}

function getLeadWebsiteUrl(lead) {
  return lead?.websiteUrl || lead?.url || "";
}

/**
 * Run the full enrichment workflow for a single lead.
 *
 * @param {object}  params
 * @param {object}  params.lead              The lead to enrich.
 * @param {object} [params.options]          Stage controls.
 * @param {boolean}[params.options.includeContext] Run context/signal providers
 *                                           (reviews/news/jobs/techStack) in
 *                                           addition to the website scrape.
 * @param {boolean}[params.options.skipIfFresh]    Resume mode: skip the lead
 *                                           entirely when its enrichment is
 *                                           still fresh. Defaults to false so
 *                                           on-demand enrichment always runs.
 * @param {number} [params.options.staleAfterMs]   Freshness window for skipIfFresh.
 * @param {string} [params.scannedAt]        ISO timestamp to stamp the run with.
 * @param {number} [params.nowMs]            Clock override (testing).
 * @returns {Promise<{ok:boolean, skipped:boolean, steps:Array, update:object|null,
 *                     enrichmentResult:object|null, enrichmentStatus:string, notice:string}>}
 */
export async function runLeadEnrichmentWorkflow({ lead, options = {}, scannedAt = nowIso(), nowMs = Date.now() } = {}) {
  const steps = [];
  const record = (step, status, detail) => {
    steps.push({ step, status, detail });
  };

  if (!lead) {
    record("resume-check", "failed", "No lead provided.");
    return { ok: false, skipped: false, steps, update: null, enrichmentResult: null, enrichmentStatus: "failed", notice: "No lead provided." };
  }

  // Stage 1 — resume-check.
  if (options.skipIfFresh && !isLeadEnrichmentStale(lead, { staleAfterMs: options.staleAfterMs, nowMs })) {
    record("resume-check", "skipped", "Enrichment is fresh; resuming without re-running.");
    return {
      ok: true,
      skipped: true,
      steps,
      update: null,
      enrichmentResult: null,
      enrichmentStatus: lead?.metadata?.enrichment?.status || "complete",
      notice: `Enrichment already current for ${lead.business || lead.name || lead.id || "lead"}.`
    };
  }
  record("resume-check", "ok", options.skipIfFresh ? "Lead is stale or never enriched." : "Forced run.");

  const websiteUrl = getLeadWebsiteUrl(lead);
  if (!websiteUrl) {
    record("gather", "failed", "Lead website is missing.");
    return { ok: false, skipped: false, steps, update: null, enrichmentResult: null, enrichmentStatus: "failed", notice: "Lead website is missing." };
  }

  // Stage 2 — gather website (+ optional context/signal providers).
  let enrichmentResult;
  if (options.includeContext) {
    enrichmentResult = await enrichLeadContext({ lead, options });
    record("gather", enrichmentResult.ok ? "ok" : "failed", enrichmentResult.ok ? "Website + context providers gathered." : enrichmentResult.reason || "Gather failed.");
  } else {
    enrichmentResult = await enrichWebsite({ url: websiteUrl, business: lead.business || "" });
    record("gather", enrichmentResult.ok ? "ok" : "failed", enrichmentResult.ok ? "Website scraped." : enrichmentResult.reason || "Website scrape failed.");
  }

  // Stage 3 — brief synthesis (deterministic + optional LLM), merged into the lead.
  const update = await buildLeadEnrichmentUpdateWithOptionalLlm(lead, enrichmentResult, scannedAt);
  record("brief", "ok", `Sales brief built (enrichment ${update.enrichmentStatus}).`);

  return {
    ok: update.enrichmentStatus !== "failed",
    skipped: false,
    steps,
    update,
    enrichmentResult,
    enrichmentStatus: update.enrichmentStatus,
    notice: buildLeadEnrichmentNotice(lead, enrichmentResult, update.enrichmentStatus)
  };
}
