/**
 * YouTube URL parsing + hero-video config sanitization. Pure and isomorphic —
 * used by the admin picker (client), the resolve route (server), and tenant
 * config validation.
 *
 * Hero video config shape (stored on tenant.media.heroVideo, pre-resolved so
 * rendering never does network work):
 *   { url, kind: "" | "video" | "playlist" | "channel", videoId, playlistId }
 * For kind "channel", playlistId holds the channel's uploads playlist
 * ("UU" + channelId.slice(2)) — the player shuffles it for random channel play.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com"
]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{12,50}$/;
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE_PATTERN = /^[A-Za-z0-9._-]{2,60}$/;

export const HERO_VIDEO_KINDS = new Set(["video", "playlist", "channel"]);

export const EMPTY_HERO_VIDEO = Object.freeze({
  url: "",
  kind: "",
  videoId: "",
  playlistId: ""
});

// Content aspect ratios outside this range are junk (legit content spans
// ~9:16 shorts to ~2.4:1 cinema).
const MIN_ASPECT = 0.4;
const MAX_ASPECT = 4;

function validAspect(value) {
  const aspect = Number(value);
  if (!Number.isFinite(aspect) || aspect < MIN_ASPECT || aspect > MAX_ASPECT) return 0;
  return Math.round(aspect * 10000) / 10000;
}

function parseUrlLoose(input) {
  const raw = String(input || "").trim();
  if (!raw || raw.length > 500) return null;
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      return url;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function validVideoId(value) {
  const id = String(value || "");
  return VIDEO_ID_PATTERN.test(id) ? id : "";
}

// YouTube "mixes" (RD… list ids) are session-generated radio playlists and
// cannot be embedded — treat them as absent.
function validPlaylistId(value) {
  const id = String(value || "");
  if (!PLAYLIST_ID_PATTERN.test(id) || id.startsWith("RD")) return "";
  return id;
}

/**
 * Derive a channel's public "uploads" playlist from its channel id.
 * Returns "" for anything that isn't a UC… channel id.
 */
export function uploadsPlaylistFor(channelId) {
  const id = String(channelId || "");
  if (!CHANNEL_ID_PATTERN.test(id)) return "";
  return `UU${id.slice(2)}`;
}

/**
 * Classify a YouTube URL.
 *
 * @returns {{
 *   kind: "video"|"playlist"|"channel"|null,
 *   videoId: string,          // set when the URL names a video
 *   playlistId: string,       // set when the URL names a real playlist (or the
 *                             //   uploads playlist for /channel/UC… URLs)
 *   channelId: string,        // /channel/UC… only
 *   handle: string,           // @handle / c/name / user/name — needs resolution
 *   handleType: ""|"handle"|"c"|"user",
 *   needsResolution: boolean  // true when only a handle is known
 * }|null} null when the URL isn't a recognizable YouTube target.
 *
 * When a watch URL carries BOTH v= and list=, kind is "video" but playlistId
 * is also populated — the admin UI offers the choice.
 */
export function parseYouTubeUrl(input) {
  const url = parseUrlLoose(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  const result = {
    kind: null,
    videoId: "",
    playlistId: "",
    channelId: "",
    handle: "",
    handleType: "",
    needsResolution: false
  };

  const listParam = validPlaylistId(url.searchParams.get("list"));

  if (SHORT_HOSTS.has(host)) {
    const id = validVideoId(url.pathname.split("/").filter(Boolean)[0]);
    if (!id) return null;
    return { ...result, kind: "video", videoId: id, playlistId: listParam };
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const [first, second] = segments;

  if (first === "watch") {
    const videoId = validVideoId(url.searchParams.get("v"));
    if (videoId) return { ...result, kind: "video", videoId, playlistId: listParam };
    if (listParam) return { ...result, kind: "playlist", playlistId: listParam };
    return null;
  }

  if (first === "playlist") {
    if (!listParam) return null;
    return { ...result, kind: "playlist", playlistId: listParam };
  }

  if (first === "embed") {
    if (second === "videoseries") {
      if (!listParam) return null;
      return { ...result, kind: "playlist", playlistId: listParam };
    }
    const videoId = validVideoId(second);
    if (!videoId) return null;
    return { ...result, kind: "video", videoId, playlistId: listParam };
  }

  if (first === "shorts" || first === "live" || first === "v") {
    const videoId = validVideoId(second);
    if (!videoId) return null;
    return { ...result, kind: "video", videoId };
  }

  if (first === "channel") {
    const channelId = CHANNEL_ID_PATTERN.test(String(second || "")) ? second : "";
    if (!channelId) return null;
    return {
      ...result,
      kind: "channel",
      channelId,
      playlistId: uploadsPlaylistFor(channelId)
    };
  }

  if (first && first.startsWith("@")) {
    const handle = first.slice(1);
    if (!HANDLE_PATTERN.test(handle)) return null;
    return { ...result, kind: "channel", handle, handleType: "handle", needsResolution: true };
  }

  if ((first === "c" || first === "user") && second) {
    if (!HANDLE_PATTERN.test(second)) return null;
    return { ...result, kind: "channel", handle: second, handleType: first, needsResolution: true };
  }

  return null;
}

function sanitizeHeroVideoUrl(value) {
  const url = parseUrlLoose(value);
  if (!url) return "";
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host) && !SHORT_HOSTS.has(host)) return "";
  return url.toString();
}

