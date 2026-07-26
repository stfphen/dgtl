import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicUrl,
  isBlockedAddress,
  isBlockedHostname,
  safeFetch,
  SsrfBlockedError
} from "../lib/enrichment/ssrfGuard.js";

test("isBlockedAddress flags private/reserved/metadata IPs and allows public ones", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.5",
    "192.168.0.10",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // CGNAT
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:169.254.169.254" // IPv4-mapped metadata
  ]) {
    assert.equal(isBlockedAddress(ip), true, `${ip} should be blocked`);
  }

  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]) {
    assert.equal(isBlockedAddress(ip), false, `${ip} should be allowed`);
  }
});

test("isBlockedHostname blocks localhost and IP-literal private hosts", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("metadata.google.internal"), true);
  assert.equal(isBlockedHostname("127.0.0.1"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});

test("assertPublicUrl rejects non-http schemes", async () => {
  await assert.rejects(() => assertPublicUrl("file:///etc/passwd"), SsrfBlockedError);
  await assert.rejects(() => assertPublicUrl("gopher://x"), SsrfBlockedError);
  await assert.rejects(() => assertPublicUrl("ftp://example.com"), SsrfBlockedError);
});

test("assertPublicUrl blocks a public host that resolves to a private address (DNS rebinding)", async () => {
  const lookup = async () => [{ address: "10.0.0.5", family: 4 }];
  await assert.rejects(() => assertPublicUrl("http://evil.example.com", { lookup }), SsrfBlockedError);
});

test("assertPublicUrl allows a public host resolving to a public address", async () => {
  const lookup = async () => [{ address: "93.184.216.34", family: 4 }];
  const url = await assertPublicUrl("http://example.com/path", { lookup });
  assert.equal(url.hostname, "example.com");
});

test("safeFetch re-validates each redirect hop and blocks a redirect to a private address", async () => {
  const lookup = async (host) =>
    host === "public.example.com" ? [{ address: "93.184.216.34" }] : [{ address: "169.254.169.254" }];

  const fetchImpl = async (url) => {
    if (url.startsWith("http://public.example.com")) {
      return {
        status: 302,
        headers: { get: (h) => (h === "location" ? "http://internal.example.com/secret" : null) }
      };
    }
    return { status: 200, headers: { get: () => null } };
  };

  await assert.rejects(
    () => safeFetch("http://public.example.com", {}, { lookup, fetchImpl }),
    SsrfBlockedError,
    "redirect target on a private address must be blocked"
  );
});

test("safeFetch returns the response when all hops are public", async () => {
  const lookup = async () => [{ address: "93.184.216.34" }];
  const fetchImpl = async () => ({ status: 200, ok: true, headers: { get: () => null } });
  const response = await safeFetch("http://example.com", {}, { lookup, fetchImpl });
  assert.equal(response.status, 200);
});
