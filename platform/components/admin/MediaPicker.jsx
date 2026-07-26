"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with lib/media/validate.js

function measureImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

/**
 * One media slot: current thumbnail + expandable library grid with an upload
 * dropzone and a paste-URL escape hatch. Selection reports back via
 * onSelect({ mediaId, src, alt }) — mediaId and src are mutually exclusive
 * (mediaId wins at render time; direct src keeps video/embed/external URLs
 * working exactly as before).
 */
export default function MediaPicker({ label, value = {}, tenantId, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef(null);

  const loadAssets = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/media?tenantId=${encodeURIComponent(tenantId || "")}&kind=image`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Could not load media (${response.status}).`);
        setAssets([]);
        return;
      }
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (err) {
      setError(err?.message || "Network error.");
      setAssets([]);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open && assets === null) loadAssets();
  }, [open, assets, loadAssets]);

  async function uploadFiles(files) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Use a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large (max 10 MB).");
      return;
    }

    setUploading(true);
    try {
      const { width, height } = await measureImage(file);
      const formData = new FormData();
      formData.set("file", file);
      formData.set("tenantId", tenantId || "");
      formData.set("title", file.name);
      if (width) formData.set("width", String(width));
      if (height) formData.set("height", String(height));

      const response = await fetch("/api/admin/media", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Upload failed (${response.status}).`);
        return;
      }
      setAssets((prev) => [data.asset, ...(prev || [])]);
      onSelect({ mediaId: data.asset.id, src: "", alt: data.asset.alt || "" });
      setOpen(false);
    } catch (err) {
      setError(err?.message || "Network error.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyUrl() {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !(url.startsWith("/") && !url.startsWith("//"))) {
      setError("Use an http(s) URL or a root-relative /path.");
      return;
    }
    setError("");
    onSelect({ mediaId: "", src: url, alt: "" });
    setUrlDraft("");
    setOpen(false);
  }

  const current = value.src || "";
  const hasMediaId = Boolean(value.mediaId);

  return (
    <div className="media-picker">
      <div className="media-picker__slot">
        <span className="media-picker__label">{label}</span>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="media-picker__thumb" src={current} alt="" />
        ) : (
          <span className="media-picker__empty">{hasMediaId ? "Library asset" : "No media"}</span>
        )}
        <div className="media-picker__slot-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={disabled}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "Close" : "Change"}
          </button>
          {current || hasMediaId ? (
            <button
              className="button button--secondary"
              type="button"
              disabled={disabled}
              onClick={() => onSelect({ mediaId: "", src: "", alt: "" })}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="media-picker__panel">
          <label
            className="media-picker__dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              uploadFiles(event.dataTransfer?.files);
            }}
          >
            {uploading ? "Uploading…" : "Drop an image here or click to upload (PNG/JPEG/WebP/GIF, max 10 MB)"}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              disabled={uploading || disabled}
              onChange={(event) => uploadFiles(event.target.files)}
            />
          </label>

          {assets === null ? <p className="admin-hint">Loading library…</p> : null}
          {assets?.length ? (
            <div className="media-picker__grid">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`media-picker__asset ${value.mediaId === asset.id ? "is-selected" : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    onSelect({ mediaId: asset.id, src: "", alt: asset.alt || "" });
                    setOpen(false);
                  }}
                  title={asset.title || asset.alt || asset.id}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt={asset.alt || asset.title || ""} loading="lazy" />
                </button>
              ))}
            </div>
          ) : assets ? (
            <p className="admin-hint">No images in the library yet — upload one above.</p>
          ) : null}

          <div className="media-picker__url">
            <input
              value={urlDraft}
              placeholder="Or paste an image/video/embed URL…"
              onChange={(event) => setUrlDraft(event.target.value)}
            />
            <button
              className="button button--secondary"
              type="button"
              disabled={disabled || !urlDraft.trim()}
              onClick={applyUrl}
            >
              Use URL
            </button>
          </div>

          {error ? <p className="admin-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
