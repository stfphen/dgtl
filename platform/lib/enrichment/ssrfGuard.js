// SSRF guard for the server-side website enrichment fetcher.
//
// `websiteUrl` is attacker-controllable (public POST /api/leads and
// /api/funding/survey), and the fetcher runs inside our network, so an
// unguarded fetch can reach loopback, RFC-1918, and cloud metadata endpoints
// (169.254.169.254). This module enforces an http(s)-only scheme allowlist and
// blocks any request whose target hostname resolves to a private/reserved IP —
// re-checked on every redirect hop, since `redirect: "follow"` would otherwise
// bypass a one-time pre-check.

import dnsPromises from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal"
]);

export class SsrfBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

function ipv4ToInt(ip) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inCidr(ipInt, baseIp, maskBits) {
  const base = ipv4ToInt(baseIp);
  if (base === null) return false;
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

// Private, loopback, link-local (incl. the cloud metadata address 169.254.169.254),
// CGNAT, benchmarking, multicast, and reserved IPv4 ranges.
const BLOCKED_IPV4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
];

function isBlockedIpv4(ip) {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return true; // unparseable -> refuse
  return BLOCKED_IPV4.some(([base, bits]) => inCidr(ipInt, base, bits));
}

function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase().split("%")[0]; // drop any zone id
  if (normalized === "::1" || normalized === "::") return true; // loopback / unspecified

  // IPv4-mapped / -compatible (::ffff:1.2.3.4 or ::ffff:a1b2:c3d4) -> classify the v4.
  const mapped = normalized.match(/^::ffff:(.+)$/);
  if (mapped) {
    const inner = mapped[1];
    if (net.isIP(inner) === 4) return isBlockedIpv4(inner);
    const hexPair = inner.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexPair) {
      const a = parseInt(hexPair[1], 16);
      const b = parseInt(hexPair[2], 16);
      const v4 = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`;
      return isBlockedIpv4(v4);
    }
  }

  const firstHextet = parseInt(normalized.split(":")[0] || "0", 16) || 0;
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export function isBlockedAddress(ip) {
  const type = net.isIP(ip);
  if (type === 4) return isBlockedIpv4(ip);
  if (type === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP literal -> refuse
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  // A bare IP literal in the hostname position: classify directly.
  if (net.isIP(host)) return isBlockedAddress(host);
  return false;
}

/**
 * Validate a single URL: http(s) only, hostname not on the blocklist, and every
 * resolved DNS address public. Throws SsrfBlockedError otherwise.
 * `lookup` is injectable for tests (defaults to real DNS).
 */
export async function assertPublicUrl(rawUrl, { lookup } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(`Blocked URL scheme: ${url.protocol}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (isBlockedHostname(hostname)) {
    throw new SsrfBlockedError(`Blocked host: ${hostname}`);
  }

  // If it's already an IP literal, isBlockedHostname covered it; no DNS needed.
  if (net.isIP(hostname)) return url;

  const resolve = lookup || ((h) => dnsPromises.lookup(h, { all: true }));
  let addresses;
  try {
    addresses = await resolve(hostname);
  } catch {
    throw new SsrfBlockedError(`Could not resolve host: ${hostname}`);
  }

  const list = Array.isArray(addresses) ? addresses : [addresses];
  if (!list.length) throw new SsrfBlockedError(`No addresses for host: ${hostname}`);
  for (const entry of list) {
    const address = typeof entry === "string" ? entry : entry?.address;
    if (!address || isBlockedAddress(address)) {
      throw new SsrfBlockedError(`Blocked resolved address for ${hostname}: ${address}`);
    }
  }

  return url;
}

/**
 * fetch() wrapper that validates the initial URL and every redirect hop against
 * assertPublicUrl. Redirects are followed manually (redirect: "manual") so a
 * 3xx to a private address cannot slip past the guard.
 */
export async function safeFetch(rawUrl, options = {}, { maxRedirects = 5, lookup, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicUrl(currentUrl, { lookup });

    const response = await doFetch(currentUrl, { ...options, redirect: "manual" });
    const status = response.status;

    if (status >= 300 && status < 400) {
      const location = response.headers?.get?.("location");
      if (!location) return response; // 3xx with no Location -> hand back as-is
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new SsrfBlockedError("Too many redirects.");
}
