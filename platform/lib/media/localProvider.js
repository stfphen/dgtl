import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage provider: files land under public/uploads/<teamId>/ and
 * are served as root-relative /uploads/... URLs (which also keeps them on the
 * next/image local-optimization path in FunnelPage).
 *
 * MEDIA_UPLOAD_DIR overrides the root — the test seam, mirroring
 * APP_STORE_PATH for the JSON store.
 *
 * Deploy note (output: "standalone"): public/ is snapshotted at build time, so
 * runtime uploads need public/uploads mounted as a volume in the container.
 * The S3 provider (MEDIA_STORAGE_PROVIDER=s3, later) removes that constraint.
 */

const SAFE_SEGMENT = /^[a-z0-9_-]+$/i;
const SAFE_STORAGE_KEY = /^[a-z0-9_-]+\/[a-z0-9_-]+\.[a-z0-9]+$/i;

function uploadRoot() {
  return process.env.MEDIA_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

export const localProvider = {
  name: "local",

  isConfigured() {
    return true;
  },

  async put({ teamId, id, ext, buffer } = {}) {
    if (!SAFE_SEGMENT.test(String(teamId || ""))) {
      throw new Error("Invalid team id for storage.");
    }
    if (!SAFE_SEGMENT.test(String(id || "")) || !SAFE_SEGMENT.test(String(ext || ""))) {
      throw new Error("Invalid storage id.");
    }
    const storageKey = `${teamId}/${id}.${ext}`;
    const target = path.join(uploadRoot(), teamId, `${id}.${ext}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { url: `/uploads/${storageKey}`, storageKey };
  },

  async remove({ storageKey } = {}) {
    const key = String(storageKey || "");
    // Keys are server-generated; anything else (traversal, absolute paths,
    // unexpected characters) is rejected outright.
    if (!SAFE_STORAGE_KEY.test(key) || key.includes("..")) {
      return false;
    }
    try {
      await unlink(path.join(uploadRoot(), key));
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
};
