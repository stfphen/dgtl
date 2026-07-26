import { createSkippedProviderResult, hasProviderKey } from "./types.js";

const REVIEWS_ENV_NAMES = ["REVIEWS_API_KEY", "YELP_API_KEY", "BING_PLACES_API_KEY"];

export async function enrichReviews({ lead } = {}) {
  void lead;

  if (!hasProviderKey(REVIEWS_ENV_NAMES)) {
    return createSkippedProviderResult("Provider not configured");
  }

  return createSkippedProviderResult("Reviews provider interface not implemented");
}
