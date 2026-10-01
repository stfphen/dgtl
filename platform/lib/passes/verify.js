// DGTL Pass — the verification decision.
//
// decideScan() is a pure function: given the pass row (already locked FOR
// UPDATE by the caller), the database clock and the scanner's team, it returns
// the verdict. It has no I/O, so every rule can be unit-tested. The caller
// wraps it in one transaction (see docs/specs/dgtl-pass/05-verification.md):
//
//   BEGIN
//     SELECT … FROM pass_scans WHERE id = $scanId        -- idempotent replay
//     SELECT now()                                        -- one clock, the DB's
//     SELECT … FROM passes WHERE credential_hash = $h FOR UPDATE
//     decision = decideScan(...)
//     if decision.admit: UPDATE passes SET <admissionPatch(...)>
//     INSERT INTO pass_scans (...)
//   COMMIT
//
// Because the row is locked, two scanners that hit the same single-use pass at
// the same instant serialize. The second one sees use_count = 1 and gets USED.
//
// Stored pass.status is only active | suspended | revoked. "Expired", "used"
// and "scheduled" are derived from the window and the counters at read time.
// No cron job is needed to flip them, and nothing can drift out of sync.
//

export const SCAN_RESULTS = Object.freeze({
  VALID: "valid",
  RECENTLY_USED: "recently_used",
  USED: "used",
  EXPIRED: "expired",
  NOT_YET_VALID: "not_yet_valid",
  REVOKED: "revoked",
  SUSPENDED: "suspended",
  NOT_FOUND: "not_found",
  INVALID_FORMAT: "invalid_format"
});

// admit: open the door. tone drives the scanner's full-screen color.
export const RESULT_META = Object.freeze({
  valid: { admit: true, tone: "admit", title: "Valid pass" },
  recently_used: { admit: false, tone: "warn", title: "Already scanned" },
  used: { admit: false, tone: "deny", title: "Pass already used" },
  expired: { admit: false, tone: "deny", title: "Pass expired" },
  not_yet_valid: { admit: false, tone: "warn", title: "Not valid yet" },
  revoked: { admit: false, tone: "deny", title: "Pass revoked" },
  suspended: { admit: false, tone: "deny", title: "Pass on hold" },
  not_found: { admit: false, tone: "deny", title: "Not a valid pass" },
  invalid_format: { admit: false, tone: "deny", title: "Not a pass code" }
});

export const STORED_STATUSES = ["active", "suspended", "revoked"];

function toTime(value) {
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// Derived lifecycle state for dashboards, the holder pass page and Wallet.
export function effectiveStatus(pass, now) {
  const at = toTime(now);
  if (pass.status === "revoked") return "revoked";
  if (pass.status === "suspended") return "suspended";
  if (at < toTime(pass.validFrom)) return "scheduled";
  const until = toTime(pass.validUntil);
  if (until !== null && at >= until) return "expired";
  if (pass.maxUses != null && pass.useCount >= pass.maxUses) return "used";
  return "active";
}

function verdict(result, extra = {}) {
  return { result, ...RESULT_META[result], ...extra };
}

/**
 * pass:          the locked row (camelCase), or null when no hash matched.
 * now:           the transaction's now() — never the scanner device's clock.
 * scannerTeamId: team of the authenticated verifier session.
 */
export function decideScan({ pass, now, scannerTeamId }) {
  if (!pass) return verdict(SCAN_RESULTS.NOT_FOUND);

  // Another team's pass looks exactly like a miss to this verifier, so tenants
  // cannot probe each other's credentials. The ledger still records why.
  if (!scannerTeamId || pass.teamId !== scannerTeamId) {
    return verdict(SCAN_RESULTS.NOT_FOUND, { internalReason: "foreign_team" });
  }

  const at = toTime(now);
  if (pass.status === "revoked") return verdict(SCAN_RESULTS.REVOKED);
  if (pass.status === "suspended") return verdict(SCAN_RESULTS.SUSPENDED);
  if (!STORED_STATUSES.includes(pass.status)) {
    return verdict(SCAN_RESULTS.NOT_FOUND, { internalReason: "unknown_status" });
  }
  if (at < toTime(pass.validFrom)) return verdict(SCAN_RESULTS.NOT_YET_VALID);
  const until = toTime(pass.validUntil);
  if (until !== null && at >= until) return verdict(SCAN_RESULTS.EXPIRED);
  if (pass.maxUses != null && pass.useCount >= pass.maxUses) {
    return verdict(SCAN_RESULTS.USED, { lastUsedAt: pass.lastUsedAt, lastUsedGate: pass.lastUsedGate || null });
  }

  // Anti-passback for reusable passes: one pass cannot let two people in
  // back to back. Off by default (cooldown 0).
  const cooldownMs = Math.max(0, Number(pass.reentryCooldownSeconds) || 0) * 1000;
  const lastUsed = toTime(pass.lastUsedAt);
  if (cooldownMs > 0 && lastUsed !== null && at - lastUsed < cooldownMs) {
    return verdict(SCAN_RESULTS.RECENTLY_USED, {
      lastUsedAt: pass.lastUsedAt,
      lastUsedGate: pass.lastUsedGate || null,
      retryAfterSeconds: Math.ceil((cooldownMs - (at - lastUsed)) / 1000)
    });
  }

  return verdict(SCAN_RESULTS.VALID);
}

// Column updates for an admitted scan. Applied inside the same transaction.
export function admissionPatch(pass, { now, gate = null }) {
  const at = new Date(now);
  return {
    useCount: (pass.useCount || 0) + 1,
    firstUsedAt: pass.firstUsedAt || at,
    lastUsedAt: at,
    lastUsedGate: gate
  };
}

// What the scanner is allowed to see. Deliberately minimal: no email, no
// phone, no credential. The holder's name lets door staff match it to an ID.
export function scanResponse({ scanId, decision, pass = null, passType = null, holder = null, validity = null }) {
  const base = {
    scanId,
    result: decision.result,
    admit: decision.admit,
    tone: decision.tone,
    title: decision.title
  };
  if (!pass || decision.result === SCAN_RESULTS.NOT_FOUND) return base;
  return {
    ...base,
    holderName: holder?.name || "",
    passTypeName: passType?.name || "",
    tier: passType?.tier || "",
    vip: Boolean(passType?.isVip),
    validUntil: pass.validUntil ? new Date(pass.validUntil).toISOString() : null,
    validityLabel: validity?.until || null,
    useCount: decision.admit ? (pass.useCount || 0) + 1 : pass.useCount || 0,
    maxUses: pass.maxUses ?? null,
    lastUsedAt: decision.lastUsedAt ? new Date(decision.lastUsedAt).toISOString() : null,
    lastUsedGate: decision.lastUsedGate || null,
    retryAfterSeconds: decision.retryAfterSeconds ?? null
  };
}
