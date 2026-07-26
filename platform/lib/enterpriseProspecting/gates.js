// Gate state machine for the account-based prospecting motion.
// Pure functions only (no I/O) so they are trivially unit-testable.
//
// The three HUMAN approval gates wrap this machine:
//   Gate 1 = sourced        -> gate1_approved   (approve account + tier)
//   Gate 2 = scoped         -> gate2_approved   (verify contacts + approve campaign)
//   Gate 3 = (existing outreach send approval, lives in lib/outreachSequence.js)
//
// Nothing here ever sends or auto-advances; routes call advanceGate explicitly
// after a human action.

export const GATE_SOURCED = "sourced";
export const GATE1_APPROVED = "gate1_approved";
export const GATE_RESEARCHED = "researched";
export const GATE_SCOPED = "scoped";
export const GATE2_APPROVED = "gate2_approved";
export const GATE_IN_OUTREACH = "in_outreach";
export const GATE_DEPRIORITIZED = "deprioritized";

// Ordered forward path (deprioritized is a side state, not in the order).
export const GATE_ORDER = [
  GATE_SOURCED,
  GATE1_APPROVED,
  GATE_RESEARCHED,
  GATE_SCOPED,
  GATE2_APPROVED,
  GATE_IN_OUTREACH
];

export const ACCOUNT_GATES = [...GATE_ORDER, GATE_DEPRIORITIZED];

// Allowed transitions. Any state can be deprioritized; a deprioritized account
// can be revived back to sourced.
export const GATE_TRANSITIONS = {
  [GATE_SOURCED]: [GATE1_APPROVED, GATE_DEPRIORITIZED],
  [GATE1_APPROVED]: [GATE_RESEARCHED, GATE_DEPRIORITIZED],
  [GATE_RESEARCHED]: [GATE_SCOPED, GATE_DEPRIORITIZED],
  [GATE_SCOPED]: [GATE2_APPROVED, GATE_RESEARCHED, GATE_DEPRIORITIZED],
  [GATE2_APPROVED]: [GATE_IN_OUTREACH, GATE_DEPRIORITIZED],
  [GATE_IN_OUTREACH]: [GATE_DEPRIORITIZED],
  [GATE_DEPRIORITIZED]: [GATE_SOURCED]
};

export function isValidGate(status) {
  return ACCOUNT_GATES.includes(status);
}

export function canAdvanceGate(from, to) {
  if (!isValidGate(from) || !isValidGate(to)) return false;
  return (GATE_TRANSITIONS[from] || []).includes(to);
}

// The primary "forward" next state on the happy path (null if terminal).
export function nextGate(from) {
  const idx = GATE_ORDER.indexOf(from);
  if (idx === -1 || idx === GATE_ORDER.length - 1) return null;
  return GATE_ORDER[idx + 1];
}

// True if `status` is at or beyond `target` on the forward path.
export function isGateAtOrAfter(status, target) {
  const a = GATE_ORDER.indexOf(status);
  const b = GATE_ORDER.indexOf(target);
  if (a === -1 || b === -1) return false;
  return a >= b;
}

// Throwing guard for routes. Returns the `to` state on success.
export function assertGateTransition(from, to) {
  if (!canAdvanceGate(from, to)) {
    const error = new Error(`Invalid gate transition: ${from} -> ${to}.`);
    error.code = "INVALID_GATE_TRANSITION";
    error.status = 409;
    throw error;
  }
  return to;
}

// Whether contacts from this account may be promoted into the outreach pipeline.
// Hard rule: only after Gate 2 (or already in outreach).
export function canFeedOutreach(status) {
  return status === GATE2_APPROVED || status === GATE_IN_OUTREACH;
}

// Human-readable label for the UI.
export function gateLabel(status) {
  return (
    {
      [GATE_SOURCED]: "Sourced",
      [GATE1_APPROVED]: "Gate 1 approved",
      [GATE_RESEARCHED]: "Researched",
      [GATE_SCOPED]: "Campaign scoped",
      [GATE2_APPROVED]: "Gate 2 approved",
      [GATE_IN_OUTREACH]: "In outreach",
      [GATE_DEPRIORITIZED]: "Deprioritized"
    }[status] || status
  );
}
