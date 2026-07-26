"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DossierView } from "./LeadDeepResearch";

// Entry point #2 — research a business from just a name + city, creating a lead on command.
export default function ResearchFromQuery() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { lead, dossier, reviewFlags }

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/leads/research-from-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, city })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Research failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
      router.refresh(); // surface the newly created lead in the pipeline
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  return (
    <article className="admin-panel">
      <h3>Research from a query</h3>
      <p>Enter a business name and city. Claude researches it live and creates a fully-researched lead — no website or domain needed.</p>
      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          Business name
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Glow Medspa" required />
        </label>
        <label>
          City / area
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin, TX" />
        </label>
        <button className="button button--primary" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Researching…" : "Research & create lead"}
        </button>
      </form>
      {status === "error" ? <p className="admin-error">{error}</p> : null}
      {status === "done" && result?.dossier ? (
        <div className="research-from-query__result">
          <p>Created lead for <strong>{result.lead?.businessName}</strong>.</p>
          <DossierView dossier={result.dossier} reviewFlags={result.reviewFlags} />
        </div>
      ) : null}
    </article>
  );
}
