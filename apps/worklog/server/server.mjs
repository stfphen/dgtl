/**
 * DGTL Worklog — server entry point.
 *
 *   npm start        → http://localhost:8123
 *   npm run seed     → create the first admin + sample data
 *
 * Zero runtime dependencies: node:http serves the app, node:sqlite stores it.
 * Requires Node 22.5+ for the built-in SQLite module.
 */

import http from 'node:http';
import { HOST, PORT, APP_TIMEZONE, DB_PATH, SECURE_COOKIES } from './config.mjs';
import { HttpError, clientIp, json, readJson, sameOrigin, serveStatic, text } from './http.mjs';
import { handleApi } from './api.mjs';
import { bootstrapAdmin, currentUser, sweep } from './auth.mjs';
import { one } from './db.mjs';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-frame-options', 'DENY');

  try {
    if (url.pathname.startsWith('/api/')) {
      if (WRITE_METHODS.has(req.method) && !sameOrigin(req)) {
        throw new HttpError(403, 'Cross-origin request refused');
      }
      const body = WRITE_METHODS.has(req.method) ? await readJson(req) : {};
      const result = await handleApi(req, res, url, body, clientIp(req));
      if (result) return json(res, result.status, result.body);
      return json(res, 404, { error: 'No such endpoint' });
    }

    // The app shell is behind the session; the login page is not. Serving the
    // redirect here means an unauthenticated browser never downloads the app.
    if (url.pathname === '/' && !currentUser(req)) {
      res.writeHead(302, { location: '/login.html' });
      return res.end();
    }
    if (url.pathname === '/login.html' && currentUser(req)) {
      res.writeHead(302, { location: '/' });
      return res.end();
    }

    if (serveStatic(req, res, url.pathname)) return;
    return text(res, 404, 'Not found');
  } catch (err) {
    if (err instanceof HttpError) {
      return json(res, err.status, { error: err.message, details: err.details });
    }
    console.error(`[worklog] ${req.method} ${url.pathname}`, err);
    return json(res, 500, { error: 'Something went wrong on the server' });
  }
});

const sessions = sweep();
bootstrapAdmin();                       // no-op unless the workspace has no users at all
const users = one('SELECT COUNT(*) AS n FROM users').n;

server.listen(PORT, HOST, () => {
  console.log(`
  DGTL Worklog
  ────────────────────────────────────────────────
  URL        http://localhost:${PORT}
  Database   ${DB_PATH}
  Timezone   ${APP_TIMEZONE}
  Users      ${users}${users === 0 ? '  ← run `npm run seed` to create the first admin' : ''}
  Sessions   ${sessions} live
  Cookies    ${SECURE_COOKIES ? 'Secure (HTTPS)' : 'plain HTTP — set SECURE_COOKIES=1 behind TLS'}
`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Don't hang on a keep-alive connection during a deploy restart.
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
