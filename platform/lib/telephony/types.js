// Shared telephony type definitions (JSDoc — the repo is plain JS/ESM).
// These describe the provider-neutral shapes that routes and the service layer
// exchange. Providers (twilioProvider, telnyxProvider) implement the same
// contract so routes never import a vendor SDK directly.

/**
 * @typedef {Object} CreateOutboundCallInput
 * @property {string} tenantNumber   Caller ID presented to the lead (E.164).
 * @property {string} repNumber      Rep's phone we dial first (E.164).
 * @property {string} leadNumber     Lead's phone we bridge to (E.164).
 * @property {string} statusCallbackUrl  Absolute URL Twilio posts status to.
 * @property {string} [callId]       Our internal Call id (for correlation).
 */

/**
 * @typedef {Object} InboundCallContext
 * @property {"dial"|"voicemail"|"reject"} action  What to do with the call.
 * @property {string} tenantNumber   Caller ID for the bridged leg (E.164).
 * @property {string} [destinationNumber]  Rep/fallback number to dial.
 * @property {boolean} [voicemailEnabled]
 * @property {string} [greeting]     Optional spoken message.
 */

/**
 * @typedef {Object} CallStatusUpdate
 * Raw, provider-specific status-callback params (already parsed to an object).
 * @property {string} [CallSid]
 * @property {string} [CallStatus]
 * @property {string} [CallDuration]
 * @property {"inbound"|"outbound"} [direction]
 */

/**
 * @typedef {Object} NormalizedStatusUpdate
 * @property {string} providerCallId
 * @property {("ringing"|"in_progress"|"completed"|"missed"|"failed")} status
 * @property {number|null} durationSeconds
 * @property {string} [startedAt]
 * @property {string} [endedAt]
 * @property {string} raw  Original provider status string.
 */

/**
 * @typedef {Object} WebhookVerification
 * @property {string} url        Exact public URL Twilio called.
 * @property {string} signature  X-Twilio-Signature header value.
 * @property {Object} params     Parsed form params.
 */

/**
 * @typedef {Object} TelephonyProvider
 * @property {() => boolean} isConfigured
 * @property {(input: CreateOutboundCallInput) => Promise<object>} createOutboundCall
 * @property {(ctx: InboundCallContext) => string} buildInboundResponse
 * @property {(update: CallStatusUpdate) => NormalizedStatusUpdate} handleCallStatusUpdate
 * @property {(verification: WebhookVerification) => boolean} verifyWebhook
 */

export {};
