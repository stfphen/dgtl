"use client";

import MediaPicker from "./MediaPicker";
import YouTubeHeroInput from "./YouTubeHeroInput";

/**
 * Every media slot of the tenant draft, each backed by a MediaPicker and
 * persisted through the edit route's deterministic patch mode. Selecting a
 * library asset stores its mediaId (resolved to a url at render time);
 * pasting a URL stores a direct src. Two clicks: Change → pick.
 */
export default function MediaSlots({ draft, tenantId, postEdit, busy }) {
  const items = Array.isArray(draft.portfolio?.items) ? draft.portfolio.items : [];
  const logos = Array.isArray(draft.references?.logos) ? draft.references.logos : [];
  const disabled = Boolean(busy);

  function saveHero(selection) {
    return postEdit(
      {
        patch: {
          media: {
            heroImageId: selection.mediaId,
            // A pasted URL replaces the direct src; picking a library asset
            // keeps the existing src as the render-time fallback.
            ...(selection.src ? { heroImage: selection.src } : {}),
            ...(!selection.mediaId && !selection.src ? { heroImage: "" } : {})
          }
        }
      },
      "media"
    );
  }

  function saveHeroVideo(heroVideo) {
    return postEdit({ patch: { media: { heroVideo } } }, "media");
  }

  function savePortfolioItem(index, selection) {
    const next = items.map((item, i) =>
      i === index
        ? {
            ...item,
            mediaId: selection.mediaId,
            ...(selection.src ? { src: selection.src } : {}),
            ...(!selection.mediaId && !selection.src ? { src: "" } : {}),
            ...(selection.alt && !item.alt ? { alt: selection.alt } : {})
          }
        : item
    );
    return postEdit({ patch: { portfolio: { items: next } } }, "media");
  }

  function saveLogo(index, selection) {
    const next = logos.map((logo, i) =>
      i === index
        ? {
            ...logo,
            mediaId: selection.mediaId,
            ...(selection.src ? { src: selection.src } : {}),
            ...(!selection.mediaId && !selection.src ? { src: "" } : {})
          }
        : logo
    );
    return postEdit({ patch: { references: { logos: next } } }, "media");
  }

  return (
    <div className="tenant-editor__media">
      <span className="admin-form__label">Media</span>
      <p className="admin-hint">
        Swap any slot from the team library or a URL. Clearing both leaves the slot empty (portfolio
        items and logos without any media are removed on save).
      </p>

      <MediaPicker
        label="Hero image"
        tenantId={tenantId}
        disabled={disabled}
        value={{ mediaId: draft.media?.heroImageId || "", src: draft.media?.heroImage || "" }}
        onSelect={saveHero}
      />

      <YouTubeHeroInput
        current={draft.media?.heroVideo}
        disabled={disabled}
        onSave={saveHeroVideo}
      />

      {items.map((item, index) => (
        <MediaPicker
          key={item.id || index}
          label={`Portfolio: ${item.title || `item ${index + 1}`}`}
          tenantId={tenantId}
          disabled={disabled}
          value={{ mediaId: item.mediaId || "", src: item.src || "" }}
          onSelect={(selection) => savePortfolioItem(index, selection)}
        />
      ))}

      {logos.map((logo, index) => (
        <MediaPicker
          key={logo.src || logo.mediaId || index}
          label={`Logo: ${logo.name || `logo ${index + 1}`}`}
          tenantId={tenantId}
          disabled={disabled}
          value={{ mediaId: logo.mediaId || "", src: logo.src || "" }}
          onSelect={(selection) => saveLogo(index, selection)}
        />
      ))}
    </div>
  );
}
