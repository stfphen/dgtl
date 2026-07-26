"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DesignDirectionPicker from "./DesignDirectionPicker";
import MediaSlots from "./MediaSlots";

/**
 * Per-section scalar copy fields editable as plain forms. Arrays (packages,
 * FAQ items, steps) are edited via the natural-language prompt box — the model
 * path handles structure; forms handle quick copy tweaks.
 */
const SECTION_FORMS = [
  {
    section: "brand",
    label: "Brand",
    fields: [
      { key: "name", label: "Brand name" },
      { key: "eyebrow", label: "Hero eyebrow" },
      { key: "logoText", label: "Wordmark text" },
      { key: "tagline", label: "Tagline" }
    ]
  },
  {
    section: "hero",
    label: "Hero",
    fields: [
      { key: "headline", label: "Headline" },
      { key: "subheadline", label: "Subheadline", kind: "textarea" },
      { key: "primaryCta", label: "Primary CTA" },
      { key: "secondaryCta", label: "Secondary CTA" }
    ]
  },
  {
    section: "problem",
    label: "Problem",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "points", label: "Points (one per line)", kind: "lines" }
    ]
  },
  {
    section: "system",
    label: "System",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "body", label: "Body", kind: "textarea" }
    ]
  },
  {
    section: "process",
    label: "Process",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" }
    ]
  },
  {
    section: "output",
    label: "Output",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "body", label: "Body", kind: "textarea" }
    ]
  },
  {
    section: "packageSection",
    label: "Packages intro",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "body", label: "Body", kind: "textarea" }
    ]
  },
  {
    section: "enterprise",
    label: "Enterprise band",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "body", label: "Body", kind: "textarea" },
      { key: "cta", label: "CTA" }
    ]
  },
  {
    section: "faq",
    label: "FAQ intro",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" }
    ]
  },
  {
    section: "finalCta",
    label: "Final CTA",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "headline", label: "Headline" },
      { key: "body", label: "Body", kind: "textarea" },
      { key: "cta", label: "CTA" }
    ]
  },
  {
    section: "mobileCta",
    label: "Mobile bar",
    fields: [
      { key: "primary", label: "Primary label" },
      { key: "secondary", label: "Secondary label" }
    ]
  }
];

function formStateFromDraft(draft) {
  const state = {};
  for (const spec of SECTION_FORMS) {
    for (const field of spec.fields) {
      const value = draft?.[spec.section]?.[field.key];
      state[`${spec.section}.${field.key}`] =
        field.kind === "lines" ? (Array.isArray(value) ? value.join("\n") : "") : value ?? "";
    }
  }
  return state;
}

