// DGTL Pass — per-tenant settings, read from the tenant config's `passes` block.
//
// The full tenant editor section is build-plan task P2.2. Until it lands, a
// tenant without a `passes` block gets these defaults, so DGTL (the default
// brand) works out of the box and nothing is hardcoded to one client.

import { resolveBrandKit } from "./brandKit.js";
import { assertTimeZone, zonedParts, zonedTimeToUtc } from "./validity.js";

export const DEFAULT_PASS_SETTINGS = Object.freeze({
  timeZone: "America/Toronto",
  // A night that runs past midnight still counts as the day it started on.
  dayCutoffHour: 4,
  gates: ["Main door"]
});

export function passSettingsForTenant(tenant = {}) {
  const block = tenant?.passes || {};
  const timeZone = String(block.timeZone || process.env.PASSES_DEFAULT_TIMEZONE || DEFAULT_PASS_SETTINGS.timeZone);
  assertTimeZone(timeZone);
  const cutoff = Number(block.dayCutoffHour ?? DEFAULT_PASS_SETTINGS.dayCutoffHour);
  const dayCutoffHour = Number.isInteger(cutoff) && cutoff >= 0 && cutoff <= 8 ? cutoff : DEFAULT_PASS_SETTINGS.dayCutoffHour;
  const gates = Array.isArray(block.gates)
    ? block.gates.map((gate) => String(gate).trim()).filter(Boolean).slice(0, 20)
    : [];
  return {
    timeZone,
    dayCutoffHour,
    gates: gates.length ? gates : [...DEFAULT_PASS_SETTINGS.gates],
    brandKit: resolveBrandKit(tenant || {})
  };
}

// Start of the tenant's business day containing `now`: with a 4 am cutoff,
// 02:00 Saturday still belongs to Friday, so "today" began 04:00 Friday.
export function businessDayStart(now, { timeZone, dayCutoffHour = 0 }) {
  const shifted = zonedParts(new Date(new Date(now).getTime() - dayCutoffHour * 3600_000), timeZone);
  return zonedTimeToUtc({ year: shifted.year, month: shifted.month, day: shifted.day, hour: dayCutoffHour }, timeZone);
}

// The business date (YYYY-MM-DD) a pass issued now starts on.
export function businessDate(now, { timeZone, dayCutoffHour = 0 }) {
  const p = zonedParts(new Date(new Date(now).getTime() - dayCutoffHour * 3600_000), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
