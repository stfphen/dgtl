// Telnyx provider stub. Present so the abstraction has a second implementation
// to validate against, but NOT wired for use. Every method throws so a
// misconfiguration (TELEPHONY_PROVIDER=telnyx) fails loudly rather than silently
// behaving like Twilio. Implement behind this same contract in a future phase.

const PROVIDER = "telnyx";

function notImplemented(method) {
  throw new Error(`telnyxProvider.${method} is not implemented. Set TELEPHONY_PROVIDER=twilio.`);
}

export const telnyxProvider = {
  name: PROVIDER,
  isConfigured() {
    return false;
  },
  createOutboundCall() {
    return notImplemented("createOutboundCall");
  },
  buildInboundResponse() {
    return notImplemented("buildInboundResponse");
  },
  handleCallStatusUpdate() {
    return notImplemented("handleCallStatusUpdate");
  },
  verifyWebhook() {
    return notImplemented("verifyWebhook");
  }
};
