// DGTL Pass — environment configuration.
//
// Missing optional settings disable a feature (no Wallet provider means no
// Wallet button). Malformed settings throw, so a bad deploy is caught when the
// first pass route loads, not at the door. Spec: docs/specs/dgtl-pass/15-config-and-accounts.md.

import { createPrivateKey, X509Certificate } from "node:crypto";
import { parseCredentialSecrets } from "./credentials.js";

let cached = null;

export const WALLET_PROVIDERS = ["walletwallet", "apple"];
const WALLETWALLET_KEY = /^ww_(live|test)_[0-9a-f]{32}$/i;

// A phone on the same Wi-Fi reaches a dev server by its LAN address, and a
// QR code has to carry an address the phone can open. Private ranges and
// mDNS (.local) names are allowed over http outside production only.
function isPrivateHost(hostname) {
  if (hostname.endsWith(".local")) return true;
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function parseBaseUrl(raw, { production }) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PASS_PUBLIC_BASE_URL is not a URL: "${raw}".`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost");
  const lan = !production && isPrivateHost(url.hostname);
  if (url.protocol !== "https:" && !((local || lan) && url.protocol === "http:")) {
    throw new Error("PASS_PUBLIC_BASE_URL must be https (http is allowed only on localhost, or a LAN address in development).");
  }
  if (production && (local || isPrivateHost(url.hostname))) {
    throw new Error("PASS_PUBLIC_BASE_URL cannot be localhost or a private address in production.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PASS_PUBLIC_BASE_URL must be an origin with no path, query or fragment.");
  }
  return url.origin;
}

/**
 * Apple Wallet. Two ways to get a signed .pkpass:
 *   walletwallet  WalletWallet's API signs with its own Pass Type ID, so no Apple
 *                 Developer account is needed. Free plan: colour presets and text
 *                 only; "full" branding (logo, strip art, tier colours) needs Pro.
 *   apple         DGTL's own Pass Type ID certificate (PASSKIT_*): the exact design,
 *                 signed here (lib/passes/wallet/apple.js).
 * PASS_WALLET_PROVIDER picks one; unset, a complete PASSKIT_* set means apple,
 * else a WalletWallet key means walletwallet.
 */
function readWalletConfig(env) {
  const appleConfigured = Boolean(
    env.PASSKIT_TEAM_ID && env.PASSKIT_PASS_TYPE_ID && env.PASSKIT_SIGNER_CERT_B64 && env.PASSKIT_SIGNER_KEY_B64 && env.PASSKIT_WWDR_CERT_B64
  );
  const apiKey = String(env.WALLETWALLET_API_KEY || "").trim();
  const explicit = String(env.PASS_WALLET_PROVIDER || "").trim().toLowerCase();
  if (explicit && !WALLET_PROVIDERS.includes(explicit)) {
    throw new Error(`PASS_WALLET_PROVIDER must be one of ${WALLET_PROVIDERS.join(", ")}.`);
  }
  if (apiKey && !WALLETWALLET_KEY.test(apiKey)) {
    throw new Error("WALLETWALLET_API_KEY is malformed (expected ww_live_ followed by 32 hex characters).");
  }
  const provider = explicit || (appleConfigured ? "apple" : apiKey ? "walletwallet" : null);
  if (provider === "walletwallet" && !apiKey) throw new Error("PASS_WALLET_PROVIDER=walletwallet needs WALLETWALLET_API_KEY.");
  if (provider === "apple" && !appleConfigured) throw new Error("PASS_WALLET_PROVIDER=apple needs the full PASSKIT_* certificate set.");

  const branding = String(env.WALLETWALLET_BRANDING || "preset").trim().toLowerCase();
  if (!["preset", "full"].includes(branding)) throw new Error('WALLETWALLET_BRANDING must be "preset" (Free) or "full" (Pro).');
  let apiUrl = "https://api.walletwallet.dev";
  if (env.WALLETWALLET_API_URL) {
    const parsed = new URL(env.WALLETWALLET_API_URL);
    if (parsed.protocol !== "https:") throw new Error("WALLETWALLET_API_URL must be https.");
    apiUrl = parsed.origin;
  }
  return {
    provider,
    appleConfigured,
    walletwallet: provider === "walletwallet" ? { apiKey, apiUrl, branding } : null,
    apple: provider === "apple" ? readAppleConfig(env) : null
  };
}

const pem = (name, raw) => {
  const text = Buffer.from(String(raw).trim(), "base64").toString("utf8");
  if (!/-----BEGIN [A-Z ]+-----/.test(text)) throw new Error(`${name} must be a base64-encoded PEM file.`);
  return text;
};

const subjectField = (cert, field) => new RegExp(`^${field}=(.+)$`, "m").exec(cert.subject)?.[1]?.trim() || "";

/**
 * DGTL's own Pass Type ID certificate. Checked at load so a wrong upload fails
 * the deploy, not a guest's tap: the key must match the certificate, and the
 * certificate must be for this Pass Type ID and team, and still valid.
 */
function readAppleConfig(env) {
  const teamId = String(env.PASSKIT_TEAM_ID).trim();
  const passTypeId = String(env.PASSKIT_PASS_TYPE_ID).trim();
  let signer;
  let wwdr;
  try {
    signer = new X509Certificate(pem("PASSKIT_SIGNER_CERT_B64", env.PASSKIT_SIGNER_CERT_B64));
  } catch (error) {
    throw new Error(`PASSKIT_SIGNER_CERT_B64 is not a certificate: ${error.message}`);
  }
  try {
    wwdr = new X509Certificate(pem("PASSKIT_WWDR_CERT_B64", env.PASSKIT_WWDR_CERT_B64));
  } catch (error) {
    throw new Error(`PASSKIT_WWDR_CERT_B64 is not a certificate: ${error.message}`);
  }
  let privateKey;
  try {
    privateKey = createPrivateKey({
      key: pem("PASSKIT_SIGNER_KEY_B64", env.PASSKIT_SIGNER_KEY_B64),
      ...(env.PASSKIT_SIGNER_KEY_PASSPHRASE ? { passphrase: String(env.PASSKIT_SIGNER_KEY_PASSPHRASE) } : {})
    });
  } catch (error) {
    throw new Error(`PASSKIT_SIGNER_KEY_B64 could not be read (wrong passphrase?): ${error.message}`);
  }
  if (privateKey.asymmetricKeyType !== "rsa") throw new Error("PASSKIT_SIGNER_KEY_B64 must be the RSA key Apple's Pass Type ID certificate was requested with.");
  if (!signer.checkPrivateKey(privateKey)) throw new Error("PASSKIT_SIGNER_KEY_B64 does not match PASSKIT_SIGNER_CERT_B64.");
  const uid = subjectField(signer, "UID");
  if (uid && uid !== passTypeId) throw new Error(`The signer certificate is for ${uid}, not PASSKIT_PASS_TYPE_ID ${passTypeId}.`);
  const team = subjectField(signer, "OU");
  if (team && team !== teamId) throw new Error(`The signer certificate belongs to team ${team}, not PASSKIT_TEAM_ID ${teamId}.`);
  if (new Date(signer.validTo).getTime() < Date.now()) throw new Error(`The Pass Type ID certificate expired on ${signer.validTo}. Renew it in the Apple Developer portal.`);
  if (!signer.checkIssued(wwdr)) throw new Error("PASSKIT_WWDR_CERT_B64 is not the issuer of the signer certificate (use Apple's WWDR G4).");
  return { teamId, passTypeId, signerCertDer: signer.raw, wwdrCertDer: wwdr.raw, privateKey, expiresAt: signer.validTo };
}

/**
 * Read and validate pass configuration from an env object (default process.env).
 * Returns { enabled, baseUrl, allowedScanHosts, insecureScanHosts, secrets, activeKeyId, wallet, walletEnabled, smsEnabled, dryRun }.
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
  // http QR codes are accepted only from the base URL's own host, and only
  // when that base URL is itself http (localhost or LAN, never production).
  const insecureScanHosts = baseUrl?.startsWith("http:") ? [new URL(baseUrl).hostname] : [];

  const wallet = readWalletConfig(env);

  return {
    // Issuing needs a public URL for the QR and a key to derive credentials.
    enabled: Boolean(baseUrl && secrets.size && activeKeyId),
    baseUrl,
    allowedScanHosts,
    insecureScanHosts,
    secrets,
    activeKeyId,
    wallet,
    walletEnabled: Boolean(wallet.provider),
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
