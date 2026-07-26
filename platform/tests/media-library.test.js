import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { localProvider } from "../lib/media/localProvider.js";
import { getStorageProvider } from "../lib/media/index.js";
import { ALLOWED_IMAGE_TYPES, validateUploadOrThrow } from "../lib/media/validate.js";

// Minimal real magic-byte payloads.
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 1)
]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 1)]);
const GIF_BYTES = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(16, 1)]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.alloc(4, 0),
  Buffer.from("WEBP", "latin1"),
  Buffer.alloc(12, 1)
]);

test("validateUploadOrThrow accepts each allowed type with matching magic bytes", () => {
  const cases = [
    ["image/png", PNG_BYTES, "png"],
    ["image/jpeg", JPEG_BYTES, "jpg"],
    ["image/gif", GIF_BYTES, "gif"],
    ["image/webp", WEBP_BYTES, "webp"]
  ];
  for (const [mime, buffer, ext] of cases) {
    assert.deepEqual(validateUploadOrThrow({ buffer, mime, bytes: buffer.length }), { mime, ext });
  }
  assert.deepEqual(Object.values(ALLOWED_IMAGE_TYPES).sort(), ["gif", "jpg", "png", "webp"]);
});

test("validateUploadOrThrow rejects svg, mismatched bytes, oversize, and empty files", () => {
  assert.throws(
    () => validateUploadOrThrow({ buffer: PNG_BYTES, mime: "image/svg+xml", bytes: PNG_BYTES.length }),
    (error) => error.name === "MediaValidationError" && /Unsupported file type/.test(error.message)
  );
  // Declared png, JPEG bytes → rejected.
  assert.throws(
    () => validateUploadOrThrow({ buffer: JPEG_BYTES, mime: "image/png", bytes: JPEG_BYTES.length }),
    (error) => error.name === "MediaValidationError" && /do not match/.test(error.message)
  );
  assert.throws(
    () => validateUploadOrThrow({ buffer: PNG_BYTES, mime: "image/png", bytes: 11 * 1024 * 1024 }),
    (error) => error.name === "MediaValidationError" && /too large/.test(error.message)
  );
  assert.throws(
    () => validateUploadOrThrow({ buffer: Buffer.alloc(0), mime: "image/png", bytes: 0 }),
    (error) => error.name === "MediaValidationError"
  );
});

test("getStorageProvider defaults to the local provider", () => {
  assert.equal(getStorageProvider().name, "local");
});

test("localProvider put/remove round trip with traversal-safe keys", async (t) => {
  const previousDir = process.env.MEDIA_UPLOAD_DIR;
  const dir = await mkdtemp(path.join(tmpdir(), "media-upload-"));
  process.env.MEDIA_UPLOAD_DIR = dir;
  t.after(async () => {
    if (previousDir === undefined) delete process.env.MEDIA_UPLOAD_DIR;
    else process.env.MEDIA_UPLOAD_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  });

  const stored = await localProvider.put({
    teamId: "team_default",
    id: "media_test1",
    ext: "png",
    buffer: PNG_BYTES
  });
  assert.equal(stored.url, "/uploads/team_default/media_test1.png");
  assert.equal(stored.storageKey, "team_default/media_test1.png");
  assert.deepEqual(await readFile(path.join(dir, "team_default", "media_test1.png")), PNG_BYTES);

  // Hostile inputs rejected before touching the filesystem.
  await assert.rejects(
    () => localProvider.put({ teamId: "../escape", id: "media_x", ext: "png", buffer: PNG_BYTES }),
    /Invalid team id/
  );
  await assert.rejects(
    () => localProvider.put({ teamId: "team_default", id: "..", ext: "png", buffer: PNG_BYTES }),
    /Invalid storage id/
  );
  assert.equal(await localProvider.remove({ storageKey: "../../etc/passwd" }), false);
  assert.equal(await localProvider.remove({ storageKey: "team_default/../x.png" }), false);

  assert.equal(await localProvider.remove({ storageKey: "team_default/media_test1.png" }), true);
  await assert.rejects(() => access(path.join(dir, "team_default", "media_test1.png")));
  // Removing again: gone → false, no throw.
  assert.equal(await localProvider.remove({ storageKey: "team_default/media_test1.png" }), false);
});

