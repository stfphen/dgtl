"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

// Ad-hoc dialpad for the Calls tab. Opens on a button click; type or tap a number
// and call it through /api/telephony/dial (uses the selected tenant as caller ID).
export default function DialPad({ tenants = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("+1");
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [status, setStatus] = useState("idle"); // idle | calling | placed | error
  const [error, setError] = useState("");

  const noTenant = tenants.length === 0;

  function append(ch) {
    setNumber((current) => current + ch);
    setStatus("idle");
  }
  function backspace() {
    setNumber((current) => current.slice(0, -1));
  }

  async function placeCall() {
    setStatus("calling");
    setError("");
    try {
      const response = await fetch("/api/telephony/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number, tenantId })
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

  return (
    <div className="dialpad">
      <button type="button" className="button button--secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "Close dialpad" : "☎ Dialpad"}
      </button>

      {open ? (
        <div className="dialpad__panel" role="dialog" aria-label="Dialpad">
          {tenants.length > 1 ? (
            <label className="dialpad__tenant">
              From
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phoneNumber})
                  </option>
                ))}
              </select>
            </label>
          ) : tenants.length === 1 ? (
            <p className="dialpad__from">From {tenants[0].name} ({tenants[0].phoneNumber})</p>
          ) : null}

          <div className="dialpad__display">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="tel"
              placeholder="+1 416 555 0123"
              aria-label="Phone number"
            />
            <button type="button" className="dialpad__back" onClick={backspace} aria-label="Backspace">⌫</button>
          </div>

          <div className="dialpad__keys">
            {KEYS.map((k) => (
              <button key={k} type="button" className="dialpad__key" onClick={() => append(k)}>
                {k}
              </button>
            ))}
          </div>

          <div className="dialpad__actions">
            <button type="button" className="dialpad__plus" onClick={() => append("+")}>+</button>
            <button
              type="button"
              className="dialpad__call"
              onClick={placeCall}
              disabled={noTenant || status === "calling" || !number.trim()}
              title={noTenant ? "No telephony-enabled tenant" : "Call this number"}
            >
              {status === "calling" ? "Calling…" : "Call"}
            </button>
            <button type="button" className="dialpad__clear" onClick={() => setNumber("")}>Clear</button>
          </div>

          {noTenant ? <p className="admin-hint">Enable telephony on a tenant first (Tenants → Phone Settings).</p> : null}
          {status === "placed" ? <p className="admin-hint">Call placed — your phone should ring first.</p> : null}
          {error ? <p className="admin-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
