/**
 * @typedef {Object} EnrichmentSignal
 * @property {string} type
 * @property {string} provider
 * @property {string} [label]
 * @property {string} [value]
 * @property {string} [sourceUrl]
 */

/**
 * @typedef {Object} ProviderEnrichmentResult
 * @property {boolean} ok
 * @property {boolean} skipped
 * @property {string|null} reason
 * @property {EnrichmentSignal[]} signals
 */

export function createProviderResult({
  ok = false,
  skipped = false,
  reason = null,
  signals = []
} = {}) {
  return {
    ok: Boolean(ok),
    skipped: Boolean(skipped),
    reason: reason || null,
    signals: Array.isArray(signals) ? signals : []
  };
}

export function createSkippedProviderResult(reason = "Provider not configured") {
  return createProviderResult({
    ok: false,
    skipped: true,
    reason,
    signals: []
  });
}

export function hasProviderKey(envNames) {
  return envNames.some((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}
