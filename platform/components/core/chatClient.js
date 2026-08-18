"use client";

// The only place DGTL.chat talks to the server. Both surfaces — the bubble chat
// and the terminal — go through here, so neither can drift into its own fetch
// conventions or its own error shape.

export const CONFIRM_LABELS = {
  "message.prepare_followup": "Create draft",
  "generation.prepare_asset": "Create generation request",
  "worklog.prepare_handoff": "Prepare Worklog handoff",
  "opportunity.prepare_next_action": "Apply next action",
};

function toError(body, response) {
  return Object.assign(new Error(body.error || `Request failed (${response.status}).`), {
    status: response.status,
    code: body.code,
  });
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", accept: "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw toError(body, response);
  return body;
}

// Abortable variant, used for anything that can take real time — a model turn
// runs up to TURN_LIMITS.turnTimeoutMs (60s) server-side.
//
// The prior art had no AbortController, no timeout and no cancel key: it
// disabled its input in a try block and re-enabled it in finally, so a request
// that never settled locked the UI until reload. An abort here is client-side
// only — the server turn keeps running under the thread CAS — so callers must
// reconcile thread state afterwards rather than assume the turn stopped.
export async function apiAbortable(path, { signal, timeoutMs = 75_000, ...options } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
  try {
    return await api(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}

export const isAbort = (error) => error?.name === "AbortError" || error?.name === "TimeoutError";
