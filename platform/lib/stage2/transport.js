import { sendResendEmail } from "../integrations/resend.js";
import { createTestTransport } from "./testTransport.js";

export const PRODUCTION_AUTHORIZATION_PHRASE = "DGTL_CORE_PRODUCTION_SEND_AUTHORIZED";

export function productionTransportStatus(env = process.env) {
  const mode = String(env.CORE_EMAIL_TRANSPORT || "test").trim().toLowerCase();
  const releaseId = String(env.CORE_PRODUCTION_SEND_RELEASE_ID || "").trim();
  const enabled = String(env.CORE_PRODUCTION_SEND_ENABLED || "").toLowerCase() === "true";
  const authorizationMatches = String(env.CORE_PRODUCTION_SEND_AUTHORIZATION || "") === `${PRODUCTION_AUTHORIZATION_PHRASE}:${releaseId}`;
  const ratePolicyApproved = Boolean(releaseId) && String(env.CORE_RATE_POLICY_APPROVED || "") === releaseId;
  return {
    mode,
    production: mode !== "test",
    enabled,
    releaseIdConfigured: Boolean(releaseId),
    authorizationMatches,
    ratePolicyApproved,
    authorized: mode === "test" || (mode === "resend" && enabled && Boolean(releaseId) && authorizationMatches && ratePolicyApproved)
  };
}
export function createResendTransport({ sendEmail = sendResendEmail, authorized = false } = {}) {
  return {
    name: "resend",
    mode: "production",
    authorized,
    async send(message) {
      const response = await sendEmail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.body,
        text: message.body,
        idempotencyKey: message.idempotencyKey
      });
      if (response.ok) return { ok: true, providerMessageId: response.data?.id || response.data?.message_id || "", providerMetadata: response.meta || {} };
      const status = Number(response.meta?.status || 0);
      if (!status) return { ok: false, outcomeUnknown: true, retryable: false, code: "provider_unknown_result", error: response.error || "Resend result is unknown." };
      return {
        ok: false,
        outcomeUnknown: false,
        retryable: status === 409 || status === 429 || status >= 500,
        code: `resend_http_${status}`,
        error: response.error || `Resend rejected the request with status ${status}.`
      };
    }
  };
}

export function createConfiguredTransport(env = process.env, options = {}) {
  const status = productionTransportStatus(env);
  if (status.mode === "test") return createTestTransport(options.test || {});
  if (status.mode !== "resend") throw new Error(`Unsupported CORE_EMAIL_TRANSPORT: ${status.mode}`);
  if (!status.authorized) {
    throw new Error("Production transport is disabled. It requires an explicit release ID, matching authorization phrase, enabled flag, and reviewed rate policy.");
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required for the authorized Resend transport.");
  return createResendTransport({ sendEmail: options.sendEmail, authorized: true });
}
