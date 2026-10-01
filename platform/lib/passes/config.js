// DGTL Pass — environment configuration.
//
// Missing optional settings disable a feature (no Apple certificate means no
// Wallet button). Malformed settings throw, so a bad deploy is caught when the
// first pass route loads, not at the door. Spec: docs/specs/dgtl-pass/15-config-and-accounts.md.

import { parseCredentialSecrets } from "./credentials.js";

let cached = null;

function parseBaseUrl(raw, { production }) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PASS_PUBLIC_BASE_URL is not a URL: "${raw}".`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("PASS_PUBLIC_BASE_URL must be https (http is allowed only on localhost).");
  }
  if (production && local) throw new Error("PASS_PUBLIC_BASE_URL cannot be localhost in production.");
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PASS_PUBLIC_BASE_URL must be an origin with no path, query or fragment.");
  }
  return url.origin;
}

/**
 * Read and validate pass configuration from an env object (default process.env).
 * Returns { enabled, baseUrl, allowedScanHosts, secrets, activeKeyId, walletEnabled, smsEnabled }.
 */
export function readPassesConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const baseUrl = parseBaseUrl(String(env.PASS_PUBLIC_BASE_URL || "").trim(), { production });
  const secrets = env.PASS_CREDENTIAL_SECRETS ? parseCredentialSecrets(env.PASS_CREDENTIAL_SECRETS) : new Map();
  const activeKeyId = String(env.PASS_CREDENTIAL_ACTIVE_KEY || "").trim();

  if (secrets.size && !activeKeyId) throw new Error("PASS_CREDENTIAL_ACTIVE_KEY is required when PASS_CREDENTIAL_SECRETS is set.");
  if (activeKeyId && !secrets.has(activeKeyId)) {
    throw new Error(`PASS_CREDENTIAL_ACTIVE_KEY "${activeKeyId}" is not one of the configured secrets.`);
  }

  const hostList = String(env.PASS_ALLOWED_SCAN_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const allowedScanHosts = [...new Set([...(baseUrl ? [new URL(baseUrl).hostname] : []), ...hostList])];

  const walletEnabled = Boolean(
    env.PASSKIT_TEAM_ID && env.PASSKIT_PASS_TYPE_ID && env.PASSKIT_SIGNER_CERT_B64 && env.PASSKIT_SIGNER_KEY_B64 && env.PASSKIT_WWDR_CERT_B64
  );

  return {
    // Issuing needs a public URL for the QR and a key to derive credentials.
    enabled: Boolean(baseUrl && secrets.size && activeKeyId),
    baseUrl,
    allowedScanHosts,
    secrets,
    activeKeyId,
    walletEnabled,
    smsEnabled: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID),
    dryRun: String(env.PASSES_DRY_RUN || "").toLowerCase() === "true"
  };
}

// Process-wide config, parsed once.
export function passesConfig() {
  if (!cached) cached = readPassesConfig();
  return cached;
}

export function __resetPassesConfigForTests() {
  cached = null;
}
