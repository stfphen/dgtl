/**
 * Shared authenticated HTTP client for the DGTL Worklog API.
 *
 * This is the one implementation of the Worklog HTTP contract. It is consumed
 * by both `apps/worklog-mcp` (the stdio MCP connector) and the platform's
 * server-side Worklog integration. It lives beside the server it talks to so
 * the client and the API version together.
 *
 * Worklog has no bearer-token auth path — `public/assets/js/api.js` uses
 * `credentials: 'same-origin'` and `server/auth.mjs` issues an HttpOnly cookie
 * named `dgtl_worklog` holding a 32-byte random token. This client therefore
 * logs in once, keeps that cookie in memory, and re-authenticates on a 401.
 *
 * Three constraints from the server, all enforced here:
 *
 *   1. `throttleLogin()` allows 10 sign-in attempts per ip+email per 15 minutes
 *      and then returns 429. So login is attempted at most once per 401, never
 *      in a loop, and a 429 is surfaced immediately rather than retried.
 *   2. Production Worklog runs under Passenger on Hostinger shared hosting,
 *      which caps concurrent connections. Requests are therefore serialised
 *      through a queue with a minimum gap, so a bulk task import cannot
 *      stampede it.
 *   3. Credentials come from the constructor and never reach a log line, an
 *      error message, or a thrown stack.
 *
 * Unlike the original MCP-local client, this module reads no environment
 * variables and has no production default URL: every consumer passes its own
 * server-configured `baseUrl`, `email`, and `password` explicitly.
 */

const SESSION_COOKIE = 'dgtl_worklog';
const MIN_REQUEST_GAP_MS = 120;

class WorklogError extends Error {
  constructor(message, { status, path, body } = {}) {
    super(message);
    this.name = 'WorklogError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

class WorklogClient {
  #cookie = null;
  #loginPromise = null;
  #queue = Promise.resolve();
  #lastRequestAt = 0;

  constructor({ baseUrl, email, password, minRequestGapMs = MIN_REQUEST_GAP_MS, credentialHint = '' } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.email = email;
    this.password = password;
    this.minRequestGapMs = minRequestGapMs;

    if (!this.baseUrl) {
      throw new WorklogError('Missing Worklog base URL. The consumer must pass a server-configured baseUrl.');
    }
    if (!/^https?:\/\//.test(this.baseUrl)) {
      throw new WorklogError('Worklog base URL must be an http(s) origin.');
    }
    if (!this.email || !this.password) {
      throw new WorklogError(`Missing Worklog credentials.${credentialHint ? ` ${credentialHint}` : ''}`);
    }
  }

  /** Serialise every outbound request, spacing them by minRequestGapMs. */
  #schedule(fn) {
    const result = this.#queue.then(async () => {
      const wait = this.#lastRequestAt + this.minRequestGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.#lastRequestAt = Date.now();
      return fn();
    });
    // Keep the chain alive regardless of individual failures.
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }

  // No `origin` header is ever sent: Worklog's same-origin write guard passes
  // requests with no Origin and 403s any that mismatch the Host.
  #raw(method, path, body) {
    return this.#schedule(() => fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.#cookie ? { cookie: this.#cookie } : {}),
        accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    }));
  }

  /** Collapse concurrent logins into one in-flight request. */
  async login() {
    if (this.#loginPromise) return this.#loginPromise;

    this.#loginPromise = (async () => {
      const res = await this.#raw('POST', '/api/auth/login', {
        email: this.email,
        password: this.password,
      });

      if (res.status === 429) {
        res.body?.cancel?.();
        throw new WorklogError(
          'Worklog is throttling sign-ins (10 per 15 minutes). Wait a few minutes before retrying.',
          { status: 429, path: '/api/auth/login' },
        );
      }

      if (!res.ok) {
        res.body?.cancel?.();
        // Never echoes the request body — no credential reaches an error string.
        const hint = res.status === 401
          ? 'Check the configured Worklog email and password, and that the account is active.'
          : '';
        throw new WorklogError(
          `Login failed for ${this.email} (HTTP ${res.status}). ${hint}`.trim(),
          { status: res.status, path: '/api/auth/login' },
        );
      }

      const jar = (res.headers.getSetCookie?.() ?? [])
        .map((c) => c.split(';')[0])
        .filter((c) => c.startsWith(`${SESSION_COOKIE}=`))
        .join('; ');
      res.body?.cancel?.();

      if (!jar) {
        throw new WorklogError(
          `Login succeeded but no ${SESSION_COOKIE} cookie came back.`,
          { status: res.status, path: '/api/auth/login' },
        );
      }

      this.#cookie = jar;
      return jar;
    })().finally(() => {
      this.#loginPromise = null;
    });

    return this.#loginPromise;
  }

  async logout() {
    if (!this.#cookie) return;
    try {
      await this.call('POST', '/api/auth/logout');
    } catch {
      // A failed logout is not worth surfacing — the cookie is dropped either way.
    } finally {
      this.#cookie = null;
    }
  }

  /**
   * Issue an API call, logging in first if needed and retrying once on 401.
   * Returns parsed JSON, or null for an empty body.
   */
  async call(method, path, body, { _retried = false } = {}) {
    if (!this.#cookie) await this.login();
    const usedCookie = this.#cookie;

    const res = await this.#raw(method, path, body);

    // Session expired or was revoked (deactivation and password change both
    // delete sessions server-side). One re-auth, then give up. Only discard
    // the cookie if it is still the one this request used — a concurrent
    // request may already have re-authenticated and stored a fresh one.
    if (res.status === 401 && !_retried) {
      res.body?.cancel?.();
      if (this.#cookie === usedCookie) this.#cookie = null;
      if (!this.#cookie) await this.login();
      return this.call(method, path, body, { _retried: true });
    }

    const text = await res.text();
    let parsed = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }

    if (!res.ok) {
      const detail = parsed?.error || parsed?.message || `HTTP ${res.status}`;
      throw new WorklogError(`${method} ${path} — ${detail}`, {
        status: res.status,
        path,
        body: parsed,
      });
    }

    return parsed;
  }

  get = (path) => this.call('GET', path);
  post = (path, body) => this.call('POST', path, body ?? {});
  patch = (path, body) => this.call('PATCH', path, body ?? {});
  del = (path) => this.call('DELETE', path);
}

/** Build a querystring, skipping null/undefined/empty values. */
function qs(params = {}) {
  const usable = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!usable.length) return '';
  return `?${new URLSearchParams(usable.map(([k, v]) => [k, String(v)])).toString()}`;
}

export { WorklogClient, WorklogError, qs, SESSION_COOKIE, MIN_REQUEST_GAP_MS };
