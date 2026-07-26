"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ROUTING_MODES = [
  { value: "single_rep", label: "Single rep" },
  { value: "round_robin", label: "Round robin (soon)" },
  { value: "team_ring", label: "Team ring (soon)" },
  { value: "availability_based", label: "Availability based (soon)" }
];

const CONSENT_MODES = [
  { value: "disabled", label: "Disabled" },
  { value: "one_party", label: "One-party" },
  { value: "two_party_notice", label: "Two-party notice" },
  { value: "play_disclaimer", label: "Play disclaimer" }
];

const DEFAULTS = {
  enabled: false,
  provider: "twilio",
  phoneNumber: "",
  routingMode: "single_rep",
  defaultRepId: "",
  fallbackNumber: "",
  voicemailEnabled: true,
  recordingEnabled: false,
  transcriptionEnabled: false,
  smsEnabled: false,
  recordingConsentMode: "disabled"
};

function telephonyOf(tenant) {
  return { ...DEFAULTS, ...(tenant?.telephony || {}) };
}

export default function TenantPhoneSettings({ tenants = [], reps = [] }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const selected = useMemo(() => tenants.find((t) => t.id === tenantId) || tenants[0], [tenants, tenantId]);
  const [form, setForm] = useState(() => telephonyOf(tenants[0]));
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState("");

  function switchTenant(nextId) {
    setTenantId(nextId);
    setForm(telephonyOf(tenants.find((t) => t.id === nextId)));
    setStatus("idle");
    setError("");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus("idle");
  }

  async function save(event) {
    event.preventDefault();
    if (!tenantId) return;
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/admin/tenants/telephony", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, telephony: form })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Save failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  if (!tenants.length) {
    return (
      <article className="admin-panel">
        <h2>Phone Settings</h2>
        <p>No tenants available.</p>
      </article>
    );
  }

  return (
    <article className="admin-panel admin-panel--wide">
      <h2>Phone Settings</h2>
      <p>Telephony setup per tenant. Call activity is logged on each lead, not here.</p>

      <form className="admin-form" onSubmit={save}>
        <label>
          Tenant
          <select value={tenantId} onChange={(event) => switchTenant(event.target.value)}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name || tenant.slug || tenant.id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-checkbox">
          <input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} />
          Enable telephony for {selected?.name || "this tenant"}
        </label>

        <label>
          Phone number (E.164)
          <input
            value={form.phoneNumber}
            onChange={(event) => update("phoneNumber", event.target.value)}
            placeholder="+14165550123"
          />
        </label>

        <label>
          Provider
          <select value={form.provider} onChange={(event) => update("provider", event.target.value)}>
            <option value="twilio">Twilio</option>
            <option value="telnyx">Telnyx (soon)</option>
          </select>
        </label>

        <label>
          Routing mode
          <select value={form.routingMode} onChange={(event) => update("routingMode", event.target.value)}>
            {ROUTING_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </label>

        <label>
          Default assigned rep
          <select value={form.defaultRepId} onChange={(event) => update("defaultRepId", event.target.value)}>
            <option value="">— None —</option>
            {reps.map((rep) => (
              <option key={rep.id} value={rep.id}>{rep.name || rep.email || rep.id}</option>
            ))}
          </select>
        </label>

        <label>
          Fallback number (E.164)
          <input
            value={form.fallbackNumber}
            onChange={(event) => update("fallbackNumber", event.target.value)}
            placeholder="+14165550199"
          />
        </label>

        <label className="admin-checkbox">
          <input type="checkbox" checked={form.voicemailEnabled} onChange={(event) => update("voicemailEnabled", event.target.checked)} />
          Voicemail enabled
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={form.recordingEnabled} onChange={(event) => update("recordingEnabled", event.target.checked)} />
          Recording enabled (default OFF — enable only with consent handling)
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={form.transcriptionEnabled} onChange={(event) => update("transcriptionEnabled", event.target.checked)} />
          Transcription enabled
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={form.smsEnabled} onChange={(event) => update("smsEnabled", event.target.checked)} />
          SMS enabled
        </label>

        <label>
          Recording consent mode
          <select value={form.recordingConsentMode} onChange={(event) => update("recordingConsentMode", event.target.value)}>
            {CONSENT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </label>

        <button className="button button--primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save Phone Settings"}
        </button>
        {status === "saved" ? <p className="admin-hint">Saved.</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}
      </form>
    </article>
  );
}
