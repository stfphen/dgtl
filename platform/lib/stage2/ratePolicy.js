const POSITIVE_INTEGER = /^\d+$/;

export const DEFAULT_CORE_RATE_POLICY = Object.freeze({
  sendingAccountDailyLimit: 25,
  recipientDomainDailyLimit: 1,
  teamDailyLimit: 50,
  batchLimit: 10,
  workerConcurrency: 2,
  retryBackoffBaseMs: 60_000,
  retryBackoffMaxMs: 3_600_000
});

function positiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim();
  if (!POSITIVE_INTEGER.test(text) || Number(text) < 1) throw new Error(`${label} must be a positive integer.`);
  return Number(text);
}

export function loadCoreRatePolicy(env = process.env) {
  return Object.freeze({
    sendingAccountDailyLimit: positiveInteger(env.CORE_RATE_ACCOUNT_DAILY, DEFAULT_CORE_RATE_POLICY.sendingAccountDailyLimit, "CORE_RATE_ACCOUNT_DAILY"),
    recipientDomainDailyLimit: positiveInteger(env.CORE_RATE_DOMAIN_DAILY, DEFAULT_CORE_RATE_POLICY.recipientDomainDailyLimit, "CORE_RATE_DOMAIN_DAILY"),
    teamDailyLimit: positiveInteger(env.CORE_RATE_TEAM_DAILY, DEFAULT_CORE_RATE_POLICY.teamDailyLimit, "CORE_RATE_TEAM_DAILY"),
    batchLimit: positiveInteger(env.CORE_RATE_BATCH, DEFAULT_CORE_RATE_POLICY.batchLimit, "CORE_RATE_BATCH"),
    workerConcurrency: positiveInteger(env.CORE_WORKER_CONCURRENCY, DEFAULT_CORE_RATE_POLICY.workerConcurrency, "CORE_WORKER_CONCURRENCY"),
    retryBackoffBaseMs: positiveInteger(env.CORE_RETRY_BACKOFF_BASE_MS, DEFAULT_CORE_RATE_POLICY.retryBackoffBaseMs, "CORE_RETRY_BACKOFF_BASE_MS"),
    retryBackoffMaxMs: positiveInteger(env.CORE_RETRY_BACKOFF_MAX_MS, DEFAULT_CORE_RATE_POLICY.retryBackoffMaxMs, "CORE_RETRY_BACKOFF_MAX_MS")
  });
}

export function recipientDomain(email = "") {
  return String(email).trim().toLowerCase().split("@")[1] || "";
}

export function evaluateCoreRatePolicy({ message, sentMessages = [], cycleMessages = [], policy = DEFAULT_CORE_RATE_POLICY } = {}) {
  const sender = String(message?.approvedSenderEmail || message?.senderEmail || "").trim().toLowerCase();
  const domain = recipientDomain(message?.approvedRecipientEmail || message?.recipientEmail);
  const deduplicated = new Map();
  let anonymous = 0;
  for (const item of [...sentMessages, ...cycleMessages]) deduplicated.set(item.id || `anonymous:${anonymous++}`, item);
  const currentOrder = `${message?.createdAt || ""}|${message?.id || ""}`;
  const combined = [...deduplicated.values()].filter((item) => {
    if (item.id && item.id === message?.id) return false;
    if (item.queueState !== "sending") return true;
    return `${item.createdAt || ""}|${item.id || ""}` < currentOrder;
  });
  const teamCount = combined.length;
  const accountCount = sender ? combined.filter((item) => String(item.approvedSenderEmail || item.senderEmail || "").trim().toLowerCase() === sender).length : 0;
  const domainCount = domain ? combined.filter((item) => recipientDomain(item.approvedRecipientEmail || item.recipientEmail) === domain).length : 0;
  if (teamCount >= policy.teamDailyLimit) return { allowed: false, reason: "team_daily_limit" };
  if (sender && accountCount >= policy.sendingAccountDailyLimit) return { allowed: false, reason: "sending_account_daily_limit" };
  if (domain && domainCount >= policy.recipientDomainDailyLimit) return { allowed: false, reason: "recipient_domain_daily_limit" };
  return { allowed: true, reason: "within_policy" };
}

export function retryDelayMs(attemptNumber, policy = DEFAULT_CORE_RATE_POLICY) {
  const exponent = Math.max(0, Number(attemptNumber || 1) - 1);
  return Math.min(policy.retryBackoffMaxMs, policy.retryBackoffBaseMs * 2 ** exponent);
}
