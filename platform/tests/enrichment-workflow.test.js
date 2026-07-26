import assert from "node:assert/strict";
import test from "node:test";
import {
  ENRICHMENT_WORKFLOW_STAGES,
  runLeadEnrichmentWorkflow
} from "../lib/enrichment/workflow.js";

const STALE_MS = 1000 * 60 * 60 * 24 * 30;

test("declares the stages in order", () => {
  assert.deepEqual(ENRICHMENT_WORKFLOW_STAGES, ["resume-check", "gather", "brief"]);
});

test("runs gather then brief for a lead with a website", async () => {
  const lead = { id: "l1", business: "Acme", websiteUrl: "https://example.com", status: "new" };
  const result = await runLeadEnrichmentWorkflow({ lead });

  const stepNames = result.steps.map((s) => s.step);
  assert.deepEqual(stepNames, ["resume-check", "gather", "brief"]);
  assert.equal(result.skipped, false);
  assert.ok(result.update, "produces a lead update");
  assert.ok(["complete", "partial", "failed"].includes(result.enrichmentStatus));
  // The forced (default) run records resume-check as ok, not skipped.
  assert.equal(result.steps[0].status, "ok");
});

test("fails cleanly when the lead has no website", async () => {
  const result = await runLeadEnrichmentWorkflow({ lead: { id: "l2", business: "NoSite" } });
  assert.equal(result.ok, false);
  assert.equal(result.update, null);
  const gather = result.steps.find((s) => s.step === "gather");
  assert.equal(gather.status, "failed");
});

test("resumability: skipIfFresh skips a recently enriched lead", async () => {
  const nowMs = Date.UTC(2026, 5, 18);
  const lead = {
    id: "l3",
    business: "Fresh Co",
    websiteUrl: "https://example.com",
    metadata: {
      enrichment: { status: "complete", lastEnrichedAt: new Date(nowMs - 1000).toISOString() }
    }
  };
  const result = await runLeadEnrichmentWorkflow({
    lead,
    options: { skipIfFresh: true, staleAfterMs: STALE_MS },
    nowMs
  });

  assert.equal(result.skipped, true);
  assert.equal(result.update, null);
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].status, "skipped");
});

test("resumability: skipIfFresh still runs a stale lead", async () => {
  const nowMs = Date.UTC(2026, 5, 18);
  const lead = {
    id: "l4",
    business: "Stale Co",
    websiteUrl: "https://example.com",
    metadata: {
      enrichment: { status: "complete", lastEnrichedAt: new Date(nowMs - STALE_MS - 1000).toISOString() }
    }
  };
  const result = await runLeadEnrichmentWorkflow({
    lead,
    options: { skipIfFresh: true, staleAfterMs: STALE_MS },
    nowMs
  });

  assert.equal(result.skipped, false);
  assert.ok(result.steps.some((s) => s.step === "gather"));
});
