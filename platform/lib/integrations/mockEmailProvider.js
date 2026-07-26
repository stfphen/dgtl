// Mock email provider — records a "sent" outcome with NO real network call, no
// credentials, no cost. Used for demos, tests, and dry-run batches so the whole
// send path (statuses, events, metrics) is exercised without emailing anyone.
//
// Mirrors lib/telephony/mockProvider.js: selected only by an explicit dry-run
// signal, never auto-selected, so production can't silently mock.

import { providerSuccess } from "./providerResponse.js";

let seq = 0;

function mockMessageId() {
  // Deterministic-enough unique id without Date.now()/Math.random (kept simple
  // and dependency-free); the "dryrun_" prefix marks a non-delivered message.
  seq += 1;
  return `dryrun_${seq}_${process.pid.toString(36)}`;
}

// eslint-disable-next-line no-unused-vars
export async function sendMockEmail({ from, to, subject, html, text } = {}) {
  return providerSuccess("mock", { id: mockMessageId(), simulated: true });
}
