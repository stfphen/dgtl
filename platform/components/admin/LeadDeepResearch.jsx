"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function ConfidencePill({ level }) {
  return <span className={`research-pill research-pill--${level || "unverified"}`}>{level || "unverified"}</span>;
}

function ContactList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="research-group">
      <strong>{title}</strong>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <span>{item.value}</span> <ConfidencePill level={item.confidence} />
            {item.sourceUrl ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer"> source</a>
            ) : null}
            {item.note ? <small> — {item.note}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared presentational view — reused by ResearchFromQuery.
export function DossierView({ dossier, reviewFlags }) {
  if (!dossier) return null;
  const web = dossier.webPresence || {};
  const site = web.confirmedWebsite || {};
  return (
    <div className="research-dossier">
      {dossier.businessProfile?.summary ? (
        <p className="research-summary">
          {dossier.businessProfile.summary} <ConfidencePill level={dossier.businessProfile.confidence} />
        </p>
      ) : null}

      {site.url ? (
        <div className="research-group">
          <strong>Confirmed website</strong>
          <a href={site.url} target="_blank" rel="noreferrer">{site.url}</a> <ConfidencePill level={site.confidence} />
        </div>
      ) : null}

      <ContactList title="Emails" items={dossier.verifiedContacts?.emails} />
      <ContactList title="Phones" items={dossier.verifiedContacts?.phones} />

      {dossier.decisionMakers?.length ? (
        <div className="research-group">
          <strong>Decision-makers</strong>
          <ul>
            {dossier.decisionMakers.map((dm, i) => (
              <li key={i}>
                {dm.name}{dm.title ? `, ${dm.title}` : ""} <ConfidencePill level={dm.confidence} />
                {dm.sourceUrl ? <a href={dm.sourceUrl} target="_blank" rel="noreferrer"> source</a> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {web.socialProfiles?.length ? (
        <div className="research-group">
          <strong>Social</strong>
          <ul>
            {web.socialProfiles.map((s, i) => (
              <li key={i}>
                {s.platform}: <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dossier.servicesOffered?.length ? (
        <div className="research-group">
          <strong>Services</strong>
          <p>{dossier.servicesOffered.map((s) => s.name).join(", ")}</p>
        </div>
      ) : null}

      {dossier.signals?.length ? (
        <div className="research-group">
          <strong>Signals</strong>
          <ul>
            {dossier.signals.map((s, i) => (
              <li key={i}>[{s.type}] {s.detail}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dossier.suggestedOffer?.summary ? (
        <div className="research-group">
          <strong>Suggested offer</strong>
          <p>{dossier.suggestedOffer.summary}{dossier.suggestedOffer.rationale ? ` — ${dossier.suggestedOffer.rationale}` : ""}</p>
        </div>
      ) : null}

      {reviewFlags?.length ? (
        <div className="research-group research-group--review">
          <strong>Needs review ({reviewFlags.length})</strong>
          <ul>
            {reviewFlags.map((f, i) => (
              <li key={i}>
                {f.field}: {f.value} <ConfidencePill level={f.confidence} /> <small>({f.reason})</small>
                {f.sourceUrl ? <a href={f.sourceUrl} target="_blank" rel="noreferrer"> source</a> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dossier.citations?.length ? (
        <div className="research-group research-citations">
          <strong>Citations</strong>
          <ol>
            {dossier.citations.map((c, i) => (
              <li key={i}><a href={c.url} target="_blank" rel="noreferrer">{c.title || c.url}</a></li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default function LeadDeepResearch({ leadId, initialDossier = null, initialReviewFlags = [] }) {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [dossier, setDossier] = useState(initialDossier);
  const [reviewFlags, setReviewFlags] = useState(initialReviewFlags || []);

  async function onResearch() {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/admin/leads/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Research failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setDossier(data.dossier);
      setReviewFlags(data.reviewFlags || []);
      setStatus("done");
      router.refresh(); // reflect any auto-applied field fills
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  return (
    <div className="lead-research">
      <div className="lead-research__bar">
        <strong>AI Deep Research</strong>
        <button type="button" className="button button--secondary" onClick={onResearch} disabled={status === "loading"}>
          {status === "loading" ? "Researching…" : dossier ? "Re-run research" : "Deep Research"}
        </button>
      </div>
      {status === "error" ? <p className="admin-error">{error}</p> : null}
      <DossierView dossier={dossier} reviewFlags={reviewFlags} />
    </div>
  );
}
