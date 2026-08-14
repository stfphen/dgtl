/**
 * Server-side Worklog connector.
 *
 * Wraps the shared Worklog HTTP client (apps/worklog/client/worklog-client.mjs
 * — the same implementation the Worklog MCP consumes) behind a bounded,
 * cache-coalescing surface for DGTL Core.
 *
 * Configuration is exclusively server environment:
 *   CORE_WORKLOG_BASE_URL   the Worklog origin (no default — unset means the
 *                           integration is unconfigured; production is never
 *                           an implicit target)
 *   CORE_WORKLOG_EMAIL      dedicated integration account email
 *   CORE_WORKLOG_PASSWORD   dedicated integration account password
 *   CORE_WORKLOG_TEAM_ID    the one Core team allowed to use this connector
 *                           (same server-owned team binding as the Stage 3
 *                           worker); unset fails closed for every team
 *
 * No request input can influence the endpoint or credentials, and none of
 * these values is ever returned to a browser.
 */

import { WorklogClient, WorklogError, qs } from "../../../apps/worklog/client/worklog-client.mjs";
import { WORKLOG_CONNECTOR } from "./registry.js";

const NETWORK_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EPIPE", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"]);
const isNetworkError = (error) => error?.name === "TypeError" || NETWORK_CODES.has(error?.cause?.code || error?.code);
const noStatus = (error) => (error?.name === "WorklogError" && !error.status) || isNetworkError(error);

export class WorklogConnector {
  #client = null;
  #cache = new Map();

  constructor({ baseUrl, email, password, teamId, client = null, now = () => Date.now(), readCacheTtlMs = WORKLOG_CONNECTOR.policy.readCacheTtlMs } = {}) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.teamId = String(teamId || "");
    this.now = now;
    this.readCacheTtlMs = readCacheTtlMs;
    this.lastSuccessAt = null;
    this.lastErrorAt = null;
    this.lastErrorSummary = "";
    if (client) {
      this.#client = client;
    } else if (this.baseUrl && email && password) {
      this.#client = new WorklogClient({
        baseUrl: this.baseUrl,
        email,
        password,
        credentialHint: "Set CORE_WORKLOG_EMAIL and CORE_WORKLOG_PASSWORD on the server.",
      });
    }
  }

  configured() { return Boolean(this.#client && this.baseUrl); }

  authorizedForTeam(teamId) { return this.configured() && Boolean(this.teamId) && this.teamId === teamId; }

  assertTeam(teamId) {
    if (!this.configured()) {
      throw Object.assign(new Error("The Worklog connector is not configured on this server."), { status: 503, code: "worklog_unconfigured" });
    }
    if (!this.authorizedForTeam(teamId)) {
      throw Object.assign(new Error("The Worklog connector is not enabled for this team."), { status: 403, code: "worklog_team_not_enabled" });
    }
  }

  /** Coalesce and cache reads. Concurrent identical reads share one request. */
  #cached(key, force, fetcher) {
    const entry = this.#cache.get(key);
    if (!force && entry && (entry.pending || this.now() - entry.at < this.readCacheTtlMs)) {
      return entry.promise;
    }
    const promise = fetcher()
      .then((data) => {
        this.#cache.set(key, { at: this.now(), promise: Promise.resolve(data), pending: false });
        this.lastSuccessAt = new Date(this.now()).toISOString();
        return data;
      })
      .catch((error) => {
        this.#cache.delete(key);
        this.lastErrorAt = new Date(this.now()).toISOString();
        this.lastErrorSummary = error?.message || "Worklog request failed.";
        throw error;
      });
    this.#cache.set(key, { at: this.now(), promise, pending: true });
    return promise;
  }

  invalidateReads() { this.#cache.clear(); }

  bootstrap({ force = false } = {}) { return this.#cached("bootstrap", force, () => this.#client.get("/api/bootstrap")); }

  clients({ force = false } = {}) { return this.#cached("clients", force, () => this.#client.get("/api/clients")); }

  projects({ force = false } = {}) { return this.#cached("projects", force, () => this.#client.get("/api/projects")); }

  tasks({ force = false, includeArchived = false } = {}) {
    return this.#cached(`tasks:${includeArchived ? 1 : 0}`, force, () => this.#client.get(`/api/tasks${includeArchived ? "?archived=1" : ""}`));
  }

  report({ from, to, scope = "team" } = {}, { force = false } = {}) {
    return this.#cached(`report:${from || ""}:${to || ""}:${scope}`, force, () => this.#client.get(`/api/report${qs({ from, to, scope })}`));
  }

  digest({ clientId, from, to } = {}, { force = false } = {}) {
    if (!clientId) throw Object.assign(new Error("clientId is required for a Worklog digest."), { status: 400 });
    return this.#cached(`digest:${clientId}:${from || ""}:${to || ""}`, force, () => this.#client.get(`/api/digest${qs({ clientId, from, to })}`));
  }

  /** Consequential writes: never cached, never retried here. */
  async createProject(payload) {
    const result = await this.#client.post("/api/projects", payload);
    this.invalidateReads();
    this.lastSuccessAt = new Date(this.now()).toISOString();
    return result;
  }

  async createTask(payload) {
    const result = await this.#client.post("/api/tasks", payload);
    this.invalidateReads();
    this.lastSuccessAt = new Date(this.now()).toISOString();
    return result;
  }

  /**
   * Health probe. States: unconfigured | connected | auth_failed |
   * insufficient_permission (connected but not admin, reported by callers per
   * action) | throttled | unreachable.
   */
  async health({ force = false } = {}) {
    const checkedAt = new Date(this.now()).toISOString();
    if (!this.configured()) {
      return { state: "unconfigured", checkedAt, baseUrlConfigured: Boolean(this.baseUrl), teamConfigured: Boolean(this.teamId) };
    }
    try {
      const snapshot = await this.bootstrap({ force });
      return {
        state: "connected",
        checkedAt,
        identity: {
          name: snapshot?.user?.name || "",
          email: snapshot?.user?.email || "",
          role: snapshot?.user?.role || "",
        },
        timezone: snapshot?.timezone || "",
        today: snapshot?.today || "",
        lastSuccessAt: this.lastSuccessAt,
      };
    } catch (error) {
      const state = error?.status === 401 ? "auth_failed"
        : error?.status === 429 ? "throttled"
        : error?.status === 403 ? "insufficient_permission"
        : noStatus(error) ? "unreachable"
        : "degraded";
      return { state, checkedAt, error: error?.message || "Worklog is unavailable.", status: error?.status || null, lastSuccessAt: this.lastSuccessAt };
    }
  }
}

export function classifyWorklogError(error) {
  if (error?.name !== "WorklogError") return isNetworkError(error) ? "unreachable" : "internal";
  if (!error.status) return "unreachable";
  if (error.status === 401) return "auth_failed";
  if (error.status === 403) return "permission_denied";
  if (error.status === 429) return "throttled";
  return "rejected";
}

export { WorklogError };

let connector = null;
export function getWorklogConnector() {
  if (!connector) {
    connector = new WorklogConnector({
      baseUrl: process.env.CORE_WORKLOG_BASE_URL || "",
      email: process.env.CORE_WORKLOG_EMAIL || "",
      password: process.env.CORE_WORKLOG_PASSWORD || "",
      teamId: process.env.CORE_WORKLOG_TEAM_ID || "",
    });
  }
  return connector;
}
export function __resetWorklogConnectorForTests() { connector = null; }