test("media asset store CRUD is team-scoped (file store)", async (t) => {
  const previousStorePath = process.env.APP_STORE_PATH;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const dir = await mkdtemp(path.join(tmpdir(), "media-store-"));
  process.env.APP_STORE_PATH = path.join(dir, "store.json");
  delete process.env.DATABASE_URL;
  t.after(async () => {
    if (previousStorePath === undefined) delete process.env.APP_STORE_PATH;
    else process.env.APP_STORE_PATH = previousStorePath;
    if (previousDatabaseUrl !== undefined) process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(dir, { recursive: true, force: true });
  });

  const {
    createMediaAsset,
    listMediaAssets,
    getMediaAssetsByIds,
    getMediaAssetById,
    deleteMediaAsset
  } = await import("../lib/store.js");

  const teamAsset = await createMediaAsset(
    { url: "/uploads/team_a/media_1.png", mime: "image/png", bytes: 10, alt: "Team-wide" },
    { teamId: "team_a" }
  );
  const tenantAsset = await createMediaAsset(
    { url: "/uploads/team_a/media_2.png", tenantId: "tenant_x", alt: "Tenant-only" },
    { teamId: "team_a" }
  );
  await createMediaAsset({ url: "/uploads/team_b/media_3.png" }, { teamId: "team_b" });

  // Listing is team-scoped; tenant filter keeps team-wide assets visible.
  const teamAList = await listMediaAssets({ teamId: "team_a" });
  assert.deepEqual(teamAList.map((a) => a.id).sort(), [teamAsset.id, tenantAsset.id].sort());
  const tenantXList = await listMediaAssets({ teamId: "team_a", tenantId: "tenant_x" });
  assert.deepEqual(tenantXList.map((a) => a.id).sort(), [teamAsset.id, tenantAsset.id].sort());
  const tenantYList = await listMediaAssets({ teamId: "team_a", tenantId: "tenant_y" });
  assert.deepEqual(tenantYList.map((a) => a.id), [teamAsset.id]);

  // Cross-team fetch/delete never resolves.
  assert.deepEqual(await getMediaAssetsByIds([teamAsset.id], { teamId: "team_b" }), []);
  assert.equal(await getMediaAssetById(teamAsset.id, { teamId: "team_b" }), null);
  assert.equal(await deleteMediaAsset(teamAsset.id, { teamId: "team_b" }), null);

  // Same-team fetch works, batch fetch dedupes and skips blanks.
  const fetched = await getMediaAssetById(teamAsset.id, { teamId: "team_a" });
  assert.equal(fetched.alt, "Team-wide");
  const batch = await getMediaAssetsByIds([teamAsset.id, teamAsset.id, "", "missing"], {
    teamId: "team_a"
  });
  assert.equal(batch.length, 1);

  // Delete returns the record (with storageKey) and removes it.
  const removed = await deleteMediaAsset(tenantAsset.id, { teamId: "team_a" });
  assert.equal(removed.id, tenantAsset.id);
  assert.equal((await listMediaAssets({ teamId: "team_a" })).length, 1);
});

test("collectMediaIds walks every media slot exactly once", async () => {
  const { collectMediaIds } = await import("../lib/store.js");
  const ids = collectMediaIds({
    media: { heroImageId: "media_hero" },
    portfolio: {
      items: [
        { mediaId: "media_p1" },
        { mediaId: "media_p1" },
        { src: "/assets/direct.png" },
        null
      ]
    },
    references: { logos: [{ mediaId: " media_logo " }, {}] }
  });
  assert.deepEqual(ids.sort(), ["media_hero", "media_logo", "media_p1"].sort());

  assert.deepEqual(collectMediaIds({}), []);
  assert.deepEqual(collectMediaIds(null), []);
});
