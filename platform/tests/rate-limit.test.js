import assert from "node:assert/strict";
import test from "node:test";
import { consumeRateLimit, clientIpFromRequest, __resetRateLimitForTests } from "../lib/rateLimit.js";

test("consumeRateLimit allows up to the limit then blocks within the window", () => {
  __resetRateLimitForTests();
  const now = 1000;
  const opts = { limit: 3, windowMs: 60000, now };

  assert.equal(consumeRateLimit("k", opts).allowed, true);
  assert.equal(consumeRateLimit("k", opts).allowed, true);
  assert.equal(consumeRateLimit("k", opts).allowed, true);
  const blocked = consumeRateLimit("k", opts);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("consumeRateLimit resets after the window elapses", () => {
  __resetRateLimitForTests();
  assert.equal(consumeRateLimit("k", { limit: 1, windowMs: 1000, now: 0 }).allowed, true);
  assert.equal(consumeRateLimit("k", { limit: 1, windowMs: 1000, now: 500 }).allowed, false);
  assert.equal(consumeRateLimit("k", { limit: 1, windowMs: 1000, now: 1500 }).allowed, true);
});

test("separate keys are throttled independently", () => {
  __resetRateLimitForTests();
  const opts = { limit: 1, windowMs: 1000, now: 0 };
  assert.equal(consumeRateLimit("a", opts).allowed, true);
  assert.equal(consumeRateLimit("b", opts).allowed, true);
  assert.equal(consumeRateLimit("a", opts).allowed, false);
});

test("clientIpFromRequest reads the first x-forwarded-for entry", () => {
  const request = { headers: { get: (h) => (h === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : null) } };
  assert.equal(clientIpFromRequest(request), "203.0.113.9");
});
