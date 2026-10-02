"use client";

// DGTL Pass — the Core /passes module: issue, open on a phone, watch the door.
// Design target: docs/specs/dgtl-pass/previews/admin.html. Gold marks the one
// primary action and the headline number; states use the functional palette.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, QrCode, ScanLine, Ticket, Wallet } from "lucide-react";

const RESULT_LABEL = {
  valid: ["Valid", "success"],
  recently_used: ["Already scanned", "warning"],
  used: ["Used", "error"],
  expired: ["Expired", "error"],
  not_yet_valid: ["Not valid yet", "warning"],
  revoked: ["Revoked", "error"],
  suspended: ["On hold", "error"],
  not_found: ["Unknown code", "error"],
  invalid_format: ["Not a pass", "error"]
};
const STATUS_TONE = { active: "success", scheduled: "info", used: "neutral", expired: "neutral", revoked: "error", suspended: "warning" };
const TIER_NAME = { day: "Steel", monthly: "Bronze", yearly: "Silver", vip_lifetime: "VIP", custom: "Custom" };

const newRequestId = () => `issue_${crypto.randomUUID().replace(/-/g, "")}`;
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const timeLabel = (value) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dateLabel = (value) => (value ? new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Never");

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.field = data.field;
    error.status = response.status;
    throw error;
  }
  return data;
}

function TierChip({ tier, name, accents }) {
  return (
    <span className="passes-chip" style={{ "--tier": accents[tier] || accents.custom }}>
      {name || TIER_NAME[tier] || tier}
    </span>
  );
}

