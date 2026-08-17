// Maps the many status vocabularies rendered across Core — operation states,
// message queue states, link sync states, connector health, severities — onto
// the brand's four functional tones.
//
// Why this exists: every value used to render as a gold pill, so a dead-letter
// message and a healthy connector looked identical, and gold (the brand accent,
// reserved for the primary action) was being spent as a status colour.
//
// Values with no state meaning — pipeline stages, entity kinds, activity types
// — deliberately fall through to "neutral" rather than being forced into a
// colour. Unknown strings do too: these come from the database, so the default
// must be safe rather than clever.

const TONES = {
  success: [
    "succeeded", "success", "executed", "completed", "complete", "done", "sent",
    "delivered", "approved", "active", "healthy", "linked", "verified", "won",
    "resolved", "passed", "ready", "connected", "opened", "replied", "booked"
  ],
  warning: [
    "overdue", "due today", "pending", "stale", "degraded", "unverified",
    "outcome_unknown", "quarantined", "awaiting_review", "needs_review",
    "warning", "paused", "throttled", "retrying", "unconfigured", "partial"
  ],
  error: [
    "failed", "failure", "error", "broken", "missing", "rejected", "expired",
    "validation_failed", "dead_letter", "bounced", "unreachable", "cancelled",
    "canceled", "lost", "disqualified", "suppressed", "opted_out", "unavailable",
    "invalid", "conflict", "blocked"
  ],
  info: [
    "draft", "proposed", "queued", "claimed", "running", "in_progress",
    "scheduled", "new", "not_queued", "idle", "waiting", "open", "review",
    "unclaimed", "disabled"
  ]
};

const LOOKUP = new Map();
for (const [tone, values] of Object.entries(TONES)) {
  for (const value of values) LOOKUP.set(value, tone);
}

export function statusTone(value) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return LOOKUP.get(key) || LOOKUP.get(key.replace(/_/g, " ")) || "neutral";
}
