import crypto from "node:crypto";
import { createCoreId } from "../core/ids.js";
import {
  INTEGRATION_OPERATION_STATES,
  WORKLOG_CONNECTOR,
  WORKLOG_EXTERNAL_SYSTEM,
  requireWorklogAction,
  requireWorklogLinkRule,
} from "./registry.js";
import { classifyWorklogError } from "./worklogConnector.js";

const REQUEST_ROLES = ["owner", "admin", "sales"];
const APPROVAL_ROLES = ["owner", "admin"];
const DELIVERY_READY_STAGES = new Set(["won", "delivery", "delivery_ready"]);

const iso = (value = new Date()) => new Date(value).toISOString();
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

function required(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw Object.assign(new Error(`${name} is required.`), { status: 400 });
  return text;
}
function role(actor, allowed) {
  if (!allowed.includes(actor?.role)) throw Object.assign(new Error("Forbidden."), { status: 403 });
}
function fail(message, status, code, extra = {}) {
  throw Object.assign(new Error(message), { status, code, ...extra });
}
/** Deterministic JSON with sorted keys, so checksums and idempotency keys are stable. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
const normalizeName = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const taskMarker = (operationId, index) => `[core:${operationId}#${index}]`;

export class WorklogOperationsService {
  constructor({ teamId, actor, repository, connector, now = () => new Date(), idFactory = createCoreId }) {
    this.teamId = required(teamId, "teamId");
    this.actor = actor || {};
    this.repository = repository;
    this.connector = connector;
    this.now = now;
    this.idFactory = idFactory;
  }

  at() { return iso(this.now()); }

  async activity(input, repository = this.repository) {
    const at = this.at();
    return repository.createActivity({
      id: this.idFactory("activity"), teamId: this.teamId, tenantId: input.tenantId || "",
      companyId: input.companyId || "", contactId: "", opportunityId: input.opportunityId || "",
      campaignId: "", messageId: "", activityType: input.activityType, occurredAt: at,
      actorType: input.actorType || "user", actorId: input.actorId || this.actor.id || "",
      summary: input.summary || "", metadata: input.metadata || {}, createdAt: at, updatedAt: at,
    });
  }

  async exception(input) {
    const at = this.at();
    return this.repository.createOperationException({
      id: this.idFactory("operationException"), teamId: this.teamId,
      exceptionType: input.exceptionType, severity: input.severity || "warning",
      sourceEntityType: input.sourceEntityType, sourceEntityId: input.sourceEntityId,
      status: "open", summary: input.summary, details: input.details || {}, createdAt: at, updatedAt: at,
    });
  }

  async getCompany(id) {
    const company = await this.repository.getCompany(required(id, "companyId"), this.teamId);
    if (!company) fail("Company is not available to this team.", 404, "company_not_found");
    return company;
  }

  async getOpportunity(id) {
    const opportunity = await this.repository.getOpportunity(required(id, "opportunityId"), this.teamId);
    if (!opportunity) fail("Opportunity is not available to this team.", 404, "opportunity_not_found");
    return opportunity;
  }

  // ------------------------------------------------------------ link helpers

  async linkedLinkFor(localEntityType, localEntityId, externalObjectType) {
    const links = await this.repository.listExternalLinksForEntity(this.teamId, localEntityType, localEntityId, WORKLOG_EXTERNAL_SYSTEM);
    return links.find((link) => link.syncState === "linked" && link.externalObjectType === externalObjectType) || null;
  }

  appendHistory(link, event, detail = {}) {
    const history = Array.isArray(link?.linkHistory) ? link.linkHistory : [];
    return [...history, { event, at: this.at(), by: this.actor.id || "", ...detail }];
  }

  /**
   * Create or revive the external_links row identified by the full unique key.
   * Re-linking a retired relationship transitions the same row and appends to
   * its history rather than inserting a duplicate.
   */
  async upsertLink({ localEntityType, localEntityId, externalObjectType, externalId, metadata = {}, tenantId = "" }, repository = this.repository) {
    requireWorklogLinkRule(localEntityType, externalObjectType);
    const at = this.at();
    const rows = await repository.listExternalLinksForEntity(this.teamId, localEntityType, localEntityId, WORKLOG_EXTERNAL_SYSTEM);
    const existing = rows.find((row) => row.externalObjectType === externalObjectType && String(row.externalId) === String(externalId));
    if (existing && existing.syncState === "linked") return { link: existing, created: false };
    if (existing) {
      const link = await repository.updateExternalLink(existing.id, this.teamId, {
        syncState: "linked", metadata: { ...existing.metadata, ...metadata }, linkedBy: this.actor.id || "",
        linkedAt: at, lastVerifiedAt: at, lastVerifiedState: "verified",
        linkHistory: this.appendHistory(existing, "relinked"), updatedAt: at,
      }, ["retired"]);
      if (!link) fail("The link changed while relinking; reload and retry.", 409, "link_conflict");
      return { link, created: true };
    }
    const created = await repository.createExternalLink({
      id: this.idFactory("externalLink"), teamId: this.teamId, tenantId,
      localEntityType, localEntityId, externalSystem: WORKLOG_EXTERNAL_SYSTEM,
      externalObjectType, externalId: String(externalId),
      externalUrl: this.connector.baseUrl ? `${this.connector.baseUrl}/` : "",
      syncCursor: "", syncState: "linked", metadata, createdAt: at, updatedAt: at,
    });
    const link = await repository.updateExternalLink(created.id, this.teamId, {
      linkedBy: this.actor.id || "", linkedAt: at, lastVerifiedAt: at, lastVerifiedState: "verified",
      linkHistory: this.appendHistory(created, "linked"), updatedAt: at,
    });
    return { link: link || created, created: true };
  }

  // ------------------------------------------------------- company <-> client

  /**
   * Candidate matching is presentation for an explicit human choice; it never
   * links anything. Exactly one exact name match reports probable_match, more
   * than one exact or several partials report multiple_candidates.
   */
  async matchCompanyClients(companyId) {
    const company = await this.getCompany(companyId);
    const existing = await this.linkedLinkFor("company", company.id, "client");
    const { clients = [] } = await this.connector.clients();
    const names = [normalizeName(company.displayName), normalizeName(company.legalName)].filter(Boolean);
    const exact = clients.filter((client) => names.includes(normalizeName(client.name)));
    const partial = clients.filter((client) => !exact.includes(client)
      && names.some((name) => name && (normalizeName(client.name).includes(name) || name.includes(normalizeName(client.name)))));
    const candidates = [...exact.map((client) => ({ ...client, matchKind: "exact" })), ...partial.map((client) => ({ ...client, matchKind: "partial" }))];
    const state = existing ? "linked"
      : exact.length === 1 ? "probable_match"
      : candidates.length > 1 ? "multiple_candidates"
      : candidates.length === 1 ? "candidate"
      : "no_match";
    return { company, link: existing, state, candidates, fetchedAt: this.at() };
  }

  async linkCompanyToClient(companyId, clientId) {
    role(this.actor, REQUEST_ROLES);
    this.connector.assertTeam(this.teamId);
    const company = await this.getCompany(companyId);
    const { clients = [] } = await this.connector.clients({ force: true });
    const client = clients.find((row) => String(row.id) === String(required(clientId, "clientId")));
    if (!client) fail("That Worklog client no longer exists. Worklog prunes clients with no projects.", 404, "worklog_client_missing");
    const existing = await this.linkedLinkFor("company", company.id, "client");
    if (existing && String(existing.externalId) !== String(client.id)) {
      fail("This company is already linked to a different Worklog client. Unlink it first.", 409, "link_conflict");
    }
    const { link, created } = await this.upsertLink({
      localEntityType: "company", localEntityId: company.id, externalObjectType: "client",
      externalId: client.id, metadata: { name: client.name, projects: client.projects },
      tenantId: company.tenantId || "",
    });
    if (created) {
      await this.activity({ companyId: company.id, activityType: "worklog_client_linked", summary: `Linked Worklog client "${client.name}".`, metadata: { clientId: String(client.id) } });
    }
    return { link, client, created };
  }

  // -------------------------------------------------- opportunity <-> project

  async matchOpportunityProjects(opportunityId) {
    const opportunity = await this.getOpportunity(opportunityId);
    const existing = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    const companyLink = opportunity.companyId ? await this.linkedLinkFor("company", opportunity.companyId, "client") : null;
    const { projects = [] } = await this.connector.projects();
    const active = projects.filter((project) => project.status !== "archived");
    const nameMatch = (project) => normalizeName(project.name) === normalizeName(opportunity.name);
    const candidates = active
      .filter((project) => (companyLink ? String(project.clientId ?? "") === String(companyLink.externalId) : nameMatch(project)))
      .map((project) => ({ ...project, matchKind: nameMatch(project) ? "exact" : "client" }));
    const exact = candidates.filter((candidate) => candidate.matchKind === "exact");
    const state = existing ? "linked"
      : exact.length === 1 ? "probable_match"
      : candidates.length > 1 ? "multiple_candidates"
      : candidates.length === 1 ? "candidate"
      : "no_match";
    return { opportunity, link: existing, companyLink, state, candidates, fetchedAt: this.at() };
  }

  async linkOpportunityToProject(opportunityId, projectId) {
    role(this.actor, REQUEST_ROLES);
    this.connector.assertTeam(this.teamId);
    const opportunity = await this.getOpportunity(opportunityId);
    const { projects = [] } = await this.connector.projects({ force: true });
    const project = projects.find((row) => String(row.id) === String(required(projectId, "projectId")));
    if (!project) fail("That Worklog project no longer exists.", 404, "worklog_project_missing");

    const existing = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    if (existing && String(existing.externalId) !== String(project.id)) {
      fail("This opportunity is already linked to a different Worklog project. Unlink it first.", 409, "link_conflict");
    }
    const claims = await this.repository.listExternalLinksBySystem(this.teamId, WORKLOG_EXTERNAL_SYSTEM, {
      externalObjectType: "project", externalId: String(project.id), syncState: "linked", localEntityType: "opportunity",
    });
    const foreignClaim = claims.find((claim) => claim.localEntityId !== opportunity.id);
    if (foreignClaim) {
      fail(`Worklog project "${project.name}" is already linked to another opportunity. One delivery project belongs to one opportunity.`, 409, "worklog_project_already_claimed");
    }

    const companyLink = opportunity.companyId ? await this.linkedLinkFor("company", opportunity.companyId, "client") : null;
    if (companyLink && project.clientId && String(project.clientId) !== String(companyLink.externalId)) {
      await this.exception({
        exceptionType: "worklog_client_mismatch", sourceEntityType: "opportunity", sourceEntityId: opportunity.id,
        summary: `Project "${project.name}" belongs to Worklog client "${project.clientName}", but the company is linked to a different client.`,
        details: { projectId: String(project.id), projectClientId: String(project.clientId), linkedClientId: String(companyLink.externalId) },
      });
      fail("That project belongs to a different Worklog client than this company is linked to. Resolve the client link first.", 409, "worklog_client_mismatch");
    }

    let companyLinkResult = null;
    if (!companyLink && opportunity.companyId && project.clientId) {
      companyLinkResult = await this.upsertLink({
        localEntityType: "company", localEntityId: opportunity.companyId, externalObjectType: "client",
        externalId: project.clientId, metadata: { name: project.clientName || "" },
      });
      if (companyLinkResult.created) {
        await this.activity({ companyId: opportunity.companyId, activityType: "worklog_client_linked", summary: `Linked Worklog client "${project.clientName}" via project link.`, metadata: { clientId: String(project.clientId) } });
      }
    }

    const { link, created } = await this.upsertLink({
      localEntityType: "opportunity", localEntityId: opportunity.id, externalObjectType: "project",
      externalId: project.id, metadata: { name: project.name, code: project.code || "", clientId: project.clientId ?? null, clientName: project.clientName || "" },
      tenantId: opportunity.tenantId || "",
    });
    if (created) {
      await this.activity({ opportunityId: opportunity.id, companyId: opportunity.companyId || "", activityType: "worklog_project_linked", summary: `Linked Worklog project "${project.name}".`, metadata: { projectId: String(project.id) } });
    }
    await this.snapshotProject(link, project, { recordTransitions: false });
    return { link, project, created, companyLink: companyLinkResult?.link || companyLink };
  }

  async unlink(linkId, { reason = "" } = {}) {
    role(this.actor, REQUEST_ROLES);
    const link = await this.repository.getExternalLinkById(required(linkId, "linkId"), this.teamId);
    if (!link || link.externalSystem !== WORKLOG_EXTERNAL_SYSTEM) fail("Worklog link not found.", 404, "link_not_found");
    const at = this.at();
    const updated = await this.repository.updateExternalLink(link.id, this.teamId, {
      syncState: "retired", linkHistory: this.appendHistory(link, "retired", reason ? { reason } : {}), updatedAt: at,
    }, ["linked"]);
    if (!updated) fail("The link is not currently active.", 409, "link_conflict");
    await this.activity({
      companyId: link.localEntityType === "company" ? link.localEntityId : "",
      opportunityId: link.localEntityType === "opportunity" ? link.localEntityId : "",
      activityType: `worklog_${link.externalObjectType}_unlinked`,
      summary: `Unlinked Worklog ${link.externalObjectType} "${link.metadata?.name || link.externalId}". The Worklog record itself is untouched.`,
      metadata: { externalId: link.externalId, reason },
    });
    return updated;
  }

  /**
   * Explicit repair: the user names the replacement external object; Core
   * verifies it exists, retires the stale row, and links the new identity.
   * A stale link is never silently repointed.
   */
  async repairLink(linkId, { externalId } = {}) {
    role(this.actor, REQUEST_ROLES);
    this.connector.assertTeam(this.teamId);
    const link = await this.repository.getExternalLinkById(required(linkId, "linkId"), this.teamId);
    if (!link || link.externalSystem !== WORKLOG_EXTERNAL_SYSTEM) fail("Worklog link not found.", 404, "link_not_found");
    const target = required(externalId, "externalId");
    let name = "";
    if (link.externalObjectType === "project") {
      const { projects = [] } = await this.connector.projects({ force: true });
      const project = projects.find((row) => String(row.id) === String(target));
      if (!project) fail("The replacement Worklog project does not exist.", 404, "worklog_project_missing");
      name = project.name;
    } else if (link.externalObjectType === "client") {
      const { clients = [] } = await this.connector.clients({ force: true });
      const client = clients.find((row) => String(row.id) === String(target));
      if (!client) fail("The replacement Worklog client does not exist.", 404, "worklog_client_missing");
      name = client.name;
    } else {
      fail("Only client and project links can be repaired.", 400, "invalid_link_rule");
    }
    const at = this.at();
    await this.repository.updateExternalLink(link.id, this.teamId, {
      syncState: "retired", linkHistory: this.appendHistory(link, "repaired_away", { replacementExternalId: String(target) }), updatedAt: at,
    }, ["linked", "retired"]);
    const { link: repaired } = await this.upsertLink({
      localEntityType: link.localEntityType, localEntityId: link.localEntityId,
      externalObjectType: link.externalObjectType, externalId: target,
      metadata: { ...link.metadata, name, repairedFrom: link.externalId }, tenantId: link.tenantId || "",
    });
    await this.activity({
      companyId: link.localEntityType === "company" ? link.localEntityId : "",
      opportunityId: link.localEntityType === "opportunity" ? link.localEntityId : "",
      activityType: "worklog_link_repaired",
      summary: `Repaired Worklog ${link.externalObjectType} link to "${name}".`,
      metadata: { previousExternalId: link.externalId, externalId: String(target) },
    });
    return repaired;
  }

  // ------------------------------------------------- consequential operations

  deterministicProjectCode(opportunityId) {
    return `C4-${sha256(`${this.teamId}:${opportunityId}:project.create`).slice(0, 8).toUpperCase()}`;
  }

  /** Pure preview of the delivery-project handoff; creates nothing anywhere. */
  async previewProjectHandoff(opportunityId, input = {}) {
    const opportunity = await this.getOpportunity(opportunityId);
    const company = opportunity.companyId ? await this.repository.getCompany(opportunity.companyId, this.teamId) : null;
    const companyLink = company ? await this.linkedLinkFor("company", company.id, "client") : null;
    const clientName = companyLink?.metadata?.name || String(input.clientName || company?.displayName || "").trim();
    const payload = {
      name: String(input.name || opportunity.name || "").trim().slice(0, 120),
      clientName: clientName.slice(0, 120),
      code: this.deterministicProjectCode(opportunity.id),
      billable: input.billable === undefined ? true : Boolean(input.billable),
      budgetMinutes: Number.isFinite(Number(input.budgetMinutes)) && Number(input.budgetMinutes) > 0 ? Math.floor(Number(input.budgetMinutes)) : null,
    };
    return {
      opportunity, company, companyLink, payload,
      willCreateClient: !companyLink && Boolean(payload.clientName),
      deliveryReady: DELIVERY_READY_STAGES.has(String(opportunity.stage || "").toLowerCase()),
    };
  }

  async requestProjectHandoff(opportunityId, input = {}) {
    role(this.actor, REQUEST_ROLES);
    this.connector.assertTeam(this.teamId);
    const preview = await this.previewProjectHandoff(opportunityId, input);
    if (await this.linkedLinkFor("opportunity", preview.opportunity.id, "project")) {
      fail("This opportunity is already linked to a Worklog project.", 409, "already_linked");
    }
    required(preview.payload.name, "project name");
    required(preview.payload.clientName, "client name");
    const action = requireWorklogAction("project.create");
    const at = this.at();
    const operation = await this.repository.createIntegrationOperation({
      id: this.idFactory("integrationOperation"), teamId: this.teamId, tenantId: preview.opportunity.tenantId || "",
      connectorId: WORKLOG_CONNECTOR.id, action: action.id,
      localEntityType: "opportunity", localEntityId: preview.opportunity.id,
      payload: preview.payload, payloadChecksum: "", status: "draft",
      idempotencyKey: sha256(canonical({ connector: WORKLOG_CONNECTOR.id, action: action.id, entity: preview.opportunity.id, payload: preview.payload })),
      requestedBy: this.actor.id || "", requestedAt: at, attemptCount: 0,
      resultMetadata: {}, errorMetadata: {}, createdAt: at, updatedAt: at,
    });
    return { operation, preview };
  }

  async requestTaskHandoff(opportunityId, { items = [] } = {}) {
    role(this.actor, REQUEST_ROLES);
    this.connector.assertTeam(this.teamId);
    const opportunity = await this.getOpportunity(opportunityId);
    const link = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    if (!link) fail("Link a Worklog project before handing off tasks.", 409, "not_linked");
    const action = requireWorklogAction("tasks.create");
    if (!Array.isArray(items) || !items.length) fail("At least one task is required.", 400);
    if (items.length > action.maxItems) fail(`At most ${action.maxItems} tasks per handoff.`, 400, "too_many_tasks");

    const cleanItems = [];
    for (const item of items) {
      const title = required(item.title, "task title").slice(0, 200);
      const notes = String(item.notes || "").trim();
      if (notes.length > 3800) fail("Task notes must stay under 3800 characters.", 400);
      const priority = ["low", "normal", "high"].includes(item.priority) ? item.priority : "normal";
      const estimateMinutes = Number.isFinite(Number(item.estimateMinutes)) && Number(item.estimateMinutes) > 0 ? Math.floor(Number(item.estimateMinutes)) : null;
      const dueDate = item.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : null;
      const assigneeId = Number.isFinite(Number(item.assigneeId)) && item.assigneeId !== "" && item.assigneeId !== null && item.assigneeId !== undefined ? Number(item.assigneeId) : null;
      let artifactRef = null;
      if (item.artifactId) {
        const artifact = await this.repository.getArtifact(item.artifactId, this.teamId);
        if (!artifact) fail("Artifact is not available to this team.", 404, "artifact_not_found");
        if (!["approved", "deployed"].includes(artifact.status)) fail("Only approved artifacts can be handed off.", 409, "artifact_not_approved");
        artifactRef = {
          artifactId: artifact.id, slug: artifact.slug, versionNumber: artifact.versionNumber,
          contentChecksum: artifact.contentChecksum || "", deploymentUrl: artifact.deploymentUrl || "",
        };
      }
      cleanItems.push({ title, notes, priority, estimateMinutes, dueDate, assigneeId, artifactRef });
    }

    const payload = { projectExternalId: String(link.externalId), items: cleanItems };
    const at = this.at();
    const operation = await this.repository.createIntegrationOperation({
      id: this.idFactory("integrationOperation"), teamId: this.teamId, tenantId: opportunity.tenantId || "",
      connectorId: WORKLOG_CONNECTOR.id, action: action.id,
      localEntityType: "opportunity", localEntityId: opportunity.id,
      payload, payloadChecksum: "", status: "draft",
      idempotencyKey: sha256(canonical({ connector: WORKLOG_CONNECTOR.id, action: action.id, entity: opportunity.id, payload })),
      requestedBy: this.actor.id || "", requestedAt: at, attemptCount: 0,
      resultMetadata: { items: [] }, errorMetadata: {}, createdAt: at, updatedAt: at,
    });
    return { operation, link, opportunity };
  }

  async getOperation(id) {
    const operation = await this.repository.getIntegrationOperation(required(id, "operationId"), this.teamId);
    if (!operation) fail("Integration operation not found.", 404, "operation_not_found");
    return operation;
  }

  async approveOperation(id) {
    role(this.actor, APPROVAL_ROLES);
    const operation = await this.getOperation(id);
    const at = this.at();
    const approved = await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
      status: "approved", approvedBy: this.actor.id || "", approvedAt: at,
      payloadChecksum: sha256(canonical(operation.payload)), updatedAt: at,
    }, ["draft"]);
    if (!approved) fail("Only a draft operation can be approved.", 409, "invalid_state");
    return approved;
  }

  async cancelOperation(id) {
    role(this.actor, REQUEST_ROLES);
    const operation = await this.getOperation(id);
    const cancelled = await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
      status: "cancelled", completedAt: this.at(), updatedAt: this.at(),
    }, ["draft", "approved"]);
    if (!cancelled) fail("Only a draft or approved operation can be cancelled.", 409, "invalid_state");
    return cancelled;
  }

  /** From `failed` only; `outcome_unknown` must go through reconcile first. */
  async retryOperation(id) {
    role(this.actor, APPROVAL_ROLES);
    const operation = await this.getOperation(id);
    const retried = await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
      status: "approved", updatedAt: this.at(),
    }, ["failed"]);
    if (!retried) fail("Only a failed operation can be re-approved. An unknown outcome must be reconciled first.", 409, "invalid_state");
    return retried;
  }

  async executeOperation(id) {
    role(this.actor, APPROVAL_ROLES);
    this.connector.assertTeam(this.teamId);
    const operation = await this.getOperation(id);
    if (operation.payloadChecksum && operation.payloadChecksum !== sha256(canonical(operation.payload))) {
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, { status: "cancelled", errorMetadata: { code: "payload_tampered" }, completedAt: this.at(), updatedAt: this.at() }, [operation.status]);
      fail("The operation payload no longer matches its approval; approval is invalidated.", 409, "payload_tampered");
    }
    const at = this.at();
    const executing = await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
      status: "executing", startedAt: at, attemptCount: Number(operation.attemptCount || 0) + 1, updatedAt: at,
    }, ["approved"]);
    if (!executing) fail("Only an approved operation can be executed.", 409, "invalid_state");

    try {
      if (executing.action === "project.create") return await this.#executeProjectCreate(executing);
      if (executing.action === "tasks.create") return await this.#executeTasksCreate(executing);
      throw Object.assign(new Error(`Unknown operation action: ${executing.action}.`), { status: 400 });
    } catch (error) {
      if (error?.operationHandled) throw error;
      return this.#failFromError(executing, error);
    }
  }

  /** Route a thrown error into approved-again, failed, or outcome_unknown. */
  async #failFromError(operation, error, { wrote = false } = {}) {
    const kind = classifyWorklogError(error);
    const at = this.at();
    const detail = { code: kind, message: error?.message || "Worklog operation failed.", status: error?.status || null };
    if (kind === "unreachable" && wrote) {
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "outcome_unknown", uncertainAt: at, errorMetadata: { ...detail, phase: "write" }, updatedAt: at,
      }, ["executing"]);
      await this.exception({
        exceptionType: "worklog_operation_outcome_unknown", severity: "error",
        sourceEntityType: "integration_operation", sourceEntityId: operation.id,
        summary: `Worklog may have accepted "${operation.action}" but the response was lost. Reconcile before retrying.`,
        details: detail,
      });
      throw Object.assign(new Error("The Worklog response was lost after the request was sent. The operation is quarantined for reconciliation."), { status: 502, code: "outcome_unknown", operationHandled: true });
    }
    if (kind === "unreachable" || kind === "throttled") {
      // Transient, nothing was committed: return to approved so an operator
      // can execute again once Worklog is reachable. No exception spam.
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "approved", errorMetadata: { ...detail, phase: wrote ? "write" : "pre_write" }, updatedAt: at,
      }, ["executing"]);
      throw Object.assign(new Error(`Worklog is unavailable (${error?.message || "no response"}); the operation stays approved for a later attempt.`), { status: 503, code: kind, operationHandled: true });
    }
    await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
      status: "failed", errorMetadata: { ...detail, phase: wrote ? "write" : "pre_write" }, completedAt: at, updatedAt: at,
    }, ["executing"]);
    await this.exception({
      exceptionType: kind === "auth_failed" ? "worklog_auth_failed" : kind === "permission_denied" ? "worklog_permission_denied" : "worklog_operation_rejected",
      severity: "error", sourceEntityType: "integration_operation", sourceEntityId: operation.id,
      summary: `Worklog rejected "${operation.action}": ${detail.message}`, details: detail,
    });
    throw Object.assign(new Error(error?.message || "The Worklog operation failed."), { status: error?.status || 502, code: kind, operationHandled: true });
  }

  async #requireWorklogRole(operation, requiredRole) {
    const snapshot = await this.connector.bootstrap({ force: true });
    const worklogRole = snapshot?.user?.role || "";
    if (requiredRole === "admin" && worklogRole !== "admin") {
      const at = this.at();
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "failed", errorMetadata: { code: "integration_identity_not_admin", worklogRole }, completedAt: at, updatedAt: at,
      }, ["executing"]);
      await this.exception({
        exceptionType: "worklog_permission_denied", severity: "error",
        sourceEntityType: "integration_operation", sourceEntityId: operation.id,
        summary: `"${operation.action}" needs a Worklog admin, but the integration account "${snapshot?.user?.email || ""}" is a ${worklogRole || "unknown role"}.`,
        details: { worklogRole },
      });
      fail("The Worklog integration account lacks admin permission for this operation.", 403, "worklog_permission_denied", { operationHandled: true });
    }
    return snapshot;
  }

  async #finalizeProjectCreate(operation, project, { adopted = false } = {}) {
    const at = this.at();
    const opportunity = await this.getOpportunity(operation.localEntityId);
    const result = await this.repository.transaction(async (repository) => {
      const done = await repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "succeeded", externalResultType: "project", externalResultId: String(project.id),
        resultMetadata: { project, adopted }, completedAt: at, updatedAt: at,
      }, ["executing"]);
      if (!done) fail("The operation state changed during finalization.", 409, "invalid_state");
      let companyLinkCreated = false;
      if (opportunity.companyId && project.clientId) {
        const existingClientLink = await this.linkedLinkFor("company", opportunity.companyId, "client");
        if (!existingClientLink) {
          await this.upsertLink({
            localEntityType: "company", localEntityId: opportunity.companyId, externalObjectType: "client",
            externalId: project.clientId, metadata: { name: project.clientName || "" },
          }, repository);
          companyLinkCreated = true;
        }
      }
      const { link } = await this.upsertLink({
        localEntityType: "opportunity", localEntityId: opportunity.id, externalObjectType: "project",
        externalId: project.id, metadata: { name: project.name, code: project.code || "", clientId: project.clientId ?? null, clientName: project.clientName || "" },
        tenantId: opportunity.tenantId || "",
      }, repository);
      await this.activity({
        opportunityId: opportunity.id, companyId: opportunity.companyId || "",
        activityType: adopted ? "worklog_project_linked" : "worklog_project_created",
        summary: adopted
          ? `Adopted existing Worklog project "${project.name}" (deterministic code match).`
          : `Created Worklog delivery project "${project.name}"${project.clientName ? ` for client "${project.clientName}"` : ""}.`,
        metadata: { projectId: String(project.id), operationId: operation.id },
      }, repository);
      if (companyLinkCreated) {
        await this.activity({
          companyId: opportunity.companyId, activityType: "worklog_client_linked",
          summary: `Linked Worklog client "${project.clientName}" created with the delivery project.`,
          metadata: { clientId: String(project.clientId), operationId: operation.id },
        }, repository);
      }
      return { operation: done, link, project };
    });
    await this.snapshotProject(result.link, project, { recordTransitions: false });
    return result;
  }

  async #executeProjectCreate(operation) {
    await this.#requireWorklogRole(operation, "admin");
    const payload = operation.payload || {};
    const { projects = [] } = await this.connector.projects({ force: true });

    // Deterministic recovery marker: the auto-generated project code.
    const marked = projects.find((project) => String(project.code || "").toUpperCase() === String(payload.code || "").toUpperCase());
    if (marked) return this.#finalizeProjectCreate(operation, marked, { adopted: true });

    const collision = projects.find((project) => project.status !== "archived"
      && normalizeName(project.name) === normalizeName(payload.name)
      && normalizeName(project.clientName || "") === normalizeName(payload.clientName || ""));
    if (collision) {
      const at = this.at();
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "failed", errorMetadata: { code: "ambiguous_project_match", projectId: String(collision.id) }, completedAt: at, updatedAt: at,
      }, ["executing"]);
      await this.exception({
        exceptionType: "worklog_ambiguous_project_match", severity: "error",
        sourceEntityType: "integration_operation", sourceEntityId: operation.id,
        summary: `A Worklog project named "${payload.name}" already exists for client "${payload.clientName}". Link it explicitly instead of creating a duplicate.`,
        details: { projectId: String(collision.id) },
      });
      fail("A Worklog project with this name already exists for this client. Link it explicitly instead.", 409, "ambiguous_project_match", { operationHandled: true });
    }

    let created;
    try {
      created = await this.connector.createProject({
        name: payload.name, clientName: payload.clientName, code: payload.code,
        billable: payload.billable, budgetMinutes: payload.budgetMinutes ?? undefined,
      });
    } catch (error) {
      return this.#failFromError(operation, error, { wrote: true });
    }
    return this.#finalizeProjectCreate(operation, created.project);
  }

  async #executeTasksCreate(operation) {
    const payload = operation.payload || {};
    const { projects = [] } = await this.connector.projects({ force: true });
    const project = projects.find((row) => String(row.id) === String(payload.projectExternalId));
    if (!project) {
      const at = this.at();
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "failed", errorMetadata: { code: "stale_external_project" }, completedAt: at, updatedAt: at,
      }, ["executing"]);
      await this.exception({
        exceptionType: "worklog_stale_external_link", severity: "error",
        sourceEntityType: "integration_operation", sourceEntityId: operation.id,
        summary: "The linked Worklog project no longer exists; repair the link before creating tasks.",
        details: { projectExternalId: String(payload.projectExternalId) },
      });
      fail("The linked Worklog project no longer exists. Repair the link first.", 409, "stale_external_link", { operationHandled: true });
    }

    const snapshot = await this.connector.bootstrap();
    const validUserIds = new Set((snapshot?.users || []).map((user) => Number(user.id)));
    for (const item of payload.items || []) {
      if (item.assigneeId !== null && item.assigneeId !== undefined && !validUserIds.has(Number(item.assigneeId))) {
        const at = this.at();
        await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
          status: "failed", errorMetadata: { code: "unknown_assignee", assigneeId: item.assigneeId }, completedAt: at, updatedAt: at,
        }, ["executing"]);
        fail(`Worklog has no user with id ${item.assigneeId}.`, 400, "unknown_assignee", { operationHandled: true });
      }
    }

    const { tasks = [] } = await this.connector.tasks({ force: true, includeArchived: true });
    const recorded = Array.isArray(operation.resultMetadata?.items) ? [...operation.resultMetadata.items] : [];
    const items = payload.items || [];
    const createdTaskIds = [];

    for (let index = 0; index < items.length; index += 1) {
      if (recorded[index]?.taskId) { createdTaskIds.push(recorded[index].taskId); continue; }
      const marker = taskMarker(operation.id, index);
      const already = tasks.find((task) => String(task.notes || "").includes(marker));
      if (already) {
        recorded[index] = { taskId: String(already.id), title: already.title, adopted: true };
        createdTaskIds.push(String(already.id));
        await this.repository.updateIntegrationOperation(operation.id, this.teamId, { resultMetadata: { ...operation.resultMetadata, items: recorded }, updatedAt: this.at() }, ["executing"]);
        continue;
      }
      const item = items[index];
      const artifactNote = item.artifactRef
        ? `Artifact: ${item.artifactRef.slug} v${item.artifactRef.versionNumber}${item.artifactRef.deploymentUrl ? ` ${item.artifactRef.deploymentUrl}` : ""} (checksum ${String(item.artifactRef.contentChecksum).slice(0, 12)})\n\n`
        : "";
      let created;
      try {
        created = await this.connector.createTask({
          title: item.title,
          notes: `${artifactNote}${item.notes ? `${item.notes}\n\n` : ""}${marker}`,
          projectId: Number(payload.projectExternalId),
          assigneeId: item.assigneeId ?? null,
          status: "todo",
          priority: item.priority,
          estimateMinutes: item.estimateMinutes ?? undefined,
          dueDate: item.dueDate ?? undefined,
        });
      } catch (error) {
        await this.repository.updateIntegrationOperation(operation.id, this.teamId, { resultMetadata: { ...operation.resultMetadata, items: recorded }, updatedAt: this.at() }, ["executing"]);
        return this.#failFromError(operation, error, { wrote: true });
      }
      recorded[index] = { taskId: String(created.task.id), title: created.task.title };
      createdTaskIds.push(String(created.task.id));
      await this.repository.updateIntegrationOperation(operation.id, this.teamId, { resultMetadata: { ...operation.resultMetadata, items: recorded }, updatedAt: this.at() }, ["executing"]);
    }

    const at = this.at();
    const opportunity = await this.getOpportunity(operation.localEntityId);
    const result = await this.repository.transaction(async (repository) => {
      const done = await repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "succeeded", externalResultType: "task", externalResultId: createdTaskIds.join(","),
        resultMetadata: { ...operation.resultMetadata, items: recorded }, completedAt: at, updatedAt: at,
      }, ["executing"]);
      if (!done) fail("The operation state changed during finalization.", 409, "invalid_state");
      for (let index = 0; index < items.length; index += 1) {
        const ref = items[index]?.artifactRef;
        if (ref?.artifactId && recorded[index]?.taskId) {
          await this.upsertLink({
            localEntityType: "artifact", localEntityId: ref.artifactId, externalObjectType: "task",
            externalId: recorded[index].taskId,
            metadata: { title: recorded[index].title, artifactVersion: ref.versionNumber, contentChecksum: ref.contentChecksum },
          }, repository);
        }
      }
      await this.activity({
        opportunityId: opportunity.id, companyId: opportunity.companyId || "",
        activityType: "worklog_tasks_created",
        summary: `Created ${createdTaskIds.length} Worklog delivery task${createdTaskIds.length === 1 ? "" : "s"} in "${project.name}".`,
        metadata: { taskIds: createdTaskIds, operationId: operation.id, projectId: String(project.id) },
      }, repository);
      return { operation: done, taskIds: createdTaskIds };
    });
    // Baseline the task-observation snapshot so later completions of these
    // tasks are deterministic transitions, not pre-observation history.
    const link = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    if (link) {
      const { tasks: freshTasks = [] } = await this.connector.tasks({ force: true, includeArchived: true });
      await this.snapshotProject(link, project, { recordTransitions: false, tasks: freshTasks, today: snapshot?.today || "" });
    }
    return result;
  }

  /**
   * Deterministic reconciliation for lost responses. Looks for the exact
   * recovery marker (project code / task note marker); adopts what it finds,
   * or returns the operation to `approved` when Worklog provably holds no
   * result yet. Never guesses.
   */
  async reconcileOperation(id) {
    role(this.actor, APPROVAL_ROLES);
    this.connector.assertTeam(this.teamId);
    const operation = await this.getOperation(id);
    if (!["outcome_unknown", "executing"].includes(operation.status)) {
      fail("Only an unknown-outcome (or orphaned executing) operation can be reconciled.", 409, "invalid_state");
    }
    const revive = async () => {
      const at = this.at();
      return this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "approved", errorMetadata: { ...operation.errorMetadata, reconciledAbsentAt: at }, uncertainAt: "", updatedAt: at,
      }, [operation.status]);
    };
    if (operation.action === "project.create") {
      const { projects = [] } = await this.connector.projects({ force: true });
      const marked = projects.find((project) => String(project.code || "").toUpperCase() === String(operation.payload?.code || "").toUpperCase());
      if (marked) {
        const adopted = await this.repository.updateIntegrationOperation(operation.id, this.teamId, { status: "executing", updatedAt: this.at() }, [operation.status]);
        if (!adopted) fail("The operation state changed during reconciliation.", 409, "invalid_state");
        const finalized = await this.#finalizeProjectCreate(adopted, marked, { adopted: true });
        return { resolution: "adopted", ...finalized };
      }
      return { resolution: "absent", operation: await revive() };
    }
    if (operation.action === "tasks.create") {
      const { tasks = [] } = await this.connector.tasks({ force: true, includeArchived: true });
      const recorded = Array.isArray(operation.resultMetadata?.items) ? [...operation.resultMetadata.items] : [];
      const items = operation.payload?.items || [];
      let found = 0;
      for (let index = 0; index < items.length; index += 1) {
        if (recorded[index]?.taskId) { found += 1; continue; }
        const match = tasks.find((task) => String(task.notes || "").includes(taskMarker(operation.id, index)));
        if (match) { recorded[index] = { taskId: String(match.id), title: match.title, adopted: true }; found += 1; }
      }
      const at = this.at();
      const revived = await this.repository.updateIntegrationOperation(operation.id, this.teamId, {
        status: "approved", resultMetadata: { ...operation.resultMetadata, items: recorded },
        errorMetadata: { ...operation.errorMetadata, reconciledAt: at, itemsFound: found, itemsExpected: items.length }, uncertainAt: "", updatedAt: at,
      }, [operation.status]);
      return { resolution: found >= items.length ? "adopted_pending_finalize" : "partial", operation: revived, found, expected: items.length };
    }
    fail(`Reconciliation is not defined for action ${operation.action}.`, 400);
  }

  // ------------------------------------------------------------- read-through

  /** Persisted read-through snapshot with deterministic transition Activities. */
  async snapshotProject(link, project, { recordTransitions = true, tasks = null, today = "" } = {}) {
    const at = this.at();
    if (!project) {
      const wasVerified = link.lastVerifiedState !== "missing";
      const updated = await this.repository.updateExternalLink(link.id, this.teamId, {
        lastVerifiedAt: at, lastVerifiedState: "missing", updatedAt: at,
      });
      if (recordTransitions && wasVerified) {
        await this.exception({
          exceptionType: "worklog_stale_external_link", severity: "error",
          sourceEntityType: link.localEntityType, sourceEntityId: link.localEntityId,
          summary: `Worklog ${link.externalObjectType} ${link.externalId} ("${link.metadata?.name || ""}") no longer exists.`,
          details: { linkId: link.id, externalId: link.externalId },
        });
      }
      return { link: updated, state: "missing" };
    }

    const previous = link.statusSnapshot || {};
    const taskRows = (tasks || []).filter((task) => String(task.projectId ?? "") === String(project.id));
    const openTasks = taskRows.filter((task) => !task.archived && task.status !== "done");
    const doneTasks = taskRows.filter((task) => task.status === "done");
    const overdue = today ? openTasks.filter((task) => task.dueDate && task.dueDate < today) : [];
    const snapshot = {
      source: WORKLOG_EXTERNAL_SYSTEM,
      projectId: String(project.id), name: project.name, code: project.code || "",
      status: project.status, clientId: project.clientId ?? null, clientName: project.clientName || "",
      billable: Boolean(project.billable), budgetMinutes: project.budgetMinutes ?? null,
      loggedMinutes: project.loggedMinutes ?? 0, billableMinutes: project.billableMinutes ?? 0,
      budgetUsedPct: project.budgetMinutes ? Math.round(((project.loggedMinutes || 0) / project.budgetMinutes) * 100) : null,
      openTasks: tasks ? openTasks.length : project.openTasks ?? null,
      taskCount: tasks ? taskRows.length : project.taskCount ?? null,
      doneTasks: tasks ? doneTasks.length : null,
      overdueTasks: tasks && today ? overdue.length : null,
      today: today || previous.today || "",
      doneTaskIds: tasks ? doneTasks.map((task) => String(task.id)) : previous.doneTaskIds || [],
      tasksObserved: Boolean(tasks) || Boolean(previous.tasksObserved),
      fetchedAt: at,
    };

    if (recordTransitions) {
      if (previous.status && previous.status !== "archived" && project.status === "archived") {
        await this.activity({
          opportunityId: link.localEntityType === "opportunity" ? link.localEntityId : "",
          activityType: "worklog_project_archived", actorType: "system",
          summary: `Worklog project "${project.name}" was archived.`, metadata: { projectId: String(project.id) },
        });
      }
      // Completions are only "observed" against a previous snapshot that
      // actually carried task data — a task already done before the first
      // observation is history, not a transition.
      if (tasks && previous.tasksObserved && Array.isArray(previous.doneTaskIds)) {
        const before = new Set(previous.doneTaskIds.map(String));
        for (const task of doneTasks) {
          if (!before.has(String(task.id))) {
            await this.activity({
              opportunityId: link.localEntityType === "opportunity" ? link.localEntityId : "",
              activityType: "worklog_task_completed", actorType: "system",
              summary: `Worklog task "${task.title}" was completed.`,
              metadata: { taskId: String(task.id), projectId: String(project.id) },
            });
          }
        }
      }
    }

    const updated = await this.repository.updateExternalLink(link.id, this.teamId, {
      statusSnapshot: snapshot, snapshotAt: at, lastVerifiedAt: at,
      lastVerifiedState: project.status === "archived" ? "archived" : "verified", updatedAt: at,
    });
    return { link: updated || link, state: project.status === "archived" ? "archived" : "verified", snapshot };
  }

  async refreshOpportunityDelivery(opportunityId, { force = true } = {}) {
    const opportunity = await this.getOpportunity(opportunityId);
    const link = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    if (!link) fail("This opportunity has no linked Worklog project.", 404, "not_linked");
    this.connector.assertTeam(this.teamId);
    const [{ projects = [] }, { tasks = [] }, snapshot] = await Promise.all([
      this.connector.projects({ force }),
      this.connector.tasks({ force, includeArchived: true }),
      this.connector.bootstrap(),
    ]);
    const project = projects.find((row) => String(row.id) === String(link.externalId)) || null;
    return this.snapshotProject(link, project, { recordTransitions: true, tasks, today: snapshot?.today || "" });
  }

  /** Cheap view for pages: last snapshot plus a live availability probe result. */
  async opportunityDeliveryView(opportunityId) {
    const opportunity = await this.getOpportunity(opportunityId);
    const link = await this.linkedLinkFor("opportunity", opportunity.id, "project");
    const operations = await this.repository.listIntegrationOperations(this.teamId, {
      connectorId: WORKLOG_CONNECTOR.id, localEntityType: "opportunity", localEntityId: opportunity.id,
    });
    return { opportunity, link, operations, snapshot: link?.statusSnapshot || null, snapshotAt: link?.snapshotAt || null };
  }

  async companyWorklogView(companyId) {
    const company = await this.getCompany(companyId);
    const link = await this.linkedLinkFor("company", company.id, "client");
    const projectLinks = await this.repository.listExternalLinksBySystem(this.teamId, WORKLOG_EXTERNAL_SYSTEM, {
      externalObjectType: "project", syncState: "linked", localEntityType: "opportunity",
    });
    const opportunities = await this.repository.listOpportunities(this.teamId);
    const companyOpportunities = opportunities.filter((opportunity) => opportunity.companyId === company.id);
    const linkedOpportunityIds = new Set(projectLinks.map((row) => row.localEntityId));
    return {
      company, link,
      linkedOpportunities: companyOpportunities.filter((opportunity) => linkedOpportunityIds.has(opportunity.id)),
      unlinkedOpportunities: companyOpportunities.filter((opportunity) => !linkedOpportunityIds.has(opportunity.id)),
    };
  }

  /** Provenance-preserving pass-through of Worklog's client digest. */
  async companyDigest(companyId, { from = "", to = "", force = false } = {}) {
    const company = await this.getCompany(companyId);
    this.connector.assertTeam(this.teamId);
    const link = await this.linkedLinkFor("company", company.id, "client");
    if (!link) fail("This company has no linked Worklog client.", 404, "not_linked");
    const digest = await this.connector.digest({ clientId: link.externalId, from: from || undefined, to: to || undefined }, { force });
    return { company, link, digest, source: WORKLOG_EXTERNAL_SYSTEM, fetchedAt: this.at() };
  }

  // ------------------------------------------------------------ operations UI

  async connectionStatus() {
    const health = this.connector.configured() && this.connector.authorizedForTeam(this.teamId)
      ? await this.connector.health()
      : this.connector.configured()
        ? { state: "team_not_enabled", checkedAt: this.at() }
        : { state: "unconfigured", checkedAt: this.at() };
    return {
      connector: {
        id: WORKLOG_CONNECTOR.id, displayName: WORKLOG_CONNECTOR.displayName,
        baseUrl: this.connector.baseUrl || "", reads: WORKLOG_CONNECTOR.reads,
        actions: Object.keys(WORKLOG_CONNECTOR.actions), unsupported: WORKLOG_CONNECTOR.unsupported,
        policy: WORKLOG_CONNECTOR.policy,
      },
      health,
      lastSuccessAt: this.connector.lastSuccessAt,
      lastErrorAt: this.connector.lastErrorAt,
      lastErrorSummary: this.connector.lastErrorSummary,
    };
  }

  async operationsOverview() {
    const [status, operations, projectLinks, clientLinks, opportunities, exceptions] = await Promise.all([
      this.connectionStatus(),
      this.repository.listIntegrationOperations(this.teamId, { connectorId: WORKLOG_CONNECTOR.id }),
      this.repository.listExternalLinksBySystem(this.teamId, WORKLOG_EXTERNAL_SYSTEM, { externalObjectType: "project", syncState: "linked" }),
      this.repository.listExternalLinksBySystem(this.teamId, WORKLOG_EXTERNAL_SYSTEM, { externalObjectType: "client", syncState: "linked" }),
      this.repository.listOpportunities(this.teamId),
      this.repository.listOperationExceptions(this.teamId, "open"),
    ]);
    const linkedOpportunityIds = new Set(projectLinks.map((link) => link.localEntityId));
    const linkedCompanyIds = new Set(clientLinks.map((link) => link.localEntityId));
    const deliveryReady = opportunities.filter((opportunity) => DELIVERY_READY_STAGES.has(String(opportunity.stage || "").toLowerCase()) && opportunity.status !== "closed");
    const unlinkedDeliveryReady = deliveryReady.filter((opportunity) => !linkedOpportunityIds.has(opportunity.id));
    return {
      status,
      pendingOperations: operations.filter((operation) => ["draft", "approved", "executing", "outcome_unknown"].includes(operation.status)),
      recentOperations: operations.slice(0, 20),
      projectLinks, clientLinks,
      staleLinks: [...projectLinks, ...clientLinks].filter((link) => link.lastVerifiedState === "missing"),
      overdueProjects: projectLinks.filter((link) => Number(link.statusSnapshot?.overdueTasks || 0) > 0),
      unlinkedDeliveryReady,
      unlinkedDeliveryCompanies: [...new Set(unlinkedDeliveryReady.map((opportunity) => opportunity.companyId).filter(Boolean))].filter((companyId) => !linkedCompanyIds.has(companyId)),
      worklogExceptions: exceptions.filter((exception) => String(exception.exceptionType || "").startsWith("worklog_")),
    };
  }
}

export { INTEGRATION_OPERATION_STATES };