function OpenOnPhone({ result, onClose }) {
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const url = result?.links?.passPageUrl;

  useEffect(() => {
    let live = true;
    if (url) {
      QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#FFFFFF" } })
        .then((svg) => live && setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
        .catch(() => live && setQr(""));
    }
    return () => {
      live = false;
    };
  }, [url]);

  if (!result) {
    return (
      <div className="passes-phone is-empty">
        <span className="passes-phone__icon" aria-hidden><QrCode size={22} strokeWidth={1.75} /></span>
        <p>Issue a pass and its QR shows here.</p>
        <small>Point your phone camera at it to open the pass, then add it to Apple Wallet.</small>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="passes-phone" aria-live="polite">
      <div className="passes-phone__head">
        <div>
          <p className="core-eyebrow">{result.replay ? "Already issued" : "Pass issued"}</p>
          <h3>{result.pass.holderName}</h3>
          <p className="passes-muted">
            {result.pass.passTypeName} · code <span className="passes-mono">{result.pass.shortCode}</span>
          </p>
        </div>
        <button type="button" className="core-button is-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="passes-qr">{qr ? <img src={qr} alt="QR code for the pass link" /> : null}</div>
      <p className="passes-phone__hint">Scan with your iPhone camera to open the pass.</p>
      <div className="core-actions passes-phone__actions">
        <a className="core-button" href={url} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden /> Open pass</a>
        <button type="button" className="core-button" onClick={copy}><Copy size={15} aria-hidden /> {copied ? "Copied" : "Copy link"}</button>
        {result.links.walletUrl ? (
          <a className="core-button" href={result.links.walletUrl}><Wallet size={15} aria-hidden /> .pkpass</a>
        ) : null}
      </div>
      <p className="passes-dim">The link is the pass. Send it only to its holder.</p>
    </div>
  );
}

export default function PassesWorkspace({ tenants, tierAccents, caps, status }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [passTypes, setPassTypes] = useState(null);
  const [passes, setPasses] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ passTypeId: "", name: "", email: "", phone: "", startDate: todayLocal() });
  const [formError, setFormError] = useState({ message: "", field: "" });
  const [issuing, setIssuing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState(null);
  const requestId = useRef(newRequestId());

  const ready = status.database && status.enabled && !status.configError && Boolean(tenantId);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const [list, numbers] = await Promise.all([
        api(`/api/admin/passes?tenantId=${encodeURIComponent(tenantId)}`),
        api(`/api/admin/passes/overview?tenantId=${encodeURIComponent(tenantId)}`)
      ]);
      setPasses(list.passes);
      setOverview(numbers);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    }
  }, [ready, tenantId]);

  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    api(`/api/admin/pass-types?tenantId=${encodeURIComponent(tenantId)}`)
      .then((data) => {
        if (!live) return;
        setPassTypes(data.passTypes);
        setForm((current) => ({ ...current, passTypeId: data.passTypes.find((type) => type.id === current.passTypeId)?.id || data.passTypes[0]?.id || "" }));
      })
      .catch((error) => live && setLoadError(error.message));
    refresh();
    // The door feed: live enough for a demo, cheap enough to leave open.
    const timer = setInterval(refresh, 10_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ready, tenantId, refresh]);

  const selectedType = useMemo(() => passTypes?.find((type) => type.id === form.passTypeId) || null, [passTypes, form.passTypeId]);

  const installPresets = async () => {
    setInstalling(true);
    try {
      const data = await api("/api/admin/pass-types", { method: "POST", body: JSON.stringify({ action: "install_presets", tenantId }) });
      setPassTypes(data.passTypes);
      setForm((current) => ({ ...current, passTypeId: data.passTypes[0]?.id || "" }));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setInstalling(false);
    }
  };

  const issue = async (event) => {
    event.preventDefault();
    if (issuing) return;
    setIssuing(true);
    setFormError({ message: "", field: "" });
    try {
      const data = await api("/api/admin/passes", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          passTypeId: form.passTypeId,
          holder: { name: form.name, email: form.email || undefined, phone: form.phone || undefined },
          startDate: form.startDate,
          issueRequestId: requestId.current
        })
      });
      setResult(data);
      // A new form render is a new request: the next click issues a new pass.
      requestId.current = newRequestId();
      setForm((current) => ({ ...current, name: "", email: "", phone: "" }));
      refresh();
    } catch (error) {
      setFormError({ message: error.message, field: error.field || "" });
    } finally {
      setIssuing(false);
    }
  };

  const showLink = async (passId) => {
    try {
      const data = await api(`/api/admin/passes/detail?passId=${encodeURIComponent(passId)}`);
      const row = passes.find((pass) => pass.id === passId);
      setResult({
        pass: { holderName: row?.holderName, passTypeName: row?.passTypeName, shortCode: row?.shortCode?.replace(/^(.{4})(.{4})$/, "$1-$2") },
        links: data.links,
        replay: true
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setLoadError(error.message);
    }
  };

  const revoke = async (passId, holderName) => {
    if (!window.confirm(`Revoke ${holderName}'s pass? It stops working at the door immediately. This can't be undone.`)) return;
    try {
      await api("/api/admin/passes/action", { method: "POST", body: JSON.stringify({ action: "revoke", passId, reason: "Revoked from Core" }) });
      refresh();
    } catch (error) {
      setLoadError(error.message);
    }
  };

  // ---- not ready: say exactly what is missing ----
  if (!status.database || !status.enabled || status.configError || !tenantId) {
    return (
      <div className="core-stack passes-stack">
        <div className={`core-notice ${status.configError ? "is-error" : "is-warning"}`} role="status">
          {status.configError ? (
            <>DGTL Pass configuration is invalid: {status.configError}</>
          ) : !status.database ? (
            <>DGTL Pass needs Postgres. Set <code>DATABASE_URL</code> and run <code>npm run migrate</code>.</>
          ) : !status.enabled ? (
            <>Set <code>PASS_PUBLIC_BASE_URL</code>, <code>PASS_CREDENTIAL_SECRETS</code> and <code>PASS_CREDENTIAL_ACTIVE_KEY</code> to issue passes. For a phone demo, run <code>npm run demo:passes</code>.</>
          ) : (
            <>This team has no tenant yet. Create one under Tenants, then come back to issue passes.</>
          )}
        </div>
      </div>
    );
  }

  const fieldError = (name) => (formError.field === name ? formError.message : "");
  const tiers = overview?.byTier || {};
  const maxTier = Math.max(1, ...Object.values(tiers));

  return (
    <div className="core-stack passes-stack">
      {loadError ? <div className="core-notice is-error" role="alert">{loadError}</div> : null}
      <div className="passes-toolbar">
        {tenants.length > 1 ? (
          <label className="passes-tenant">
            <span>Tenant</span>
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
          </label>
        ) : (
          <p className="passes-muted">Tenant · <strong>{tenants[0]?.name}</strong></p>
        )}
        <div className="core-actions">
          <span className={`core-status is-${status.walletEnabled ? "success" : "neutral"}`}>
            {status.walletEnabled ? `Apple Wallet · ${status.walletProvider}${status.walletBranding === "preset" ? " (free)" : ""}` : "Apple Wallet off"}
          </span>
          {caps.verify ? <a className="core-button" href="/scan"><ScanLine size={15} aria-hidden /> Open scanner</a> : null}
        </div>
      </div>

      <section className="passes-kpis" aria-label="Today">
        <div className="passes-kpi"><span>Active passes</span><strong className="is-gold">{overview?.active ?? "—"}</strong></div>
        <div className="passes-kpi"><span>Scans today</span><strong>{overview?.scansToday ?? "—"}</strong><small>{overview ? `${overview.admitsToday} admitted · ${overview.deniesToday} refused` : ""}</small></div>
        <div className="passes-kpi"><span>Issued today</span><strong>{overview?.issuedToday ?? "—"}</strong></div>
      </section>

      <div className="passes-issue">
        <section className="core-card">
          <header className="core-card__header"><div><h2>Issue a pass</h2><p>No email or SMS yet: open it on a phone from the QR.</p></div></header>
          <div className="core-card__body">
            {passTypes && passTypes.length === 0 ? (
              <div className="core-empty">
                <span className="core-empty__icon" aria-hidden><Ticket size={20} strokeWidth={1.75} /></span>
                <p>No pass types yet</p>
                <small>Install the five DGTL tiers: Single Entry, Day, Monthly, Annual and VIP Lifetime.</small>
                {caps.configure ? (
                  <button type="button" className="core-button is-primary" onClick={installPresets} disabled={installing}>
                    {installing ? "Installing…" : "Install DGTL pass types →"}
                  </button>
                ) : null}
              </div>
            ) : caps.issue ? (
              <form className="core-form" onSubmit={issue} noValidate>
                <label>
                  Pass type
                  <select value={form.passTypeId} onChange={(event) => setForm({ ...form, passTypeId: event.target.value })} disabled={!passTypes}>
                    {(passTypes || []).map((type) => (
                      <option key={type.id} value={type.id}>{type.name} · {TIER_NAME[type.tier] || type.tier}</option>
                    ))}
                  </select>
                </label>
                {selectedType ? (
                  <p className="passes-dim">
                    <TierChip tier={selectedType.tier} accents={tierAccents} />{" "}
                    {selectedType.validity.kind === "lifetime" ? "Never expires" : `${selectedType.validity.count} ${selectedType.validity.kind}`}
                    {selectedType.maxUses ? ` · ${selectedType.maxUses} entry` : " · re-entry allowed"}
                  </p>
                ) : null}
                <label>
                  Holder name
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Alex Rivera" autoComplete="off" aria-invalid={Boolean(fieldError("holder.name"))} required />
                  {fieldError("holder.name") ? <small className="passes-error">{fieldError("holder.name")}</small> : null}
                </label>
                <div className="core-form__row">
                  <label>
                    Email
                    <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="alex@example.com" autoComplete="off" aria-invalid={Boolean(fieldError("holder.email"))} />
                    {fieldError("holder.email") ? <small className="passes-error">{fieldError("holder.email")}</small> : null}
                  </label>
                  <label>
                    Phone
                    <input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+14165550100" autoComplete="off" aria-invalid={Boolean(fieldError("holder.phone"))} />
                    {fieldError("holder.phone") ? <small className="passes-error">{fieldError("holder.phone")}</small> : null}
                  </label>
                </div>
                <label>
                  Starts
                  <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
                </label>
                {formError.message && !formError.field.startsWith("holder.") ? <div className="core-notice is-error" role="alert">{formError.message}</div> : null}
                <div className="core-actions passes-issue__actions">
                  <button type="submit" className="core-button is-primary" disabled={issuing || !form.passTypeId}>{issuing ? "Issuing…" : "Issue pass →"}</button>
                </div>
              </form>
            ) : (
              <p className="passes-muted">Your role can view passes but not issue them.</p>
            )}
          </div>
        </section>
        <section className="core-card">
          <header className="core-card__header"><div><h2>Open on your phone</h2><p>The pass page is the pass. Wallet is a copy of it.</p></div></header>
          <div className="core-card__body"><OpenOnPhone result={result} onClose={() => setResult(null)} /></div>
        </section>
      </div>

      <div className="passes-two">
        <section className="core-card">
          <header className="core-card__header"><div><h2>Active by tier</h2></div></header>
          <div className="core-card__body passes-bars">
            {["day", "monthly", "yearly", "vip_lifetime"].map((tier) => (
              <div key={tier} className="passes-bar" style={{ "--tier": tierAccents[tier] }}>
                <span className="passes-bar__t">{TIER_NAME[tier]}</span>
                <span className="passes-bar__track"><span style={{ width: `${((tiers[tier] || 0) / maxTier) * 100}%` }} /></span>
                <span className="passes-bar__n">{tiers[tier] || 0}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="core-card">
          <header className="core-card__header"><div><h2>Live scans</h2><p>Every 10 s</p></div></header>
          {overview?.recentScans?.length ? (
            <div className="passes-table-wrap">
              <table className="core-table">
                <thead><tr><th>Time</th><th>Result</th><th>Holder</th><th>Pass</th><th>Gate</th></tr></thead>
                <tbody>
                  {overview.recentScans.map((scan) => {
                    const [label, tone] = RESULT_LABEL[scan.result] || [scan.result, "neutral"];
                    return (
                      <tr key={scan.id}>
                        <td className="passes-mono">{timeLabel(scan.at)}</td>
                        <td><span className={`core-status is-${tone}`}>{label}</span></td>
                        <td>{scan.holderName || "—"}</td>
                        <td>{scan.tier ? <TierChip tier={scan.tier} name={scan.passTypeName} accents={tierAccents} /> : <span className="passes-dim">—</span>}</td>
                        <td className="passes-dim">{scan.gate || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="core-card__body"><p className="passes-muted">No scans yet today.</p></div>
          )}
        </section>
      </div>

      <section className="core-card">
        <header className="core-card__header"><div><h2>Recent passes</h2><p>Newest first. The door checks this list on every scan.</p></div><span className="core-count">{passes.length}</span></header>
        {passes.length ? (
          <div className="passes-table-wrap">
            <table className="core-table">
              <thead><tr><th>Holder</th><th>Pass</th><th>Status</th><th>Code</th><th>Valid until</th><th>Visits</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {passes.map((pass) => (
                  <tr key={pass.id}>
                    <td><strong>{pass.holderName}</strong><br /><span className="passes-dim">{pass.holderEmail || pass.holderPhone}</span></td>
                    <td><TierChip tier={pass.tier} name={pass.passTypeName} accents={tierAccents} /></td>
                    <td><span className={`core-status is-${STATUS_TONE[pass.effectiveStatus] || "neutral"}`}>{pass.effectiveStatus}</span></td>
                    <td className="passes-mono">{pass.shortCode.replace(/^(.{4})(.{4})$/, "$1-$2")}</td>
                    <td className="passes-dim">{dateLabel(pass.validUntil)}</td>
                    <td className="core-table__num">{pass.useCount}</td>
                    <td>
                      <div className="core-actions passes-row-actions">
                        <button type="button" className="core-button is-ghost" onClick={() => showLink(pass.id)}>QR</button>
                        {caps.revoke && pass.status !== "revoked" ? (
                          <button type="button" className="core-button is-danger" onClick={() => revoke(pass.id, pass.holderName)}>Revoke</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="core-card__body"><p className="passes-muted">No passes issued yet.</p></div>
        )}
      </section>
    </div>
  );
}
