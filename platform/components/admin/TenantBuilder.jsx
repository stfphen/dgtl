"use client";

import { useRef, useState } from "react";
import { DEFAULT_DIRECTION_ID } from "../../lib/tenantBuilder/designDirections";
import { getVerticalPreset, listVerticalPresets } from "../../lib/tenantBuilder/verticalPresets";
import DesignDirectionPicker from "./DesignDirectionPicker";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TenantBuilder() {
  const [brandName, setBrandName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [direction, setDirection] = useState(DEFAULT_DIRECTION_ID);
  const [verticalPreset, setVerticalPreset] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { tenant, warnings }
  const fileRef = useRef(null);

  const effectiveSlug = slugEdited ? slug : slugify(brandName);

  function onBrandNameChange(value) {
    setBrandName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  // Picking a vertical pre-selects its best direction pairing
  // (directionAffinity[0]); the direction picker below still overrides it.
  function onVerticalPresetChange(id) {
    setVerticalPreset(id);
    const preset = getVerticalPreset(id);
    if (preset) setDirection(preset.directionAffinity[0]);
  }

  async function onGenerate(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("brandName", brandName);
    formData.set("slug", effectiveSlug);
    formData.set("direction", direction);
    formData.set("verticalPreset", verticalPreset);
    const files = fileRef.current?.files || [];
    for (const file of files) {
      formData.append("documents", file);
    }

    try {
      const response = await fetch("/api/admin/tenants/generate", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Generation failed (${response.status}).`);
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Network error.");
      setStatus("error");
    }
  }

  const generatedSlug = result?.tenant?.slug;

  return (
    <article className="admin-panel admin-panel--wide">
      <h2>AI Tenant Builder</h2>
      <p>
        Describe the client and attach reference files — briefs (PDF, .txt, .md) or existing landing pages
        and configs (.html, .json) to build on. Claude drafts a complete white-label funnel config and saves
        it as a <strong>draft</strong> you can preview and then publish.
      </p>

      <form className="admin-form" onSubmit={onGenerate}>
        <label>
          Brand name
          <input
            name="brandName"
            value={brandName}
            onChange={(event) => onBrandNameChange(event.target.value)}
            placeholder="Acme Content Studio"
            required
          />
        </label>

        <label>
          Slug
          <input
            name="slug"
            value={effectiveSlug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="acme-content-studio"
          />
        </label>

        <label>
          Brief / prompt
          <textarea
            name="prompt"
            rows={6}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Who is this client, what do they sell, who is the audience, what packages and pricing, tone, key differentiators..."
          />
        </label>

        <label>
          Vertical (optional): tunes section order, proof pattern, and copy framing
          <select
            name="verticalPreset"
            value={verticalPreset}
            onChange={(event) => onVerticalPresetChange(event.target.value)}
          >
            <option value="">None: generic funnel</option>
            {listVerticalPresets().map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}: {preset.blurb}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="admin-form__label">Design direction</span>
          <DesignDirectionPicker value={direction} onChange={setDirection} idPrefix="builder-direction" />
        </div>

        <label>
          Reference files (optional) — briefs or existing landing pages / configs
          <input
            ref={fileRef}
            type="file"
            name="documents"
            multiple
            accept=".pdf,.txt,.md,.markdown,.html,.htm,.json"
          />
        </label>

        <button className="button button--primary" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Generating…" : "Generate Tenant Draft"}
        </button>
      </form>

      {status === "error" ? <p className="admin-error">{error}</p> : null}

      {status === "done" && result?.tenant ? (
        <div className="tenant-builder__result">
          <h3>Draft created: {result.tenant.brandName}</h3>
          {result.tenant.headline ? <p>{result.tenant.headline}</p> : null}

          {Array.isArray(result.warnings) && result.warnings.length ? (
            <ul className="tenant-builder__warnings">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="tenant-builder__actions">
            <a
              className="button button--secondary"
              href={`/t/${generatedSlug}?preview=draft`}
              target="_blank"
              rel="noreferrer"
            >
              Preview draft
            </a>

            <form action="/api/admin/tenants/publish" method="post">
              <input type="hidden" name="tenantId" value={result.tenant.id} />
              <button className="button button--primary" type="submit">
                Publish
              </button>
            </form>
          </div>
          <p className="tenant-builder__hint">
            Publishing makes <code>/t/{generatedSlug}</code> live. Set the real domain (currently a placeholder)
            via tenant import/edit before relying on domain routing.
          </p>
        </div>
      ) : null}
    </article>
  );
}
