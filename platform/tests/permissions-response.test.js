import assert from "node:assert/strict";
import test from "node:test";
import { PermissionError, permissionDeniedResponse } from "../lib/permissions.js";

function fakeRequest(headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { url: "https://app.test/api/x", headers: { get: (h) => lower[h.toLowerCase()] ?? null } };
}

test("401 from a fetch/XHR caller returns JSON, not an HTML-login redirect", () => {
  const res = permissionDeniedResponse(
    new PermissionError("Authentication required.", 401),
    fakeRequest({ "sec-fetch-dest": "empty", accept: "application/json" })
  );
  assert.equal(res.status, 401);
});

test("401 from a browser navigation still redirects to login", () => {
  const res = permissionDeniedResponse(
    new PermissionError("Authentication required.", 401),
    fakeRequest({ "sec-fetch-dest": "document", accept: "text/html,application/xhtml+xml" })
  );
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location"), /\/admin\/login/);
});

test("403 always returns JSON", () => {
  const res = permissionDeniedResponse(new PermissionError("Forbidden.", 403), fakeRequest());
  assert.equal(res.status, 403);
});
