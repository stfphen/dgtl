"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callOutcomeOptions } from "../../lib/telephony/constants.js";
import RecordingButton from "./RecordingButton.jsx";

// Editing select: a placeholder followed by the shared labeled outcomes.
const OUTCOME_OPTIONS = [{ value: "", label: "— Select outcome —" }, ...callOutcomeOptions];

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return "—";
  const total = Number(seconds) || 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m${String(secs).padStart(2, "0")}s`;
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

// Twilio recording URLs need account auth, so play them through the app proxy.
// Mock/sample assets (and any non-Twilio URL) play directly.
function recordingSrc(call) {
  if (!call?.recordingUrl) return "";
  return call.recordingUrl.includes("api.twilio.com")
    ? `/api/telephony/recordings/${call.id}`
    : call.recordingUrl;
}

export default function LeadCallPanel({
  leadId,
  leadPhone = "",
  doNotCall = false,
  doNotContact = false,
  telephonyEnabled = false,
  calls = [],
  canDelete = false
}) {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | calling | placed | error
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [transcribingId, setTranscribingId] = useState("");
  const [confirmingId, setConfirmingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  async function deleteCallRow(callId) {
    setDeletingId(callId);
    setError("");
    try {
      const response = await fetch("/api/admin/telephony/delete-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Delete failed (${response.status}).`);
        return;
      }
      setConfirmingId("");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setDeletingId("");
    }
  }

  async function transcribeCall(callId) {
    setTranscribingId(callId);
    setError("");
    try {
      const response = await fetch("/api/admin/telephony/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Transcription failed (${response.status}).`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setTranscribingId("");
    }
  }

  const blockedReason = !telephonyEnabled
    ? "Telephony is not enabled for this tenant."
    : doNotCall
      ? "Lead is marked do-not-call."
      : doNotContact
        ? "Lead is marked do-not-contact."
        : !leadPhone
          ? "Lead has no phone number."
          : "";
  const callDisabled = Boolean(blockedReason) || status === "calling";

  async function placeCall() {
    setStatus("calling");
    setError("");
    try {
      const response = await fetch("/api/telephony/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Call failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setStatus("placed");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  async function saveOutcome(callId, outcome) {
    if (!outcome) return;
    setSavingId(callId);
    setError("");
    try {
      const response = await fetch("/api/admin/telephony/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, outcome })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Could not save outcome (${response.status}).`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="lead-call-panel">
      <h3>Call</h3>
      <div className="lead-actions">
        <button
          type="button"
          className="button button--primary"
          onClick={placeCall}
          disabled={callDisabled}
          title={blockedReason || "Place an outbound call to this lead"}
        >
          {status === "calling" ? "Calling…" : "Call Lead"}
        </button>
        <span
          className="button button--secondary button--disabled"
          aria-disabled="true"
          title="Coming soon"
        >
          Send SMS
        </span>
      </div>
      {blockedReason ? <p className="admin-hint">{blockedReason}</p> : null}
      {status === "placed" ? <p className="admin-hint">Call placed — your phone should ring first.</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="outreach-list">
        {calls.map((call) => (
          <div key={call.id} className="outreach-list-row lead-call-row">
            <strong>
              {call.direction === "inbound" ? "Inbound" : "Outbound"} · {call.status}
            </strong>
            <span>
              {formatWhen(call.startedAt || call.createdAt)} · {formatDuration(call.durationSeconds)}
              {call.outcome ? ` · ${call.outcome.replaceAll("_", " ")}` : ""}
              {call.recordingUrl ? " · recorded" : ""}
            </span>
            {call.recordingUrl ? <RecordingButton src={recordingSrc(call)} /> : null}
            {call.aiSummary ? (
              <details className="lead-call-summary">
                <summary>AI summary</summary>
                <p>{call.aiSummary}</p>
              </details>
            ) : null}
            {call.transcript ? (
              <details className="lead-call-transcript">
                <summary>Transcript</summary>
                <pre>{call.transcript}</pre>
              </details>
            ) : call.recordingUrl ? (
              <button
                type="button"
                className="button button--secondary lead-call-transcribe"
                onClick={() => transcribeCall(call.id)}
                disabled={transcribingId === call.id}
              >
                {transcribingId === call.id ? "Transcribing…" : "Transcribe"}
              </button>
            ) : null}
            <label className="lead-call-outcome">
              Outcome
              <select
                defaultValue={call.outcome || ""}
                disabled={savingId === call.id}
                onChange={(event) => saveOutcome(call.id, event.target.value)}
              >
                {OUTCOME_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {canDelete ? (
              confirmingId === call.id ? (
                <span className="lead-call-confirm">
                  <button
                    type="button"
                    className="lead-call-danger"
                    onClick={() => deleteCallRow(call.id)}
                    disabled={deletingId === call.id}
                  >
                    {deletingId === call.id ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    className="lead-call-cancel"
                    onClick={() => setConfirmingId("")}
                    disabled={deletingId === call.id}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="lead-call-delete"
                  onClick={() => setConfirmingId(call.id)}
                  title="Delete call"
                >
                  Delete
                </button>
              )
            ) : null}
          </div>
        ))}
        {!calls.length ? <p>No calls logged yet.</p> : null}
      </div>
    </section>
  );
}
