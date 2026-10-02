// DGTL Pass — the tenant `passes` block, set from the command line until the
// tenant editor section exists (build-plan P2.2). Pure: scripts/setup-pass-tenant.mjs
// does the database work.

import { DGTL_TOKENS } from "./brandKit.js";
import { assertTimeZone } from "./validity.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Merge pass settings into a tenant config without touching anything else.
 * options: { supportEmail, gates?, timeZone?, dayCutoffHour?, termsUrl?, supportUrl?, dgtlLockup? }
 */
export function withPassSettings(config, options) {
  if (!EMAIL.test(String(options.supportEmail || ""))) throw new Error("--support-email is required: holders see it on every pass.");
  for (const [name, value] of [["--terms-url", options.termsUrl], ["--support-url", options.supportUrl]]) {
    if (value && !/^https:\/\//.test(value)) throw new Error(`${name} must be an https URL.`);
  }
  const current = config.passes || {};
  const timeZone = options.timeZone || current.timeZone || "America/Toronto";
  assertTimeZone(timeZone);
  const cutoff = options.dayCutoffHour ?? current.dayCutoffHour ?? 4;
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > 8) throw new Error("--day-cutoff-hour must be a whole hour from 0 to 8.");
  const gates = options.gates?.length ? options.gates : current.gates?.length ? current.gates : ["Main door"];
  const lockup = options.dgtlLockup ?? true;
  return {
    ...config,
    passes: {
      ...current,
      timeZone,
      dayCutoffHour: cutoff,
      gates: gates.map((gate) => String(gate).trim()).filter(Boolean).slice(0, 20),
      brandKit: {
        ...(current.brandKit || {}),
        // The DGTL wordmark spells the name, so Wallet shows "DGTL⚡ PASS".
        ...(lockup ? { logoIncludesName: true, walletLogoText: "PASS" } : {}),
        legal: {
          ...(current.brandKit?.legal || {}),
          supportEmail: options.supportEmail,
          ...(options.termsUrl ? { termsUrl: options.termsUrl } : {}),
          ...(options.supportUrl ? { supportUrl: options.supportUrl } : {})
        }
      }
    }
  };
}

/** A new pass-only tenant: DGTL brand from the token, no domains, draft so it never claims a host. */
export function newPassTenantConfig({ id, slug, teamId, name = "DGTL" }) {
  return {
    id,
    slug,
    teamId,
    status: "draft",
    domains: [],
    brand: { name, logoText: name, primaryColor: DGTL_TOKENS["--gold"] }
  };
}
