// DGTL Pass — validity windows.
//
// A pass is valid on the half-open interval [validFrom, validUntil). validUntil
// null means lifetime. The window is computed once, at issue time, from the
// pass type's validity rule and the tenant's timezone. It is then stored on the
// pass row, so a later edit to the pass type never silently changes a pass
// already in someone's Wallet.
//
// Business-day cutoff: a venue that closes at 4am sets dayCutoffHour = 4, so a
// "Saturday" day pass runs Sat 04:00 -> Sun 04:00 local. Somebody arriving at
// 1am Sunday is still on Saturday's pass. With cutoff 0 this is ordinary
// midnight-to-midnight.
//
// Calendar arithmetic is done on local dates, then converted to UTC. Month and
// year additions clamp to the end of the month: Jan 31 + 1 month = Feb 28/29,
// and Feb 29 + 1 year = Feb 28.
//
// Dependency-free (Intl only). Port target: platform/lib/passes/validity.js.

export const VALIDITY_KINDS = ["day", "month", "year", "lifetime", "fixed"];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value) {
  const match = DATE_RE.exec(String(value || ""));
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${value}".`);
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`"${value}" is not a real calendar date.`);
  }
  return { year, month, day };
}

export function formatLocalDate({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays({ year, month, day }, count) {
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addMonths({ year, month, day }, count) {
  const index = year * 12 + (month - 1) + count;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return { year: targetYear, month: targetMonth, day: Math.min(day, daysInMonth(targetYear, targetMonth)) };
}

const partsFormatterCache = new Map();

function partsFormatter(timeZone) {
  if (!partsFormatterCache.has(timeZone)) {
    partsFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    );
  }
  return partsFormatterCache.get(timeZone);
}

export function assertTimeZone(timeZone) {
  try {
    partsFormatter(timeZone);
  } catch {
    throw new Error(`Unknown IANA timezone "${timeZone}".`);
  }
  return timeZone;
}

// Wall-clock fields of an instant in a timezone.
export function zonedParts(instant, timeZone) {
  const parts = {};
  for (const { type, value } of partsFormatter(timeZone).formatToParts(instant)) parts[type] = value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function offsetMs(instant, timeZone) {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Local wall-clock time -> UTC instant, with Temporal's "compatible"
// disambiguation around DST transitions:
//   - ambiguous local time (fall back, the hour happens twice) -> the earlier instant;
//   - skipped local time (spring forward, the hour never happens) -> shifted
//     later by the length of the gap (02:30 in a 02:00->03:00 jump becomes 03:30).
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const DAY = 86_400_000;
  // The offsets a day either side bracket any single transition near `wall`.
  const offsetBefore = offsetMs(new Date(wall - DAY), timeZone);
  const offsetAfter = offsetMs(new Date(wall + DAY), timeZone);
  const matches = (instant) => {
    const p = zonedParts(new Date(instant), timeZone);
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute && p.second === second;
  };
  const valid = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => wall - offset)
    .filter(matches)
    .sort((a, b) => a - b);
  if (valid.length) return new Date(valid[0]);
  // In a gap: read the wall time with the pre-transition offset, which lands after the gap.
  return new Date(wall - offsetBefore);
}

function boundary(localDate, cutoffHour, timeZone) {
  return zonedTimeToUtc({ ...localDate, hour: cutoffHour }, timeZone);
}

/**
 * Compute a pass's stored validity window.
 *
 * rule:        { kind: "day"|"month"|"year"|"lifetime"|"fixed", count?: number }
 * startDate:   "YYYY-MM-DD" in the tenant's timezone (day/month/year/lifetime)
 * validFrom/validUntil: ISO strings, used only for kind "fixed"
 * timeZone:    IANA zone from tenant passes config, e.g. "America/Toronto"
 * dayCutoffHour: 0-12, from tenant passes config
 */
export function computeValidityWindow({ rule, startDate, validFrom, validUntil, timeZone, dayCutoffHour = 0 }) {
  assertTimeZone(timeZone);
  const kind = rule?.kind;
  if (!VALIDITY_KINDS.includes(kind)) throw new Error(`Unknown validity kind "${kind}".`);
  if (!Number.isInteger(dayCutoffHour) || dayCutoffHour < 0 || dayCutoffHour > 12) {
    throw new Error("dayCutoffHour must be an integer from 0 to 12.");
  }

  if (kind === "fixed") {
    const from = new Date(validFrom);
    const until = new Date(validUntil);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
      throw new Error("A fixed window needs valid validFrom and validUntil timestamps.");
    }
    if (until <= from) throw new Error("validUntil must be after validFrom.");
    return { validFrom: from, validUntil: until };
  }

  const count = rule.count ?? 1;
  if (kind !== "lifetime" && (!Number.isInteger(count) || count < 1 || count > 120)) {
    throw new Error("Validity count must be an integer from 1 to 120.");
  }

  const start = parseLocalDate(startDate);
  const from = boundary(start, dayCutoffHour, timeZone);
  if (kind === "lifetime") return { validFrom: from, validUntil: null };

  const end =
    kind === "day" ? addDays(start, count) : kind === "month" ? addMonths(start, count) : addMonths(start, count * 12);
  return { validFrom: from, validUntil: boundary(end, dayCutoffHour, timeZone) };
}

// The local calendar date the pass is last usable on (for "Valid through …").
// With a cutoff, the business day that ends at validUntil is the one before it.
export function lastValidLocalDate(validUntil, timeZone) {
  if (!validUntil) return null;
  const p = zonedParts(new Date(new Date(validUntil).getTime() - 1), timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

// Human-readable window for emails, the pass page, Wallet back fields and the scanner.
export function describeValidity({ validFrom, validUntil }, { timeZone, dayCutoffHour = 0, locale = "en-CA" } = {}) {
  const date = new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" });
  const from = new Date(validFrom);
  // The business date the window opens on (with a 4am cutoff, 04:00 Sat is "Sat").
  const fromDate = date.format(zonedTimeToUtc({ ...zonedParts(from, timeZone), hour: 12, minute: 0, second: 0 }, timeZone));
  if (!validUntil) {
    return { fromDate, from: date.format(from), until: "Never expires", untilShort: "Never", lifetime: true };
  }
  const until = new Date(validUntil);
  if (dayCutoffHour === 0) {
    const last = lastValidLocalDate(until, timeZone);
    const lastInstant = zonedTimeToUtc({ ...last, hour: 12 }, timeZone);
    return { fromDate, from: date.format(from), until: `Through ${date.format(lastInstant)}`, untilShort: date.format(lastInstant), lifetime: false };
  }
  return {
    fromDate,
    from: `${date.format(from)}, ${time.format(from)}`,
    until: `Until ${date.format(until)}, ${time.format(until)}`,
    untilShort: `${date.format(until)}, ${time.format(until)}`,
    lifetime: false
  };
}
