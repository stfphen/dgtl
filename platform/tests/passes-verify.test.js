import assert from "node:assert/strict";
import test from "node:test";
import { admissionPatch, decideScan, effectiveStatus, scanResponse } from "../lib/passes/verify.js";

const NOW = new Date("2026-10-03T20:00:00Z");
const TEAM = "team_venue";

function pass(overrides = {}) {
  return {
    id: "pass_1",
    teamId: TEAM,
    status: "active",
    validFrom: "2026-10-03T04:00:00Z",
    validUntil: "2026-10-04T04:00:00Z",
    maxUses: null,
    useCount: 0,
    reentryCooldownSeconds: 0,
    lastUsedAt: null,
    lastUsedGate: null,
    firstUsedAt: null,
    ...overrides
  };
}

const decide = (p, now = NOW, scannerTeamId = TEAM) => decideScan({ pass: p, now, scannerTeamId });

test("an active pass inside its window is admitted", () => {
  const d = decide(pass());
  assert.equal(d.result, "valid");
  assert.equal(d.admit, true);
  assert.equal(d.tone, "admit");
});

test("no match is not_found", () => {
  assert.equal(decide(null).result, "not_found");
});

test("another team's pass is indistinguishable from a miss, but the reason is kept", () => {
  const d = decide(pass({ teamId: "team_other" }));
  assert.equal(d.result, "not_found");
  assert.equal(d.admit, false);
  assert.equal(d.internalReason, "foreign_team");
  assert.equal(decideScan({ pass: pass(), now: NOW, scannerTeamId: null }).result, "not_found");
});

test("revoked and suspended are refused, even inside the window", () => {
  assert.equal(decide(pass({ status: "revoked" })).result, "revoked");
  assert.equal(decide(pass({ status: "suspended" })).result, "suspended");
  assert.equal(decide(pass({ status: "revoked", validUntil: "2026-01-01T00:00:00Z" })).result, "revoked", "revoked outranks expired");
});

test("unknown stored statuses fail closed", () => {
  const d = decide(pass({ status: "used" }));
  assert.equal(d.admit, false);
  assert.equal(d.internalReason, "unknown_status");
});

test("the window is half-open: valid at validFrom, expired at validUntil", () => {
  assert.equal(decide(pass(), new Date("2026-10-03T03:59:59Z")).result, "not_yet_valid");
  assert.equal(decide(pass(), new Date("2026-10-03T04:00:00Z")).result, "valid");
  assert.equal(decide(pass(), new Date("2026-10-04T03:59:59Z")).result, "valid");
  assert.equal(decide(pass(), new Date("2026-10-04T04:00:00Z")).result, "expired");
});

test("lifetime passes never expire", () => {
  assert.equal(decide(pass({ validUntil: null }), new Date("2099-01-01T00:00:00Z")).result, "valid");
});

test("single-use passes are refused once used", () => {
  assert.equal(decide(pass({ maxUses: 1, useCount: 0 })).result, "valid");
  const d = decide(pass({ maxUses: 1, useCount: 1, lastUsedAt: "2026-10-03T19:00:00Z", lastUsedGate: "Main door" }));
  assert.equal(d.result, "used");
  assert.equal(d.lastUsedGate, "Main door");
  assert.equal(decide(pass({ maxUses: 3, useCount: 2 })).result, "valid");
  assert.equal(decide(pass({ maxUses: 3, useCount: 3 })).result, "used");
});

test("re-entry cooldown blocks a pass being passed back through the door", () => {
  const p = pass({ reentryCooldownSeconds: 300, lastUsedAt: "2026-10-03T19:58:00Z", lastUsedGate: "Side door", useCount: 4 });
  const d = decide(p);
  assert.equal(d.result, "recently_used");
  assert.equal(d.tone, "warn");
  assert.equal(d.retryAfterSeconds, 180);
  assert.equal(decide(p, new Date("2026-10-03T20:03:00Z")).result, "valid");
  assert.equal(decide(pass({ reentryCooldownSeconds: 0, lastUsedAt: "2026-10-03T19:59:59Z" })).result, "valid");
});

test("effectiveStatus derives the lifecycle for dashboards and Wallet", () => {
  assert.equal(effectiveStatus(pass(), NOW), "active");
  assert.equal(effectiveStatus(pass(), new Date("2026-10-02T00:00:00Z")), "scheduled");
  assert.equal(effectiveStatus(pass(), new Date("2026-10-05T00:00:00Z")), "expired");
  assert.equal(effectiveStatus(pass({ maxUses: 1, useCount: 1 }), NOW), "used");
  assert.equal(effectiveStatus(pass({ status: "revoked" }), NOW), "revoked");
  assert.equal(effectiveStatus(pass({ status: "suspended" }), NOW), "suspended");
});

test("admissionPatch increments uses and keeps the first-use timestamp", () => {
  const first = admissionPatch(pass(), { now: NOW, gate: "Main door" });
  assert.equal(first.useCount, 1);
  assert.equal(first.firstUsedAt.toISOString(), NOW.toISOString());
  assert.equal(first.lastUsedGate, "Main door");
  const later = admissionPatch(pass({ useCount: 1, firstUsedAt: new Date("2026-10-03T18:00:00Z") }), { now: NOW });
  assert.equal(later.useCount, 2);
  assert.equal(later.firstUsedAt.toISOString(), "2026-10-03T18:00:00.000Z");
});

test("scanResponse exposes only what door staff need", () => {
  const holder = { name: "Alex Rivera", email: "alex@example.com", phone: "+14165550100" };
  const p = pass({ maxUses: 1, credentialHash: "abc", shortCode: "K7M2QX9P" });
  const res = scanResponse({
    scanId: "scan_1",
    decision: decide(p),
    pass: p,
    passType: { name: "VIP Lifetime", tier: "vip_lifetime", isVip: true },
    holder,
    validity: { until: "Never expires" }
  });
  assert.equal(res.holderName, "Alex Rivera");
  assert.equal(res.vip, true);
  assert.equal(res.useCount, 1, "reflects the admission just granted");
  const serialized = JSON.stringify(res);
  for (const secret of ["alex@example.com", "+14165550100", "abc", "K7M2QX9P"]) {
    assert.ok(!serialized.includes(secret), `response must not include ${secret}`);
  }
  const miss = scanResponse({ scanId: "scan_2", decision: decide(pass({ teamId: "x" })), pass: pass({ teamId: "x" }), holder });
  assert.deepEqual(Object.keys(miss).sort(), ["admit", "result", "scanId", "title", "tone"]);
  assert.ok(!JSON.stringify(miss).includes("internalReason"));
});
