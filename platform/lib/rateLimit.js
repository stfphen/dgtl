// Minimal in-process fixed-window rate limiter.
//
// Scope: single-instance protection against brute-force / credential-stuffing on
// the login endpoint (H1). State lives in module memory, so it does NOT span
// multiple app instances — a distributed deployment should move this to a shared
// store (Redis). It is a meaningful first line of defense for the current
// single-container VPS target and adds no dependency.

const buckets = new Map();

function pruneExpired(now) {
  // Opportunistic cleanup so the Map can't grow unbounded from one-off IPs.
  if (buckets.size < 5000) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

/**
 * consumeRateLimit(key, { limit, windowMs, now })
 * Returns { allowed, remaining, retryAfterSeconds }. Each call counts as one hit
 * against the key's current window.
 */
export function consumeRateLimit(key, { limit = 10, windowMs = 60000, now = Date.now() } = {}) {
  const id = String(key || "unknown");
  pruneExpired(now);

  let entry = buckets.get(id);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(id, entry);
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000)
  };
}

// Best-effort client IP from proxy headers (Traefik/nginx set x-forwarded-for).
export function clientIpFromRequest(request) {
  const headers = request?.headers;
  const xff = headers?.get?.("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers?.get?.("x-real-ip") || "unknown";
}

// Test-only: clear all buckets.
export function __resetRateLimitForTests() {
  buckets.clear();
}
