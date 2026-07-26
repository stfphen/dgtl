/**
 * Upload validation for the media library. Images only for now (video/embed
 * stay URL-based in portfolio items). SVG is deliberately excluded (script
 * vector). Declared mime must match the file's magic bytes so a renamed
 * executable can't slip through as an image.
 */

export const MEDIA_MAX_UPLOAD_BYTES = Number(process.env.MEDIA_MAX_UPLOAD_BYTES) > 0
  ? Number(process.env.MEDIA_MAX_UPLOAD_BYTES)
  : 10 * 1024 * 1024;

// mime → file extension. Extensions ALWAYS come from this map, never from the
// uploaded filename — that plus server-generated ids keeps storage keys inert.
export const ALLOWED_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};

function mediaValidationError(message) {
  const error = new Error(message);
  error.name = "MediaValidationError";
  return error;
}

function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  const ascii = buffer.subarray(0, 12).toString("latin1");
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  return "";
}

/**
 * @returns {{ mime: string, ext: string }}
 * @throws {Error} name MediaValidationError → route maps to 400.
 */
export function validateUploadOrThrow({ buffer, mime, bytes } = {}) {
  const declared = String(mime || "").toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[declared];
  if (!ext) {
    throw mediaValidationError(
      `Unsupported file type "${declared || "unknown"}". Allowed: PNG, JPEG, WebP, GIF.`
    );
  }

  const size = Number(bytes) || buffer?.length || 0;
  if (!size) {
    throw mediaValidationError("The uploaded file is empty.");
  }
  if (size > MEDIA_MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(MEDIA_MAX_UPLOAD_BYTES / (1024 * 1024));
    throw mediaValidationError(`File is too large (max ${maxMb} MB).`);
  }

  const sniffed = sniffImageMime(buffer);
  if (sniffed !== declared) {
    throw mediaValidationError(
      "File contents do not match the declared image type — upload the original image file."
    );
  }

  return { mime: declared, ext };
}
