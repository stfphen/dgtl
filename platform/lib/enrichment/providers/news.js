import { createSkippedProviderResult, hasProviderKey } from "./types.js";

const NEWS_ENV_NAMES = ["NEWS_API_KEY", "BING_NEWS_API_KEY"];

export async function enrichNews({ lead } = {}) {
  void lead;

  if (!hasProviderKey(NEWS_ENV_NAMES)) {
    return createSkippedProviderResult("Provider not configured");
  }

  return createSkippedProviderResult("News provider interface not implemented");
}
