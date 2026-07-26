// Pure aggregation over Call records for the admin Calls tab. Mirrors the shape
// of buildOutreachMetrics in lib/outreachSequence.js. No I/O — given the calls
// array it returns summary counts. Safe to import on server or client.

import { callOutcomes } from "./constants.js";

const CONNECTED_OUTCOMES = new Set(["connected_interested", "booked_call", "callback_requested"]);

export function buildCallMetrics(calls = []) {
  const list = Array.isArray(calls) ? calls : [];

  const byOutcome = Object.fromEntries(callOutcomes.map((outcome) => [outcome, 0]));
  let inbound = 0;
  let outbound = 0;
  let completed = 0;
  let missed = 0;
  let connected = 0;
  let booked = 0;
  let totalTalkTimeSeconds = 0;

  for (const call of list) {
    if (call.direction === "inbound") inbound += 1;
    else if (call.direction === "outbound") outbound += 1;

    if (call.status === "completed") completed += 1;
    if (call.status === "missed") missed += 1;

    if (call.outcome && byOutcome[call.outcome] !== undefined) byOutcome[call.outcome] += 1;
    if (CONNECTED_OUTCOMES.has(call.outcome)) connected += 1;
    if (call.outcome === "booked_call") booked += 1;

    const seconds = Number(call.durationSeconds);
    if (Number.isFinite(seconds) && seconds > 0) totalTalkTimeSeconds += seconds;
  }

  return {
    total: list.length,
    inbound,
    outbound,
    completed,
    missed,
    connected,
    booked,
    totalTalkTimeSeconds,
    byOutcome
  };
}

// "1h 04m" / "4m 12s" / "0s" — human-readable talk time.
export function formatTalkTime(totalSeconds = 0) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  if (mins) return `${mins}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}
