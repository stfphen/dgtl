// Build the EXACT public webhook URL Twilio is configured to call. Signature
// verification fails unless this matches byte-for-byte (scheme, host, path, no
// trailing-slash mismatch) — see Appendix B of the integration spec. Set
// TELEPHONY_WEBHOOK_BASE_URL to the public origin (ngrok URL in dev, domain in
// prod); falls back to NEXT_PUBLIC_APP_URL.

export function webhookUrl(routePath) {
  const base = String(process.env.TELEPHONY_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const path = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${base}${path}`;
}
