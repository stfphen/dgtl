import crypto from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

function previewRoot(value = process.env.CORE_ARTIFACT_PREVIEW_ROOT) {
  return path.resolve(String(value || path.join(os.tmpdir(), "dgtl-artifact-previews")));
}

function stablePreviewName(teamId, jobId) {
  if (!teamId || !jobId) throw Object.assign(new Error("Preview team and job identity are required."), { status: 400 });
  return `${crypto.createHash("sha256").update(`${teamId}\0${jobId}`).digest("hex")}.html`;
}

export function localPreviewPath(teamId, jobId, options = {}) {
  return path.join(previewRoot(options.previewRoot), stablePreviewName(teamId, jobId));
}

export function localPreviewReference(jobId) {
  return `/api/core/generation-jobs/${encodeURIComponent(jobId)}/preview`;
}

export async function persistLocalPreview(job, { workspaceRoot, outputManifest, previewRoot: configuredRoot } = {}) {
  const root = path.resolve(String(workspaceRoot || ""));
  const relative = String(outputManifest?.sourcePath || "");
  const source = path.resolve(root, relative);
  if (!root || !relative.endsWith(".html") || source === root || !source.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("Preview source path escapes the isolated workspace."), { status: 400, code: "unsafe_preview_path" });
  }
  const [rootReal, sourceReal, sourceStat] = await Promise.all([realpath(root), realpath(source), lstat(source)]);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile() || !sourceReal.startsWith(`${rootReal}${path.sep}`)) {
    throw Object.assign(new Error("Preview source must be a regular HTML file inside the isolated workspace."), { status: 400, code: "unsafe_preview_file" });
  }
  const html = await readFile(source);
  if (html.length > MAX_PREVIEW_BYTES) throw Object.assign(new Error("Generated preview exceeds the 2 MB local preview limit."), { status: 413, code: "preview_too_large" });
  const target = localPreviewPath(job.teamId, job.id, { previewRoot: configuredRoot });
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, html, { mode: 0o600 });
  await rename(temporary, target);
  return { reference: localPreviewReference(job.id), bytes: html.length, path: target };
}

export async function readLocalPreview(teamId, jobId, options = {}) {
  return readFile(localPreviewPath(teamId, jobId, options));
}
