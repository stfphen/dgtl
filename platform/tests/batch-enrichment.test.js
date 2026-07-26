import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BATCH_ENRICHMENT_LIMIT,
  buildBatchEnrichmentNotice,
  normalizeBatchEnrichmentLimit,
  selectLeadsForBatchEnrichment
} from "../lib/enrichment/batch.js";

function lead(id, overrides = {}) {
  return {
    id,
    status: "new",
    websiteUrl: "https://example.com",
    metadata: {},
    ...overrides
  };
}

test("selectLeadsForBatchEnrichment picks missing or stale enrichment leads", () => {
  const selection = selectLeadsForBatchEnrichment(
    [
      lead("recent-complete", {
        metadata: {
          enrichment: {
            status: "complete",
            lastEnrichedAt: "2026-06-10T00:00:00.000Z"
          }
        }
      }),
      lead("stale-complete", {
        metadata: {
          enrichment: {
            status: "complete",
            lastEnrichedAt: "2026-04-01T00:00:00.000Z"
          }
        }
      }),
      lead("failed-enrichment", {
        metadata: {
          enrichment: {
            status: "failed",
            lastEnrichedAt: "2026-06-12T00:00:00.000Z"
          }
        }
      }),
      lead("missing-enrichment"),
      lead("no-website", { websiteUrl: "" })
    ],
    {
      limit: 5,
      nowMs: new Date("2026-06-16T00:00:00.000Z").getTime()
    }
  );

  assert.deepEqual(selection.selected.map((item) => item.id), [
    "stale-complete",
    "failed-enrichment",
    "missing-enrichment"
  ]);
  assert.equal(selection.candidateCount, 4);
  assert.equal(selection.eligibleCount, 3);
  assert.equal(selection.skipped, 1);
});

test("selectLeadsForBatchEnrichment honors status filter and max limit", () => {
  const selection = selectLeadsForBatchEnrichment(
    [
      lead("one", { status: "new", metadata: { enrichment: { status: "failed" } } }),
      lead("two", { status: "new", metadata: { enrichment: { status: "failed" } } }),
      lead("three", { status: "researched", metadata: { enrichment: { status: "failed" } } }),
      lead("four", { status: "new", metadata: { enrichment: { status: "failed" } } }),
      lead("five", { status: "new", metadata: { enrichment: { status: "failed" } } }),
      lead("six", { status: "new", metadata: { enrichment: { status: "failed" } } })
    ],
    {
      status: "new",
      limit: 999
    }
  );

  assert.equal(selection.limit, MAX_BATCH_ENRICHMENT_LIMIT);
  assert.deepEqual(selection.selected.map((item) => item.id), [
    "one",
    "two",
    "four",
    "five",
    "six"
  ]);
  assert.equal(selection.skipped, 0);
});

test("selectLeadsForBatchEnrichment caps selected leads and reports overflow as skipped", () => {
  const selection = selectLeadsForBatchEnrichment(
    [
      lead("one"),
      lead("two"),
      lead("three"),
      lead("four"),
      lead("five"),
      lead("six")
    ],
    { limit: 3 }
  );

  assert.deepEqual(selection.selected.map((item) => item.id), ["one", "two", "three"]);
  assert.equal(selection.skipped, 3);
});

test("batch helpers normalize limit and format notice", () => {
  assert.equal(normalizeBatchEnrichmentLimit(""), 3);
  assert.equal(normalizeBatchEnrichmentLimit("0"), 1);
  assert.equal(normalizeBatchEnrichmentLimit("12"), 5);
  assert.equal(
    buildBatchEnrichmentNotice({ enriched: 2, skipped: 3, failed: 1 }),
    "Enriched 2 leads. Skipped 3. Failed 1."
  );
});
