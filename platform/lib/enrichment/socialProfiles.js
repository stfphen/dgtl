import { normalizeUrl } from "./url.js";

export const SUPPORTED_SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "youtube",
  "tiktok",
  "bluesky",
  "reddit"
];

const PLATFORM_HOSTS = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com"],
  x: ["x.com", "twitter.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  bluesky: ["bsky.app"],
  reddit: ["reddit.com"]
};

const CANONICAL_HOSTS = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  x: "x.com",
  youtube: "youtube.com",
  tiktok: "tiktok.com",
  bluesky: "bsky.app",
  reddit: "reddit.com"
};

function getParsedUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;

  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

function getPathSegments(pathname) {
  return pathname.split("/").map((segment) => segment.trim()).filter(Boolean);
}

function detectPlatform(url) {
  const hostname = url.hostname.toLowerCase();

  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      return platform;
    }
  }

  return null;
}

function extractInstagramHandle(url) {
  const [first] = getPathSegments(url.pathname);
  if (!first) return null;

  const reserved = new Set(["accounts", "developer", "direct", "explore", "p", "reel", "reels", "stories", "tv"]);
  if (reserved.has(first.toLowerCase())) return null;

  return `@${first.replace(/^@/, "")}`;
}

function extractFacebookHandle(url) {
  const segments = getPathSegments(url.pathname);
  const [first, second, third] = segments;

  if (url.pathname.toLowerCase() === "/profile.php") {
    const id = url.searchParams.get("id");
    return id ? `id:${id}` : null;
  }

  const reserved = new Set([
    "dialog",
    "events",
    "help",
    "login",
    "pages",
    "permalink.php",
    "photo.php",
    "photos",
    "plugins",
    "reel",
    "sharer.php",
    "share.php",
    "share",
    "story.php",
    "watch"
  ]);

  if (first?.toLowerCase() === "pages" && second) {
    return third ? `pages/${second}` : `pages/${second}`;
  }

  if (first?.toLowerCase() === "pg" && second) {
    return second;
  }

  if (!first || reserved.has(first.toLowerCase())) return null;
  return first;
}

function extractLinkedInHandle(url) {
  const [first, second] = getPathSegments(url.pathname);
  const supported = new Set(["company", "in", "school", "showcase"]);

  if (!first || !second || !supported.has(first.toLowerCase())) return null;
  return `${first.toLowerCase()}/${second}`;
}

function extractXHandle(url) {
  const [first] = getPathSegments(url.pathname);

  if (first?.toLowerCase() === "intent") {
    const screenName = url.searchParams.get("screen_name");
    return screenName ? `@${screenName.replace(/^@/, "")}` : null;
  }

  const reserved = new Set(["compose", "explore", "hashtag", "home", "i", "intent", "messages", "search", "settings", "share"]);
  if (!first || reserved.has(first.toLowerCase())) return null;

  return `@${first.replace(/^@/, "")}`;
}

function extractYouTubeHandle(url) {
  if (url.hostname.toLowerCase() === "youtu.be") return null;

  const [first, second] = getPathSegments(url.pathname);
  const reserved = new Set(["clip", "feed", "live", "playlist", "results", "shorts", "watch"]);

  if (!first || reserved.has(first.toLowerCase())) return null;
  if (first.startsWith("@")) return first;
  if (["c", "channel", "user"].includes(first.toLowerCase()) && second) {
    return `${first.toLowerCase()}/${second}`;
  }
  if (!second) return first;
  return null;
}

function extractTikTokHandle(url) {
  const [first] = getPathSegments(url.pathname);
  if (!first || !first.startsWith("@")) return null;
  return `@${first.slice(1)}`;
}

function extractBlueskyHandle(url) {
  const [first, second] = getPathSegments(url.pathname);
  if (!first || first.toLowerCase() !== "profile" || !second) return null;
  return second;
}

function extractRedditHandle(url) {
  const [first, second] = getPathSegments(url.pathname);
  if (!first || !second) return null;

  if (first.toLowerCase() === "user") return `u/${second}`;
  if (first.toLowerCase() === "u") return `u/${second}`;
  if (first.toLowerCase() === "r") return `r/${second}`;
  return null;
}

function extractHandleFromParsedUrl(platform, url) {
  switch (platform) {
    case "instagram":
      return extractInstagramHandle(url);
    case "facebook":
      return extractFacebookHandle(url);
    case "linkedin":
      return extractLinkedInHandle(url);
    case "x":
      return extractXHandle(url);
    case "youtube":
      return extractYouTubeHandle(url);
    case "tiktok":
      return extractTikTokHandle(url);
    case "bluesky":
      return extractBlueskyHandle(url);
    case "reddit":
      return extractRedditHandle(url);
    default:
      return null;
  }
}

function applyCanonicalPath(url, platform, handle) {
  switch (platform) {
    case "instagram":
      url.pathname = `/${handle.slice(1)}`;
      url.search = "";
      return;
    case "facebook":
      if (handle.startsWith("id:")) {
        url.pathname = "/profile.php";
        url.search = `?id=${encodeURIComponent(handle.slice(3))}`;
        return;
      }
      if (handle.startsWith("pages/")) {
        url.pathname = `/${handle}`;
        url.search = "";
        return;
      }
      url.pathname = `/${handle}`;
      url.search = "";
      return;
    case "linkedin":
      url.pathname = `/${handle}`;
      url.search = "";
      return;
    case "x":
      url.pathname = `/${handle.slice(1)}`;
      url.search = "";
      return;
    case "youtube":
      url.pathname = `/${handle}`;
      url.search = "";
      return;
    case "tiktok":
      url.pathname = `/${handle}`;
      url.search = "";
      return;
    case "bluesky":
      url.pathname = `/profile/${handle}`;
      url.search = "";
      return;
    case "reddit":
      url.pathname = `/${handle}`;
      url.search = "";
      return;
    default:
      url.search = "";
  }
}

export function createEmptySocialProfiles() {
  return Object.fromEntries(
    SUPPORTED_SOCIAL_PLATFORMS.map((platform) => [platform, []])
  );
}

export function classifySocialUrl(value) {
  const url = getParsedUrl(value);
  if (!url) return null;

  const platform = detectPlatform(url);
  if (!platform) return null;

  return extractHandleFromParsedUrl(platform, url) ? platform : null;
}

export function extractHandle(platform, value) {
  const url = getParsedUrl(value);
  if (!url) return null;

  const detectedPlatform = detectPlatform(url);
  if (detectedPlatform !== platform) return null;

  return extractHandleFromParsedUrl(platform, url);
}

export function normalizeSocialUrl(value) {
  const url = getParsedUrl(value);
  if (!url) return null;

  const platform = detectPlatform(url);
  if (!platform) return null;

  const handle = extractHandleFromParsedUrl(platform, url);
  if (!handle) return null;

  const normalized = new URL(url.toString());
  normalized.protocol = "https:";
  normalized.hostname = CANONICAL_HOSTS[platform];
  normalized.hash = "";
  applyCanonicalPath(normalized, platform, handle);

  return normalized.toString();
}
