// Single source of truth for telephony enums + safe-default config.
// Pattern mirrors lib/leadUtils.js / lib/outreachSequence.js: exported arrays
// of allowed values plus small normalizer helpers. No external imports here so
// this module can be pulled into the data layer (lib/store.js, lib/defaultTenant.js)
// without creating import cycles.

export const telephonyProviders = ["twilio", "telnyx"];

export const callDirections = ["inbound", "outbound"];

export const callStatuses = ["ringing", "in_progress", "completed", "missed", "failed"];

export const callOutcomes = [
  "connected_interested",
  "connected_not_interested",
  "left_voicemail",
  "no_answer",
  "wrong_number",
  "callback_requested",
  "booked_call",
  "do_not_call"
];

// Labeled call outcomes for UI selects (single source of truth shared by the
// lead Call panel and the Calls tab). Ordered for rep convenience, not by enum.
// Pure/client-safe — no data-layer imports.
export const callOutcomeOptions = [
  { value: "booked_call", label: "Booked Call" },
  { value: "connected_interested", label: "Interested – Follow Up" },
  { value: "no_answer", label: "No Answer" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "connected_not_interested", label: "Not Interested" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "callback_requested", label: "Callback Requested" },
  { value: "do_not_call", label: "Do Not Call" }
];

export const routingModes = ["single_rep", "round_robin", "team_ring", "availability_based"];

export const recordingConsentModes = [
  "disabled",
  "one_party",
  "two_party_notice",
  "play_disclaimer"
];

// Telephony/sales role, kept separate from the permission role on
// team_memberships (owner/admin/sales/contractor/viewer) so the two concepts
// don't collide. Surfaced as `telephonyRole` on team members.
export const repRoles = ["setter", "closer", "sales_manager", "admin", "viewer"];

export const availabilityStatuses = ["available", "busy", "offline"];

export function defaultTenantTelephony() {
  return {
    enabled: false,
    provider: "twilio",
    phoneNumber: "",
    providerNumberId: "",
    routingMode: "single_rep",
    defaultRepId: "",
    fallbackNumber: "",
    voicemailEnabled: true,
    recordingEnabled: false,
    transcriptionEnabled: false,
    smsEnabled: false,
    recordingConsentMode: "disabled"
  };
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function asBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") return ["true", "1", "on", "yes"].includes(value.toLowerCase());
  return Boolean(value);
}

// Merge a (possibly partial / legacy) telephony config onto safe defaults.
// Config holds SETUP values only — never live call activity.
export function normalizeTenantTelephony(input) {
  const defaults = defaultTenantTelephony();
  if (!input || typeof input !== "object") return defaults;
  return {
    enabled: asBool(input.enabled, defaults.enabled),
    provider: oneOf(input.provider, telephonyProviders, defaults.provider),
    phoneNumber: typeof input.phoneNumber === "string" ? input.phoneNumber.trim() : defaults.phoneNumber,
    providerNumberId:
      typeof input.providerNumberId === "string" ? input.providerNumberId.trim() : defaults.providerNumberId,
    routingMode: oneOf(input.routingMode, routingModes, defaults.routingMode),
    defaultRepId: typeof input.defaultRepId === "string" ? input.defaultRepId.trim() : defaults.defaultRepId,
    fallbackNumber:
      typeof input.fallbackNumber === "string" ? input.fallbackNumber.trim() : defaults.fallbackNumber,
    voicemailEnabled: asBool(input.voicemailEnabled, defaults.voicemailEnabled),
    recordingEnabled: asBool(input.recordingEnabled, defaults.recordingEnabled),
    transcriptionEnabled: asBool(input.transcriptionEnabled, defaults.transcriptionEnabled),
    smsEnabled: asBool(input.smsEnabled, defaults.smsEnabled),
    recordingConsentMode: oneOf(input.recordingConsentMode, recordingConsentModes, defaults.recordingConsentMode)
  };
}
