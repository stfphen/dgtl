"use client";

import { useState } from "react";

const KIND_BLURBS = {
  video: "Loops this video.",
  playlist: "Plays the playlist in order, looping.",
  channel: "Plays the channel's uploads shuffled, looping."
};

function describe(heroVideo) {
  if (!heroVideo?.kind) return "";
  return KIND_BLURBS[heroVideo.kind] || "";
}

/**
 * Hero video slot: paste a YouTube video / playlist / channel link, Detect
 * (server-side resolution via /api/admin/media/youtube-resolve), pick
 * video-vs-playlist when the link names both, then save through the edit
 * route's deterministic patch mode. The hero video always plays muted; the
 * hero image stays as the poster/fallback.
 */
export default function YouTubeHeroInput({ current, onSave, disabled }) {
  const [urlDraft, setUrlDraft] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState(null); // { heroVideo, meta }
  const [prefer, setPrefer] = useState("video");

  const active = current?.kind ? current : null;

  async function detect(nextPrefer) {
    const url = urlDraft.trim();
    if (!url) return;
    setResolving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/media/youtube-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...(nextPrefer ? { prefer: nextPrefer } : {}) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || `Could not resolve that link (${response.status}).`);
        setCandidate(null);
        return;
      }
      setCandidate(data);
      if (nextPrefer) setPrefer(nextPrefer);
      else setPrefer(data.heroVideo.kind === "playlist" ? "playlist" : "video");
    } catch (err) {
      setError(err?.message || "Network error.");
      setCandidate(null);
    } finally {
      setResolving(false);
    }
  }

  async function useAsHero() {
    if (!candidate) return;
    const saved = await onSave(candidate.heroVideo);
    if (saved) {
      setCandidate(null);
      setUrlDraft("");
    }
  }

  function removeVideo() {
    return onSave({ url: "", kind: "", videoId: "", playlistId: "" });
  }

  const bothDetected = Boolean(candidate?.meta?.detected?.videoId && candidate?.meta?.detected?.playlistId);

  return (
    <div className="media-picker youtube-hero">
      <div className="media-picker__slot">
        <span className="media-picker__label">Hero video (YouTube)</span>
        {active ? (
          <span className="youtube-hero__current">
            {active.kind === "video" ? "Video" : active.kind === "playlist" ? "Playlist" : "Channel"}
            {" — "}
            {describe(active)}{" "}
            {active.url ? (
              <a href={active.url} target="_blank" rel="noopener noreferrer">
                open
              </a>
            ) : null}
          </span>
        ) : (
          <span className="media-picker__empty">None — hero shows the image.</span>
        )}
        {active ? (
          <div className="media-picker__slot-actions">
            <button className="button button--secondary" type="button" disabled={disabled} onClick={removeVideo}>
              Remove video
            </button>
          </div>
        ) : null}
      </div>

      <div className="media-picker__url">
        <input
          value={urlDraft}
          placeholder="Paste a YouTube video, playlist, or channel link…"
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              detect();
            }
          }}
        />
        <button
          className="button button--secondary"
          type="button"
          disabled={disabled || resolving || !urlDraft.trim()}
          onClick={() => detect()}
        >
          {resolving ? "Detecting…" : "Detect"}
        </button>
      </div>

      {candidate ? (
        <div className="youtube-hero__candidate">
          {candidate.meta?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="media-picker__thumb" src={candidate.meta.thumbnail} alt="" />
          ) : null}
          <div className="youtube-hero__candidate-body">
            <strong>
              {candidate.heroVideo.kind === "video"
                ? "Video"
                : candidate.heroVideo.kind === "playlist"
                  ? "Playlist"
                  : "Channel"}
              {candidate.meta?.title ? ` — ${candidate.meta.title}` : ""}
            </strong>
            <span className="admin-hint">{describe(candidate.heroVideo)}</span>
            {bothDetected ? (
              <div className="youtube-hero__prefer" role="radiogroup" aria-label="Use as">
                <label>
                  <input
                    type="radio"
                    name="youtube-prefer"
                    checked={prefer === "video"}
                    onChange={() => detect("video")}
                  />
                  Just this video
                </label>
                <label>
                  <input
                    type="radio"
                    name="youtube-prefer"
                    checked={prefer === "playlist"}
                    onChange={() => detect("playlist")}
                  />
                  The whole playlist
                </label>
              </div>
            ) : null}
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={disabled || resolving}
            onClick={useAsHero}
          >
            Use as hero
          </button>
        </div>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-hint">
        Background video always plays muted (browser autoplay rules); the hero image stays as the
        poster and fallback. Channel mode shuffles the channel&apos;s uploads (up to YouTube&apos;s
        200-video embed cap).
      </p>
    </div>
  );
}
