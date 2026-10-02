import assert from "node:assert/strict";
import test from "node:test";
import {
  addMonths,
  computeValidityWindow,
  describeValidity,
  lastValidLocalDate,
  parseLocalDate,
  zonedTimeToUtc
} from "../lib/passes/validity.js";

const TZ = "America/Toronto";
const iso = (date) => date?.toISOString() ?? null;
const HOUR = 3_600_000;

test("day pass: local midnight to midnight in the tenant's zone", () => {
  const w = computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-10-03", timeZone: TZ });
  assert.equal(iso(w.validFrom), "2026-10-03T04:00:00.000Z"); // EDT, UTC-4
  assert.equal(iso(w.validUntil), "2026-10-04T04:00:00.000Z");
});

test("day pass with a 4am business-day cutoff covers the late night", () => {
  const w = computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-10-03", timeZone: TZ, dayCutoffHour: 4 });
  assert.equal(iso(w.validFrom), "2026-10-03T08:00:00.000Z");
  assert.equal(iso(w.validUntil), "2026-10-04T08:00:00.000Z");
  const d = describeValidity(w, { timeZone: TZ, dayCutoffHour: 4 });
  assert.match(d.fromDate, /Oct 3, 2026/);
  assert.match(d.until, /^Until Sun, Oct 4, 2026, 4:00/);
});

test("multi-day passes count calendar days", () => {
  const w = computeValidityWindow({ rule: { kind: "day", count: 3 }, startDate: "2026-12-30", timeZone: TZ });
  assert.equal(iso(w.validUntil), "2027-01-02T05:00:00.000Z");
});

test("DST fall-back day is 25 hours long; spring-forward day is 23", () => {
  const fall = computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-11-01", timeZone: TZ });
  assert.equal(fall.validUntil - fall.validFrom, 25 * HOUR);
  const spring = computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-03-08", timeZone: TZ });
  assert.equal(spring.validUntil - spring.validFrom, 23 * HOUR);
});

test("zonedTimeToUtc: ambiguous hour takes the earlier instant, skipped hour shifts forward", () => {
  assert.equal(iso(zonedTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, TZ)), "2026-11-01T05:30:00.000Z");
  assert.equal(iso(zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, TZ)), "2026-03-08T07:30:00.000Z");
  assert.equal(iso(zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 0 }, "UTC")), "2026-07-01T00:00:00.000Z");
  assert.equal(iso(zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 9 }, "Australia/Sydney")), "2026-01-14T22:00:00.000Z");
});

test("a cutoff that lands in the spring-forward gap still yields a valid window", () => {
  const w = computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-03-08", timeZone: TZ, dayCutoffHour: 2 });
  assert.equal(iso(w.validFrom), "2026-03-08T07:00:00.000Z"); // 02:00 does not exist -> 03:00 EDT
  assert.equal(iso(w.validUntil), "2026-03-09T06:00:00.000Z");
});

test("monthly clamps to the end of shorter months", () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1, day: 31 }, 1), { year: 2026, month: 2, day: 28 });
  assert.deepEqual(addMonths({ year: 2028, month: 1, day: 31 }, 1), { year: 2028, month: 2, day: 29 });
  assert.deepEqual(addMonths({ year: 2026, month: 11, day: 30 }, 3), { year: 2027, month: 2, day: 28 });
  const w = computeValidityWindow({ rule: { kind: "month" }, startDate: "2026-09-30", timeZone: TZ });
  assert.equal(iso(w.validUntil), "2026-10-30T04:00:00.000Z");
  const d = describeValidity(w, { timeZone: TZ });
  assert.equal(d.until, "Through Thu, Oct 29, 2026");
  assert.deepEqual(lastValidLocalDate(w.validUntil, TZ), { year: 2026, month: 10, day: 29 });
});

test("yearly from a leap day lands on Feb 28", () => {
  const w = computeValidityWindow({ rule: { kind: "year" }, startDate: "2028-02-29", timeZone: TZ });
  assert.equal(iso(w.validUntil), "2029-02-28T05:00:00.000Z");
});

test("lifetime has no end; describe says so", () => {
  const w = computeValidityWindow({ rule: { kind: "lifetime" }, startDate: "2026-09-30", timeZone: TZ });
  assert.equal(w.validUntil, null);
  const d = describeValidity(w, { timeZone: TZ });
  assert.equal(d.lifetime, true);
  assert.equal(d.untilShort, "Never");
});

test("fixed windows are taken as given but must be ordered", () => {
  const w = computeValidityWindow({
    rule: { kind: "fixed" },
    validFrom: "2026-10-31T23:00:00Z",
    validUntil: "2026-11-01T07:00:00Z",
    timeZone: TZ
  });
  assert.equal(w.validUntil - w.validFrom, 8 * HOUR);
  assert.throws(
    () => computeValidityWindow({ rule: { kind: "fixed" }, validFrom: "2026-11-01T07:00:00Z", validUntil: "2026-11-01T07:00:00Z", timeZone: TZ }),
    /after validFrom/
  );
});

test("bad input fails loudly instead of issuing a wrong pass", () => {
  assert.throws(() => parseLocalDate("2026-02-30"), /not a real calendar date/);
  assert.throws(() => parseLocalDate("30/09/2026"), /YYYY-MM-DD/);
  assert.throws(() => computeValidityWindow({ rule: { kind: "week" }, startDate: "2026-09-30", timeZone: TZ }), /Unknown validity kind/);
  assert.throws(() => computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-09-30", timeZone: "Mars/Olympus" }), /Unknown IANA timezone/);
  assert.throws(() => computeValidityWindow({ rule: { kind: "day", count: 0 }, startDate: "2026-09-30", timeZone: TZ }), /1 to 120/);
  assert.throws(() => computeValidityWindow({ rule: { kind: "day" }, startDate: "2026-09-30", timeZone: TZ, dayCutoffHour: 13 }), /0 to 12/);
});
