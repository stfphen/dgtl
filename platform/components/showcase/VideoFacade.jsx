"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import styles from "./Showcase.module.css";

// Click-to-load YouTube facade: renders the real video thumbnail (hot-linked
// from img.youtube.com) and swaps in a youtube-nocookie iframe only after the
// visitor presses play. Plain <img> on purpose — remote hosts aren't in
// next/image's allowlist (same precedent as FunnelPage's SmartImage).
export default function VideoFacade({ videoId, title, caption }) {
  const [playing, setPlaying] = useState(false);

  if (!videoId) return null;

  if (playing) {
    return (
      <div className={styles.playerFrame}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.facade}
      onClick={() => setPlaying(true)}
      aria-label={title ? `Play: ${title}` : "Play video"}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        loading="lazy"
        onError={(event) => {
          // Not every video has a maxres thumbnail; hqdefault always exists.
          const fallback = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
        }}
      />
      <span className={styles.facadePlay} aria-hidden="true">
        <Play size={26} fill="currentColor" strokeWidth={0} />
      </span>
      {(title || caption) && (
        <span className={styles.facadeMeta}>
          {title && <span className={styles.facadeTitle}>{title}</span>}
          {caption && <span className={styles.facadeCaption}>{caption}</span>}
        </span>
      )}
    </button>
  );
}
