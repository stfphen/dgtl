import { createSkippedProviderResult, hasProviderKey } from "./types.js";

const TECH_STACK_ENV_NAMES = ["TECH_STACK_API_KEY", "BUILTWITH_API_KEY"];

export async function enrichTechStack({ lead } = {}) {
  void lead;

  if (!hasProviderKey(TECH_STACK_ENV_NAMES)) {
    return createSkippedProviderResult("Provider not configured");
  }

  return createSkippedProviderResult("Tech stack provider interface not implemented");
}
