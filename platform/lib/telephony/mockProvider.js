// Mock telephony provider — simulates the outbound call lifecycle with NO real
// dialing, no credentials, and no cost. Selected explicitly by
// TELEPHONY_PROVIDER=mock (never auto-selected, so prod can't silently mock).
// Used for demos and local/dev. The lifecycle is advanced by mockSimulator.js
// (which holds the store dependency); this module stays free of store imports to
// mirror twilioProvider/telnyxProvider.

import { providerSuccess } from "../integrations/providerResponse.js";

const PROVIDER = "mock";

// Bundled placeholder recording served from /public. Stands in for a real Twilio
// recording so the player UI + audit trail are exercised end-to-end in the demo.
export const MOCK_RECORDING_URL = "/audio/sample-call.wav";

function mockCallId() {
  return `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// No external call is placed. Returns a synthetic provider id; mockSimulator
// advances the logged Call through ringing -> in_progress -> completed.
function createOutboundCall({ callId } = {}) {
  return providerSuccess(PROVIDER, {
    providerCallId: mockCallId(),
    status: "ringing",
    callId: callId || "",
    simulated: true
  });
}

function buildInboundResponse() {
  // Inbound is not simulated in this phase; return an inert response.
  return "<Response><Say>Mock telephony — inbound is not simulated.</Say><Hangup/></Response>";
}

function handleCallStatusUpdate(update = {}) {
  const status = String(update.status || update.CallStatus || "").toLowerCase() || "completed";
  const durationRaw = update.durationSeconds ?? update.CallDuration;
  const duration =
    durationRaw === undefined || durationRaw === null || durationRaw === "" ? null : Number(durationRaw);
  return {
    providerCallId: update.providerCallId || update.CallSid || "",
    status,
    durationSeconds: Number.isFinite(duration) ? duration : null,
    isTerminal: ["completed", "missed", "failed"].includes(status),
    raw: status
  };
}

function verifyWebhook() {
  // No signed webhooks in mock mode — the simulator writes to the store directly.
  return true;
}

export const mockProvider = {
  name: PROVIDER,
  isConfigured() {
    return true;
  },
  createOutboundCall,
  buildInboundResponse,
  handleCallStatusUpdate,
  verifyWebhook
};
