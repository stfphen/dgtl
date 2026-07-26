import { localProvider } from "./localProvider.js";

/**
 * Storage seam for media uploads, mirroring the telephony provider pattern:
 * the route talks to getStorageProvider(), never to a concrete backend, so an
 * S3/R2 provider can slot in via MEDIA_STORAGE_PROVIDER without touching the
 * upload flow. Unknown values fall back to local (mock-first per project rules).
 */
export function getStorageProvider() {
  const name = String(process.env.MEDIA_STORAGE_PROVIDER || "local").toLowerCase();
  switch (name) {
    case "local":
    default:
      return localProvider;
  }
}