function DiffSummary({ changes }) {
  if (!changes) return null;
  if (!changes.length) return <p className="admin-hint">No fields changed.</p>;
  return (
    <ul className="tenant-editor__diff">
      {changes.map((change, index) => (
        <li key={`${change.path}-${index}`}>
          <code>{change.path}</code>
          <span className="tenant-editor__diff-before">{change.before || "(empty)"}</span>
          <span aria-hidden="true"> → </span>
          <span className="tenant-editor__diff-after">{change.after || "(empty)"}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TenantEditor({ tenants = [] }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState("");
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [formValues, setFormValues] = useState({});
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(""); // "" | "load" | "ai" | section key
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [changes, setChanges] = useState(null);

  const selected = useMemo(() => tenants.find((t) => t.id === tenantId) || null, [tenants, tenantId]);

  const loadDraft = useCallback(async (id) => {
    if (!id) return;
    setBusy("load");
    setLoadError("");
    try {
      const response = await fetch(`/api/admin/tenants/edit?tenantId=${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data?.error || `Could not load tenant (${response.status}).`);
        setDraft(null);
        return;
      }
      setDraft(data.draft);
      setMeta(data.tenant);
      setFormValues(formStateFromDraft(data.draft));
    } catch (err) {
      setLoadError(err?.message || "Network error.");
      setDraft(null);
    } finally {
      setBusy("");
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      setWarnings([]);
      setChanges(null);
      setError("");
      loadDraft(tenantId);
    } else {
      setDraft(null);
      setMeta(null);
    }
  }, [tenantId, loadDraft]);

  async function postEdit(body, busyKey) {
    setBusy(busyKey);
    setError("");
    try {
      const response = await fetch("/api/admin/tenants/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...body })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Edit failed (${response.status}).`);
        if (Array.isArray(data?.changes)) setChanges(data.changes);
        if (Array.isArray(data?.warnings)) setWarnings(data.warnings);
        return false;
      }
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setChanges(Array.isArray(data.changes) ? data.changes : []);
      await loadDraft(tenantId);
      router.refresh();
      return true;
    } catch (err) {
      setError(err?.message || "Network error.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function onPromptEdit(event) {
    event.preventDefault();
    if (!instruction.trim()) return;
    const ok = await postEdit({ instruction: instruction.trim() }, "ai");
    if (ok) setInstruction("");
  }

  function saveSection(spec) {
    const patchSection = {};
    for (const field of spec.fields) {
      const raw = formValues[`${spec.section}.${field.key}`];
      patchSection[field.key] =
        field.kind === "lines"
          ? String(raw || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : raw;
    }
    return postEdit({ patch: { [spec.section]: patchSection } }, spec.section);
  }

  function switchDirection(directionId) {
    if (draft && directionId !== draft.design?.direction) {
      postEdit({ patch: { design: { direction: directionId } } }, "design");
    }
  }

  if (!tenants.length) {
    return (
      <article className="admin-panel admin-panel--wide">
        <h2>Tenant Editor</h2>
        <p>No tenants available.</p>
      </article>
    );
  }

  return (
    <article className="admin-panel admin-panel--wide tenant-editor">
      <h2>Tenant Editor</h2>
      <p>
        Open any tenant and refine it — prompt Claude with an edit (&ldquo;shorten the hero
        headline&rdquo;, &ldquo;swap the FAQ and process sections&rdquo;), tweak copy field by field,
        switch the design direction, or swap media. Published tenants edit a <strong>draft</strong> copy;
        republish to go live.
      </p>

      <div className="admin-form">
        <label>
          Tenant
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            <option value="">Select a tenant…</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} — {tenant.status}
                {tenant.hasPublished ? " (published)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {busy === "load" ? <p className="admin-hint">Loading draft…</p> : null}
      {loadError ? <p className="admin-error">{loadError}</p> : null}

      {draft && selected ? (
        <div className="tenant-editor__body">
          <form className="admin-form" onSubmit={onPromptEdit}>
            <label>
              Edit with a prompt
              <textarea
                rows={3}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder='e.g. "shorten the hero headline", "make the FAQ answers more direct", "make the palette warmer"'
              />
            </label>
            <button className="button button--primary" type="submit" disabled={Boolean(busy)}>
              {busy === "ai" ? "Applying…" : "Apply edit"}
            </button>
          </form>

          {error ? <p className="admin-error">{error}</p> : null}
          {warnings.length ? (
            <ul className="tenant-builder__warnings">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <DiffSummary changes={changes} />

          <div>
            <span className="admin-form__label">Design direction</span>
            <p className="admin-hint">
              Switching restyles the page instantly — copy is untouched.
            </p>
            <DesignDirectionPicker
              value={draft.design?.direction || "premium-agency"}
              onChange={switchDirection}
              idPrefix="editor-direction"
            />
          </div>

          <MediaSlots draft={draft} tenantId={tenantId} postEdit={postEdit} busy={busy} />

          <div className="tenant-editor__sections">
            <span className="admin-form__label">Section copy</span>
            {SECTION_FORMS.map((spec) => (
              <details key={spec.section} className="tenant-editor__section">
                <summary>{spec.label}</summary>
                <div className="admin-form">
                  {spec.fields.map((field) => {
                    const stateKey = `${spec.section}.${field.key}`;
                    const value = formValues[stateKey] ?? "";
                    return (
                      <label key={stateKey}>
                        {field.label}
                        {field.kind === "textarea" || field.kind === "lines" ? (
                          <textarea
                            rows={field.kind === "lines" ? 4 : 3}
                            value={value}
                            onChange={(event) =>
                              setFormValues((prev) => ({ ...prev, [stateKey]: event.target.value }))
                            }
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(event) =>
                              setFormValues((prev) => ({ ...prev, [stateKey]: event.target.value }))
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => saveSection(spec)}
                  >
                    {busy === spec.section ? "Saving…" : `Save ${spec.label}`}
                  </button>
                </div>
              </details>
            ))}
          </div>

          <div className="tenant-builder__actions">
            <a
              className="button button--secondary"
              href={`/t/${selected.slug}?preview=draft`}
              target="_blank"
              rel="noreferrer"
            >
              Preview draft
            </a>
            <form action="/api/admin/tenants/publish" method="post">
              <input type="hidden" name="tenantId" value={selected.id} />
              <button className="button button--primary" type="submit">
                {meta?.hasPublished ? "Republish" : "Publish"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}
