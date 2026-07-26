// Shared helpers for the per-tenant home-screen / PWA app icon.
//
// An icon is stored on tenant.brand.appIcon as one of:
//   - a data URL:  "data:image/png;base64,...."  (preferred — self-contained, no asset host)
//   - an absolute https URL to a square PNG
//   - "" (empty) — caller should fall back to the bundled /icon.svg
//
// Kept dependency-free on purpose (stabilization priority): no image library,
// we accept a PNG as-is and serve/redirect to it.

// Generous cap so a 512px PNG fits comfortably in the config JSONB column,
// while rejecting anything large enough to bloat the row.
export const MAX_APP_ICON_BYTES = 512 * 1024; // 512 KB

const DATA_URL_RE = /^data:(image\/(?:png|x-icon|vnd\.microsoft\.icon));base64,([a-z0-9+/=\s]+)$/i;

// Parse a stored appIcon string into something the icon route can serve.
// Returns { kind: "data", buffer, contentType } | { kind: "url", url } | { kind: "none" }.
export function parseAppIcon(appIcon) {
  const value = typeof appIcon === "string" ? appIcon.trim() : "";
  if (!value) return { kind: "none" };

  const match = value.match(DATA_URL_RE);
  if (match) {
    try {
      const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
      if (!buffer.length || buffer.length > MAX_APP_ICON_BYTES) return { kind: "none" };
      return { kind: "data", buffer, contentType: match[1].toLowerCase() };
    } catch {
      return { kind: "none" };
    }
  }

  if (/^https:\/\/[^\s]+$/i.test(value)) {
    return { kind: "url", url: value };
  }

  return { kind: "none" };
}

// Validate an incoming appIcon value before persisting. Returns the cleaned
// value on success, or throws an Error with a user-facing message.
export function validateAppIconOrThrow(appIcon) {
  if (appIcon === "" || appIcon == null) return "";
  if (typeof appIcon !== "string") {
    throw new Error("appIcon must be a string.");
  }
  const parsed = parseAppIcon(appIcon);
  if (parsed.kind === "none") {
    throw new Error(
      "appIcon must be a PNG data URL (data:image/png;base64,...) under 512 KB, or an absolute https URL."
    );
  }
  return appIcon.trim();
}
