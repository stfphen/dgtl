"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Gate labels + order (kept local to avoid bundling server modules into the client).
const GATE_LABELS = {
  sourced: "Sourced",
  gate1_approved: "Gate 1 approved",
  researched: "Researched",
  scoped: "Campaign scoped",
  gate2_approved: "Gate 2 approved",
  in_outreach: "In outreach",
  deprioritized: "Deprioritized"
};
const GATE_ORDER = ["sourced", "gate1_approved", "researched", "scoped", "gate2_approved", "in_outreach"];

function fitClass(score) {
  if (score >= 80) return "research-pill research-pill--verified";
  if (score >= 60) return "research-pill research-pill--high";
  if (score >= 40) return "research-pill research-pill--medium";
  return "research-pill research-pill--low";
}

function tierLabel(tier) {
  if (tier === 1) return "Tier 1";
  if (tier === 2) return "Tier 2";
  if (tier === 3) return "Tier 3";
  return "Below ICP";
}

export default function AccountsPanel({ accounts = [], campaigns = [] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [previews, setPreviews] = useState([]);
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [searched, setSearched] = useState(false);
  const [note, setNote] = useState("");

  const campaignsByAccount = useMemo(() => {
    const map = {};
    for (const c of campaigns) {
      (map[c.accountId] = map[c.accountId] || []).push(c);
    }
    return map;
  }, [campaigns]);

  const grouped = useMemo(() => {
    const g = {};
    for (const a of accounts) {
      const key = a.gateStatus || "sourced";
      (g[key] = g[key] || []).push(a);
    }
    return g;
  }, [accounts]);

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
    return data;
  }

  async function doSearch() {
    setStatus("loading");
    setError("");
    setNote("");
    try {
      const data = await postJson("/api/admin/accounts/search", { query, segment });
      setPreviews(data.results || []);
      setSelected({});
      setSearched(true);
      setNote(data.note || "");
      setStatus("idle");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  async function doImport() {
    const chosen = previews.filter((_, i) => selected[i]);
    if (!chosen.length) {
      setError("Select at least one account to import.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      await postJson("/api/admin/accounts", { accounts: chosen });
      setPreviews([]);
      setSelected({});
      setStatus("idle");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  async function doAction(accountId, action, extra = {}) {
    setBusyId(accountId);
    setError("");
    try {
      await postJson("/api/admin/accounts/action", { accountId, action, ...extra });
      router.refresh();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    } finally {
      setBusyId("");
    }
  }

  return (
    <article className="admin-panel admin-panel--wide">
      <div className="pipeline-header">
        <div>
          <h2>Enterprise Accounts</h2>
          <p>Account-based prospecting: source &rarr; Gate 1 &rarr; research &rarr; scope &rarr; Gate 2 &rarr; outreach.</p>
        </div>
        <span className="status-pill">{accounts.length} accounts</span>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {/* Source / triage */}
      <section className="admin-form" style={{ marginBottom: "1rem" }}>
        <h3>Source accounts</h3>
        <div className="inline-form" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Industry, geo, or name (e.g. SaaS, Toronto)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: "1 1 220px" }}
          />
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">Any segment</option>
            <option value="enterprise">Enterprise (1000+)</option>
            <option value="mid-market">Mid-market (200–1000)</option>
          </select>
          <button type="button" className="button button--primary" onClick={doSearch} disabled={status === "loading"}>
            {status === "loading" ? "Searching…" : "Search"}
          </button>
        </div>

        <p className="muted" style={{ marginTop: "0.4rem", fontSize: "0.85em" }}>
          Tip: search runs on the offline demo set (6 sample accounts). Try an empty search to see all,
          or terms like <em>saas</em>, <em>health</em>, <em>logistics</em>, <em>Toronto</em>. Real
          provider/open-DB sourcing slots in here next.
        </p>

        {status === "loading" ? <p className="muted" style={{ marginTop: "0.5rem" }}>Searching…</p> : null}

        {status !== "loading" && searched && previews.length === 0 ? (
          <p className="admin-notice" style={{ marginTop: "0.5rem" }}>
            No matching accounts in the demo set{query ? ` for “${query}”` : ""}. Clear the box and search
            again to see all 6, or try <em>saas</em> / <em>health</em> / <em>logistics</em>.
          </p>
        ) : null}

        {previews.length ? (
          <div style={{ marginTop: "0.75rem" }}>
            <ul className="outreach-list">
              {previews.map((p, i) => (
                <li key={`${p.domain}-${i}`} className="outreach-list-row">
                  <label className="admin-check" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      onChange={(e) => setSelected((s) => ({ ...s, [i]: e.target.checked }))}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{p.name}</strong> <span className="muted">· {p.segment} · {p.firmographics?.industry}</span>
                    </span>
                    <span className={fitClass(p.fitScore)}>{p.fitScore} · {tierLabel(p.tier)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="button button--primary" onClick={doImport} disabled={status === "loading"}>
              Import selected
            </button>
          </div>
        ) : null}
      </section>

      {/* Gate board */}
      {GATE_ORDER.map((gate) => {
        const list = grouped[gate] || [];
        if (!list.length) return null;
        return (
          <section key={gate} style={{ marginBottom: "1rem" }}>
            <div className="pipeline-header">
              <h3>{GATE_LABELS[gate]}</h3>
              <span className="status-pill">{list.length}</span>
            </div>
            {list.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                campaigns={campaignsByAccount[a.id] || []}
                busy={busyId === a.id}
                onAction={doAction}
              />
            ))}
          </section>
        );
      })}

      {accounts.length === 0 ? (
        <p className="muted">No accounts yet. Source and import some above to start the pipeline.</p>
      ) : null}
    </article>
  );
}

function AccountCard({ account, campaigns, busy, onAction }) {
  const a = account;
  const committee = Array.isArray(a.buyingCommittee) ? a.buyingCommittee : [];
  const signals = Array.isArray(a.signals) ? a.signals : [];
  const gaps = Array.isArray(a.dataGaps) ? a.dataGaps : [];
  const draftCampaign = campaigns.find((c) => c.status === "draft") || campaigns[0];

  return (
    <div className="outreach-card" style={{ marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <div>
          <strong>{a.name}</strong>{" "}
          <span className="muted">{a.domain} · {a.segment}</span>
          <div className="muted" style={{ fontSize: "0.85em" }}>{a.fitRationale}</div>
        </div>
        <span className={fitClass(a.fitScore || 0)}>{a.fitScore ?? "—"} · {tierLabel(a.tier)}</span>
      </div>

      {committee.length ? (
        <div style={{ marginTop: "0.4rem", fontSize: "0.9em" }}>
          <em>Committee:</em>{" "}
          {committee.map((c, i) => (
            <span key={i}>
              {c.name || "(unnamed)"} ({c.title || c.roleLabel})
              {c.email ? (
                <span className={`status-pill status-pill--${c.emailStatus === "verified" ? "ok" : "warn"}`} style={{ marginLeft: 4 }}>
                  {c.emailStatus}
                </span>
              ) : null}
              {i < committee.length - 1 ? "; " : ""}
            </span>
          ))}
        </div>
      ) : null}

      {signals.length ? (
        <div style={{ marginTop: "0.4rem", fontSize: "0.9em" }}>
          <em>Signals:</em> {signals.map((s) => s.type).join(", ")}
        </div>
      ) : null}

      {gaps.length ? (
        <div className="admin-error" style={{ marginTop: "0.4rem", fontSize: "0.85em" }}>
          Gaps: {gaps.join(" ")}
        </div>
      ) : null}

      {a.dossier?.businessProfile?.summary ? (
        <div className="research-group" style={{ marginTop: "0.5rem" }}>
          <strong>Research summary</strong>
          <div style={{ fontSize: "0.9em" }}>{a.dossier.businessProfile.summary}</div>
          <div className="muted" style={{ fontSize: "0.8em", marginTop: 4 }}>
            {a.dossier.source === "mock" ? "Offline dossier" : "AI research"}
            {a.dossier.businessProfile.confidence ? ` · ${a.dossier.businessProfile.confidence} confidence` : ""}
            {a.dossier.generatedAt ? ` · ${new Date(a.dossier.generatedAt).toLocaleDateString()}` : ""}
            {a.dossier.compliance?.publicDataOnly ? " · public data only" : ""}
          </div>
        </div>
      ) : null}

      {draftCampaign ? (
        <div className="research-group" style={{ marginTop: "0.5rem" }}>
          <strong>
            {draftCampaign.name}
            {draftCampaign.status ? (
              <span
                className={`status-pill status-pill--${draftCampaign.status === "approved" ? "won" : "warn"}`}
                style={{ marginLeft: 6 }}
              >
                {draftCampaign.status}
              </span>
            ) : null}
          </strong>
          <div style={{ fontSize: "0.9em" }}>{draftCampaign.bigIdea}</div>
          {Array.isArray(draftCampaign.deliverables) && draftCampaign.deliverables.length ? (
            <div style={{ fontSize: "0.85em", marginTop: 6 }}>
              <em>Deliverables:</em>
              <ul>
                {draftCampaign.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {draftCampaign.budgetBand ? (
            <div className="muted" style={{ fontSize: "0.85em", marginTop: 4 }}>
              <em>Budget:</em> {draftCampaign.budgetBand}
              {draftCampaign.budgetRationale ? ` — ${draftCampaign.budgetRationale}` : ""}
            </div>
          ) : null}
          {draftCampaign.successMetric ? (
            <div className="muted" style={{ fontSize: "0.85em", marginTop: 2 }}>
              <em>Success metric:</em> {draftCampaign.successMetric}
            </div>
          ) : null}
          {draftCampaign.outreachOpener ? (
            <div style={{ fontSize: "0.85em", marginTop: 6, fontStyle: "italic", color: "var(--fg-muted)" }}>
              <em style={{ fontStyle: "normal" }}>Outreach opener:</em> “{draftCampaign.outreachOpener}”
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <button type="button" className="button button--secondary" onClick={() => onAction(a.id, "score")} disabled={busy}>
          Re-score
        </button>
        {a.gateStatus === "sourced" ? (
          <button type="button" className="button button--primary" onClick={() => onAction(a.id, "approve")} disabled={busy}>
            Approve (Gate 1)
          </button>
        ) : null}
        {a.gateStatus === "gate1_approved" ? (
          <button type="button" className="button button--primary" onClick={() => onAction(a.id, "research")} disabled={busy}>
            {busy ? "Researching…" : "Research"}
          </button>
        ) : null}
        {a.gateStatus === "researched" ? (
          <button type="button" className="button button--primary" onClick={() => onAction(a.id, "scope")} disabled={busy}>
            Scope campaign
          </button>
        ) : null}
        {a.gateStatus === "scoped" && draftCampaign ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => onAction(a.id, "approve-campaign", { campaignId: draftCampaign.id })}
            disabled={busy}
          >
            Approve campaign + promote (Gate 2)
          </button>
        ) : null}
        {a.gateStatus === "gate2_approved" || a.gateStatus === "in_outreach" ? (
          <span className="status-pill status-pill--won">Contacts in pipeline →</span>
        ) : null}
      </div>
    </div>
  );
}