/**
 * Coerce any stored/authored heroVideo value into a safe block. Invalid or
 * incomplete input becomes the empty block — never an error, so publishing an
 * existing tenant can't start failing.
 */
export function sanitizeHeroVideo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_HERO_VIDEO };
  }

  const kind = HERO_VIDEO_KINDS.has(value.kind) ? value.kind : "";
  const videoId = validVideoId(value.videoId);
  const playlistId = validPlaylistId(value.playlistId);
  const url = sanitizeHeroVideoUrl(value.url);
  // Optional content aspect (from oEmbed dims) — lets the player crop
  // YouTube's in-player bars for non-16:9 content. 0 = unknown (player
  // assumes 16:9).
  const aspect = validAspect(value.aspect);

  if (kind === "video" && videoId) {
    return { url, kind, videoId, playlistId: "", ...(aspect ? { aspect } : {}) };
  }
  if ((kind === "playlist" || kind === "channel") && playlistId) {
    return { url, kind, videoId: "", playlistId, ...(aspect ? { aspect } : {}) };
  }
  return { ...EMPTY_HERO_VIDEO };
}

export const FRAME_ASPECT = 16 / 9; // the YouTube player iframe is always 16:9

/**
 * Size the 16:9 player iframe so the VIDEO REGION inside it covers the
 * container — oversizing enough to also crop YouTube's own letter/pillarbox
 * bars when the content aspect differs from 16:9 (4:3 classics, 9:16 shorts).
 * `verticalBleed` (fraction, e.g. 0.12) additionally oversizes so the iframe
 * overflows the container top and bottom by bleed × height each: YouTube's
 * uncloseable chrome (title band top, watermark bottom-right) hugs the iframe
 * edges, so pushing those edges outside the hero hides it (the iframe is
 * centered via translate(-50%,-50%)).
 * Pure; unit-tested; used by components/YouTubeHeroPlayer.jsx.
 */
export function coverSize(containerWidth, containerHeight, videoAspect, verticalBleed = 0) {
  const aspect = Number.isFinite(videoAspect) && videoAspect > 0 ? videoAspect : FRAME_ASPECT;
  const bleed = Number.isFinite(verticalBleed) && verticalBleed > 0 ? verticalBleed : 0;
  const targetHeight = containerHeight * (1 + 2 * bleed);
  // Smallest video region that covers the (bleed-inflated) container:
  const videoWidth = Math.max(containerWidth, targetHeight * aspect);
  const videoHeight = videoWidth / aspect;
  // The 16:9 frame that "contains" that video region:
  if (aspect <= FRAME_ASPECT) {
    // pillarboxed content: height binds
    return { width: Math.ceil(videoHeight * FRAME_ASPECT), height: Math.ceil(videoHeight) };
  }
  // letterboxed (ultrawide) content: width binds
  return { width: Math.ceil(videoWidth), height: Math.ceil(videoWidth / FRAME_ASPECT) };
}

/** True when a sanitized heroVideo block is playable. */
export function hasHeroVideo(heroVideo) {
  if (!heroVideo || typeof heroVideo !== "object") return false;
  if (heroVideo.kind === "video") return Boolean(heroVideo.videoId);
  if (heroVideo.kind === "playlist" || heroVideo.kind === "channel") {
    return Boolean(heroVideo.playlistId);
  }
  return false;
}
