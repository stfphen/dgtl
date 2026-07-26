export const defaultApolloRoles = [
  "owner",
  "founder",
  "marketing",
  "manager",
  "general manager",
  "director",
  "operations",
  "business development"
];

export function buildProspectingQuery({ query, category, city }) {
  const direct = String(query || "").trim();
  if (direct) return direct;
  return [category, city].filter(Boolean).join(" in ");
}

export function selectedPreviewResults(batch, selectedIndexes = []) {
  const selected = new Set(selectedIndexes.map((index) => Number(index)));
  return (batch.previewResults || []).filter((_, index) => selected.has(index));
}

export function mergeBatchCounts(previous = {}, updates = {}) {
  return {
    found: Number(previous.found || 0),
    imported: Number(previous.imported || 0),
    skippedDuplicates: Number(previous.skippedDuplicates || 0),
    enriched: Number(previous.enriched || 0),
    failed: Number(previous.failed || 0),
    ...updates
  };
}
