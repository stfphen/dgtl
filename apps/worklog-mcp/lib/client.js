/**
 * MCP-facing wrapper around the shared Worklog HTTP client.
 *
 * The one implementation of the Worklog HTTP contract — cookie login, single
 * 401 re-auth, serialised requests with a minimum gap for the Passenger
 * shared-hosting cap, and credential hygiene — lives beside the server it
 * talks to, in `apps/worklog/client/worklog-client.mjs`, and is shared with
 * the platform's server-side Worklog integration.
 *
 * This wrapper preserves the MCP connector's original configuration
 * behaviour: base URL and credentials fall back to WORKLOG_BASE_URL /
 * WORKLOG_EMAIL / WORKLOG_PASSWORD from the environment (populated by
 * server.js's .env reader), and the base URL defaults to production
 * office.dgtl.at, since the MCP is an interactive tool for the live
 * workspace.
 */

import {
  WorklogClient as SharedWorklogClient,
  WorklogError,
  qs,
  SESSION_COOKIE,
} from '../../worklog/client/worklog-client.mjs';

const DEFAULT_BASE_URL = 'https://office.dgtl.at';

class WorklogClient extends SharedWorklogClient {
  constructor({ baseUrl, email, password } = {}) {
    super({
      baseUrl: baseUrl || process.env.WORKLOG_BASE_URL || DEFAULT_BASE_URL,
      email: email || process.env.WORKLOG_EMAIL,
      password: password || process.env.WORKLOG_PASSWORD,
      credentialHint: 'Set WORKLOG_EMAIL and WORKLOG_PASSWORD (see .env.example).',
    });
  }
}

export { WorklogClient, WorklogError, qs, SESSION_COOKIE };
