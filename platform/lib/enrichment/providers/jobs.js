import { createSkippedProviderResult, hasProviderKey } from "./types.js";

const JOBS_ENV_NAMES = ["JOBS_API_KEY"];

export async function enrichJobs({ lead } = {}) {
  void lead;

  if (!hasProviderKey(JOBS_ENV_NAMES)) {
    return createSkippedProviderResult("Provider not configured");
  }

  return createSkippedProviderResult("Jobs provider interface not implemented");
}
