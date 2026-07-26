"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FillMissingButton({ leadId, missingCount = null }) {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function onFill() {
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/leads/fill-missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Fill failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
      router.refresh(); // reflect applied field fills
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  const filledFields = result ? Object.keys(result.filled || {}) : [];

  return (
    <div className="lead-fill">
      <div className="lead-research__bar">
        <strong>Fill missing info</strong>
        <button
          type="button"
          className="button button--secondary"
          onClick={onFill}
          disabled={status === "loading"}
        >
          {status === "loading"
            ? "Filling…"
            : `Fill missing info${missingCount ? ` (${missingCount})` : ""}`}
        </button>
      </div>

      {status === "error" ? <p className="admin-error">{error}</p> : null}

      {status === "done" && result?.noGaps ? (
        <p className="lead-fill__note">No missing fields to fill.</p>
      ) : null}

      {status === "done" && !result?.noGaps ? (
        <div className="lead-fill__result">
          {filledFields.length ? (
            <p>Filled: {filledFields.join(", ")}.</p>
          ) : (
            <p>No new high-confidence values found.</p>
          )}
          {Array.isArray(result.sources) && result.sources.length ? (
            <p className="lead-fill__sources">
              Sources: {result.sources.map((s) => `${s.provider}${s.ok ? "" : " (skipped)"}`).join(", ")}
            </p>
          ) : null}
          {Array.isArray(result.reviewFlags) && result.reviewFlags.length ? (
            <details className="lead-fill__flags">
              <summary>{result.reviewFlags.length} to review</summary>
              <ul>
                {result.reviewFlags.map((flag, i) => (
                  <li key={i}>
                    <strong>{flag.field}</strong>: {flag.value} ({flag.reason}
                    {flag.confidence ? `, ${flag.confidence}` : ""})
                    {flag.sourceUrl ? (
                      <a href={flag.sourceUrl} target="_blank" rel="noreferrer"> source</a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
