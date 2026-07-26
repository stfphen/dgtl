// Provider-neutral telephony service layer. Routes and UI import ONLY from here
// (and routing.js) — never a vendor SDK directly. getProvider() selects the
// implementation from env TELEPHONY_PROVIDER (default "twilio").

import { addCallEvent, getTenantTelephony } from "../store.js";
import { twilioProvider } from "./twilioProvider.js";
import { telnyxProvider } from "./telnyxProvider.js";
import { mockProvider } from "./mockProvider.js";

export function getProvider() {
  const name = String(process.env.TELEPHONY_PROVIDER || "twilio").toLowerCase();
  if (name === "mock") return mockProvider; // explicit opt-in; never auto-selected
  if (name === "telnyx") return telnyxProvider;
  return twilioProvider;
}

export function isConfigured() {
  return getProvider().isConfigured();
}

/** Click-to-call. Returns a providerResponse envelope ({ ok, configured, data }). */
export function createOutboundCall(input) {
  return getProvider().createOutboundCall(input);
}

/**
 * When the active provider is the mock, drive the freshly-logged Call through its
 * simulated lifecycle (ringing -> in_progress -> completed + recording). No-op for
 * real providers, whose lifecycle arrives via status/recording webhooks.
 */
export async function maybeSimulateCall(call) {
  if (!call || getProvider().name !== "mock") return;
  const { scheduleMockCallLifecycle } = await import("./mockSimulator.js");
  scheduleMockCallLifecycle(call);
}

/** Returns provider voice instructions (TwiML string for Twilio). */
export function buildInboundResponse(ctx) {
  return getProvider().buildInboundResponse(ctx);
}

/** Kick off post-call transcription for a finished recording (provider-specific). */
export function createRecordingTranscript(input) {
  const provider = getProvider();
  if (typeof provider.createRecordingTranscript !== "function") {
    return { ok: false, configured: false, error: `${provider.name} has no transcription support.` };
  }
  return provider.createRecordingTranscript(input);
}

/** Fetch a completed transcript's text (provider-specific). Returns "" on failure. */
export function fetchTranscriptText(transcriptSid) {
  const provider = getProvider();
  if (typeof provider.fetchTranscriptText !== "function") return "";
  return provider.fetchTranscriptText(transcriptSid);
}

/** Normalize a provider status callback into our Call/CallEvent shape. */
export function handleCallStatusUpdate(update) {
  return getProvider().handleCallStatusUpdate(update);
}

/** Verify a webhook signature. Returns boolean (false when unconfigured/unsigned). */
export function verifyWebhook(verification) {
  return getProvider().verifyWebhook(verification);
}

/** Resolve the tenant's caller-ID number (E.164) from its telephony config. */
export async function getTenantNumber(tenantId) {
  const tel = await getTenantTelephony(tenantId);
  return tel?.phoneNumber || "";
}

/** Append a provider event row to a call's event log. */
export function logCallEvent(callId, eventType, payload) {
  return addCallEvent(callId, eventType, payload);
}

export { decideRoute } from "./routing.js";
