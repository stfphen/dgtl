"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_APP_ICON_BYTES = 512 * 1024; // keep in sync with lib/branding/appIcon.js

function iconOf(tenant) {
  return tenant?.appIcon || "";
}

export default function TenantBrandingSettings({ tenants = [] }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const selected = useMemo(() => tenants.find((t) => t.id === tenantId) || tenants[0], [tenants, tenantId]);
  const [appIcon, setAppIcon] = useState(() => iconOf(tenants[0]));
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState("");

  function switchTenant(nextId) {
    setTenantId(nextId);
    setAppIcon(iconOf(tenants.find((t) => t.id === nextId)));
    setStatus("idle");
    setError("");
  }

  function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("idle");
    setError("");
    if (file.type !== "image/png") {
      setError("Please choose a PNG image (square, ideally 512×512).");
      return;
    }
    if (file.size > MAX_APP_ICON_BYTES) {
      setError("Image is too large (max 512 KB). Try a smaller / more compressed PNG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAppIcon(String(reader.result || ""));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function clearIcon() {
    setAppIcon("");
    setStatus("idle");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save(event) {
    event.preventDefault();
    if (!tenantId) return;
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/admin/tenants/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, appIcon })
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
        <h2>App Icon</h2>
        <p>No tenants available.</p>
      </article>
    );
  }

  return (
    <article className="admin-panel admin-panel--wide">
      <h2>App Icon</h2>
      <p>
        The icon shown when a visitor adds this tenant&apos;s page to their home screen. Use a
        square PNG (512×512 recommended). Note: iOS only applies this on new installs — it
        can&apos;t change an icon someone already added.
      </p>

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

        <div className="admin-icon-preview" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {appIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appIcon}
              alt="App icon preview"
              width={64}
              height={64}
              style={{ borderRadius: "14px", border: "1px solid var(--border, #ddd)", objectFit: "cover" }}
            />
          ) : (
            <span className="admin-hint">No custom icon — using the default.</span>
          )}
        </div>

        <label>
          Upload PNG (max 512 KB)
          <input ref={fileInputRef} type="file" accept="image/png" onChange={onFile} />
        </label>

        <details>
          <summary>Or paste an image source</summary>
          <textarea
            value={appIcon}
            onChange={(event) => setAppIcon(event.target.value)}
            placeholder="https://… (square PNG) or data:image/png;base64,…"
            rows={3}
            style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "12px" }}
          />
        </details>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="button button--primary" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save App Icon"}
          </button>
          {appIcon ? (
            <button className="button button--secondary" type="button" onClick={clearIcon}>
              Remove icon
            </button>
          ) : null}
        </div>
        {status === "saved" ? <p className="admin-hint">Saved.</p> : null}
        {error ? <p className="admin-error">{error}</p> : null}
      </form>
    </article>
  );
}
