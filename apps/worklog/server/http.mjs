/**
 * DGTL Worklog — HTTP plumbing: JSON bodies, responses, cookies, static files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, SECURE_COOKIES, TRUST_XFF } from './config.mjs';

/** Thrown by handlers to return a specific status without a stack trace. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const bad = (msg, details) => new HttpError(400, msg, details);

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

export function text(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

const MAX_BODY = 1024 * 512; // 512 KB — generous for JSON, cheap to refuse

/** Read and parse a JSON request body. Empty body parses as {}. */
export function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(bad('Body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, expire } = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (SECURE_COOKIES) bits.push('Secure');
  if (expire) bits.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  else if (maxAge) bits.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('set-cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  res.setHeader('set-cookie', [...list, bits.join('; ')]);
}

export function clientIp(req) {
  if (TRUST_XFF) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

/**
 * Same-origin guard for state-changing requests. The session cookie is
 * SameSite=Lax, so cross-site POSTs never carry it — this is belt and braces
 * for browsers or proxies that get that wrong.
 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser client (curl, the smoke test)
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Serve a file from public/. Returns false when there is nothing to serve, so
 * the caller can fall through to its own 404.
 */
export function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.join(PUBLIC_DIR, path.normalize(rel));

  // Refuse anything that escapes public/ — path.normalize alone is not enough.
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;

  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag });
    res.end();
    return true;
  }

  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    etag,
    // The app is small and changes as a unit — revalidate rather than cache.
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}
