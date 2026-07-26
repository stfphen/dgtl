// Provider-neutral email send seam. The outreach send path imports ONLY from
// here — never sendResendEmail directly — so a dry-run/mock send is a one-flag
// swap and the whole path (statuses, events, metrics) stays identical.
//
// Dry-run is opt-in and never auto-selected in production: it is on only when a
// caller passes dryRun, OUTREACH_DRY_RUN="true" is set, or the campaign is in
// testMode. Mirrors the telephony provider seam (lib/telephony/index.js).

import { sendResendEmail } from "./resend.js";
import { sendMockEmail } from "./mockEmailProvider.js";

/**
 * Resolve whether this send should be mocked. Precedence:
 *   explicit param  >  global OUTREACH_DRY_RUN env  >  per-campaign testMode.
 */
export function resolveDryRun({ dryRun, campaign } = {}) {
  if (dryRun === true) return true;
  if (dryRun === false) return false;
  if (String(process.env.OUTREACH_DRY_RUN || "").toLowerCase() === "true") return true;
  return Boolean(campaign?.testMode);
}

/**
 * Send one email through the selected provider. Returns the standard provider
 * envelope ({ ok, provider, configured, data, error }). Never throws for a
 * provider-level failure — callers branch on `.ok`.
 */
export async function sendOutreachEmail(message, { dryRun = false } = {}) {
  const send = dryRun ? sendMockEmail : sendResendEmail;
  return send(message);
}
