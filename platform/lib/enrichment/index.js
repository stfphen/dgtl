import { enrichJobs } from "./providers/jobs.js";
import { enrichNews } from "./providers/news.js";
import { enrichReviews } from "./providers/reviews.js";
import { enrichTechStack } from "./providers/techStack.js";
import { enrichWebsite } from "./website.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeSignals(...signalGroups) {
  const merged = [];
  const seen = new Set();

  for (const signalGroup of signalGroups) {
    for (const signal of asArray(signalGroup)) {
      if (!signal || typeof signal !== "object") continue;

      const key = JSON.stringify(signal);
      if (seen.has(key)) continue;

      seen.add(key);
      merged.push(signal);
    }
  }

  return merged;
}

function getLeadWebsiteUrl(lead) {
  return lead?.websiteUrl || lead?.url || "";
}

function shouldRunProvider(options, key) {
  if (options?.[key] === false) return false;
  if (options?.providers?.[key] === false) return false;
  return true;
}

async function runProvider(key, runner, lead, options) {
  if (!shouldRunProvider(options, key)) {
    return {
      ok: false,
      skipped: true,
      reason: "Provider disabled",
      signals: []
    };
  }

  try {
    return await runner({ lead });
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error?.message || "Provider failed",
      signals: []
    };
  }
}

export async function enrichLeadContext({ lead, options = {} } = {}) {
  const websiteResult = await enrichWebsite({
    url: getLeadWebsiteUrl(lead),
    business: lead?.business || "",
    timeoutMs: options.timeoutMs,
    maxResponseBytes: options.maxResponseBytes,
    maxInternalPages: options.maxInternalPages
  });

  const providerResults = await Promise.all([
    runProvider("reviews", enrichReviews, lead, options),
    runProvider("news", enrichNews, lead, options),
    runProvider("jobs", enrichJobs, lead, options),
    runProvider("techStack", enrichTechStack, lead, options)
  ]);
  const [reviews, news, jobs, techStack] = providerResults;

  return {
    ok: websiteResult.ok,
    reason: websiteResult.reason,
    website: websiteResult.website,
    contacts: websiteResult.contacts,
    socialProfiles: websiteResult.socialProfiles,
    sources: websiteResult.sources,
    signals: mergeSignals(
      websiteResult.signals,
      reviews.signals,
      news.signals,
      jobs.signals,
      techStack.signals
    ),
    providers: {
      reviews,
      news,
      jobs,
      techStack
    },
    compliance: websiteResult.compliance
  };
}
