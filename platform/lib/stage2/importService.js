import { createCoreId, stableFingerprint } from "../core/ids.js";
import { CoreService } from "../core/service.js";
import { applyColumnMapping, parseDelimited, suggestColumnMapping } from "./mapping.js";
import { duplicateReviewState } from "./matching.js";
import { normalizeMappedRow } from "./normalization.js";

const WRITE_ROLES = new Set(["owner", "admin", "sales"]);
const APPROVE_ROLES = new Set(["owner", "admin"]);
const DECISIONS = new Set(["use_existing", "create_new", "merge_approved_fields", "skip", "review_later"]);

function requireRole(role, allowed, operation) {
  if (!allowed.has(role)) throw Object.assign(new Error(`Role ${role || "unknown"} cannot ${operation}.`), { status: 403 });
}
function required(value, label) { const result = String(value || "").trim(); if (!result) throw new Error(`${label} is required.`); return result; }

export class ImportService {
  constructor({ teamId, actor = {}, repository, idFactory = createCoreId, now = () => new Date().toISOString() } = {}) {
    this.teamId = required(teamId, "teamId");
    this.actor = actor;
    this.repository = repository;
    this.idFactory = idFactory;
    this.now = now;
  }

  listBatches() { return this.repository.listImportBatches(this.teamId); }
  async getBatch(id) {
    const batch = await this.repository.getImportBatch(required(id, "importBatchId"), this.teamId);
    if (!batch) return null;
    return { ...batch, rows: await this.repository.listImportRows(batch.id, this.teamId) };
  }

  async upload({ filename, content, sourceType = "csv", tenantId = "", provenance = {} } = {}) {
    requireRole(this.actor.role, WRITE_ROLES, "stage imports");
    const safeFilename = required(filename, "filename");
    if (!new Set(["csv", "tsv"]).has(sourceType)) throw new Error("Stage 2 accepts CSV or TSV spreadsheets.");
    const parsed = parseDelimited(content, { delimiter: sourceType === "tsv" ? "\t" : undefined });
    if (!parsed.headers.length || !parsed.records.length) throw new Error("Spreadsheet must contain a header and at least one data row.");
    if (parsed.records.length > 10000) throw new Error("Import is limited to 10,000 rows per batch.");
    const at = this.now();
    const id = this.idFactory("importBatch");
    const mapping = suggestColumnMapping(parsed.headers);
    const batch = {
      id, teamId: this.teamId, tenantId, sourceFilename: safeFilename, sourceType,
      sourceChecksum: stableFingerprint(content, 64), status: "staging", columnMapping: mapping,
      totalRows: parsed.records.length, validRows: 0, warningRows: 0, conflictingRows: 0, appliedRows: 0,
      provenance: { ...provenance, headers: parsed.headers }, createdBy: this.actor.id || "", uploadedAt: at, createdAt: at, updatedAt: at
    };
    const rows = parsed.records.map((rawData, index) => ({
      id: this.idFactory("importRow"), teamId: this.teamId, importBatchId: id, rowNumber: index + 2,
      rawData, normalizedData: {}, duplicateCandidates: [], validationErrors: [], reviewState: "new",
      reviewDecision: "review_later", decisionMetadata: {}, beforeState: {}, appliedChanges: {}, importedEntityIds: {},
      status: "staged", createdAt: at, updatedAt: at
    }));
    await this.repository.createImportBatch(batch, rows);
    return this.map(id, mapping);
  }

  async map(batchId, mapping) {
    requireRole(this.actor.role, WRITE_ROLES, "map imports");
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error("Import batch is not available to this team.");
    if (["applied", "reverted"].includes(batch.status)) throw new Error("Applied imports cannot be remapped.");
    const [companies, contacts] = await Promise.all([this.repository.listCompanies(this.teamId), this.repository.listContacts(this.teamId)]);
    const counts = { valid: 0, warning: 0, conflicting: 0 };
    for (const row of batch.rows) {
      const normalizedData = normalizeMappedRow(applyColumnMapping(row.rawData, mapping));
      const result = duplicateReviewState(normalizedData, { companies, contacts }, this.teamId);
      if (result.reviewState === "invalid") counts.warning += 1;
      else if (["probable_match", "conflicting_data"].includes(result.reviewState)) counts.conflicting += 1;
      else counts.valid += 1;
      await this.repository.updateImportRow(row.id, this.teamId, {
        normalizedData, duplicateCandidates: result.candidates, validationErrors: result.validationErrors,
        reviewState: result.reviewState, reviewDecision: "review_later", decisionMetadata: {}, status: "mapped", updatedAt: this.now()
      });
    }
    await this.repository.updateImportBatch(batch.id, this.teamId, {
      columnMapping: mapping, validRows: counts.valid, warningRows: counts.warning,
      conflictingRows: counts.conflicting, status: "review", updatedAt: this.now()
    });
    return this.getBatch(batch.id);
  }

  async reviewRow(batchId, rowId, decision, metadata = {}) {
    requireRole(this.actor.role, WRITE_ROLES, "review import rows");
    if (!DECISIONS.has(decision)) throw new Error("Unsupported import decision.");
    const batch = await this.getBatch(batchId);
    const row = batch?.rows.find((item) => item.id === rowId);
    if (!row) throw new Error("Import row is not available to this team.");
    if (decision === "use_existing" || decision === "merge_approved_fields") {
      if (!metadata.companyId && !metadata.contactId) throw new Error("An existing company or contact selection is required.");
    }
    const at = this.now();
    await this.repository.createImportReview({
      id: this.idFactory("activity"), teamId: this.teamId, importBatchId: batch.id, importRowId: row.id,
      decision, actorUserId: this.actor.id || "", beforeState: { decision: row.reviewDecision, metadata: row.decisionMetadata },
      decisionMetadata: metadata, createdAt: at
    });
    await this.repository.updateImportRow(row.id, this.teamId, { reviewDecision: decision, decisionMetadata: metadata, reviewedBy: this.actor.id || "", reviewedAt: at, updatedAt: at });
    return this.getBatch(batch.id);
  }

  async apply(batchId) {
    requireRole(this.actor.role, APPROVE_ROLES, "approve imports");
    const batch = await this.getBatch(batchId);
    if (!batch) throw new Error("Import batch is not available to this team.");
    if (batch.status === "applied") return batch;
    const pending = batch.rows.filter((row) => row.reviewState !== "invalid" && row.reviewDecision === "review_later");
    if (pending.length) throw new Error(`${pending.length} import rows still require review.`);
    const at = this.now();
    return this.repository.transaction(async (repository) => {
      const core = new CoreService({ teamId: this.teamId, repository, idFactory: this.idFactory, now: this.now });
      const suppressions = await repository.listSuppressions(this.teamId);
      let appliedRows = 0;
      for (const row of batch.rows) {
        if (row.reviewState === "invalid" || row.reviewDecision === "skip") {
          await repository.updateImportRow(row.id, this.teamId, { status: row.reviewState === "invalid" ? "invalid" : "ignored", updatedAt: at });
          continue;
        }
        const n = row.normalizedData;
        const selected = row.decisionMetadata || {};
        let company = selected.companyId ? await core.getCompany(selected.companyId) : null;
        let contact = selected.contactId ? await core.getContact(selected.contactId) : null;
        if ((selected.companyId && !company) || (selected.contactId && !contact)) throw new Error(`Selected match for row ${row.rowNumber} is unavailable.`);
        const beforeState = { company: company ? structuredClone(company) : null, contact: contact ? structuredClone(contact) : null };
        if (!company) company = await core.createCompany({ ...n.company, tenantId: batch.tenantId, importBatchId: batch.id, ownerUserId: this.actor.id, metadata: { sourceRow: row.rowNumber } });
        else if (row.reviewDecision === "merge_approved_fields") {
          company = await repository.updateCompany(company.id, this.teamId, approvedMerge(company, n.company, selected.companyFields, at));
        }
        const importedEmailSuppression = suppressions.find((item) => item.normalizedEmail && item.normalizedEmail === n.contact.normalizedEmail);
        if (!contact) contact = await core.createContact({ ...n.contact, companyId: company.id, tenantId: batch.tenantId, importBatchId: batch.id, ownerUserId: this.actor.id, source: n.company.source, suppressionState: importedEmailSuppression ? "suppressed" : "active", metadata: { sourceRow: row.rowNumber, suppressionReason: importedEmailSuppression?.reason || "" } });
        else if (contact.companyId && contact.companyId !== company.id) throw new Error(`Contact selected for row ${row.rowNumber} belongs to another company.`);
        else if (row.reviewDecision === "merge_approved_fields") {
          contact = await repository.updateContact(contact.id, this.teamId, approvedMerge(contact, n.contact, selected.contactFields, at));
        }
        const opportunity = await core.createOpportunity({
          companyId: company.id, primaryContactId: contact.id, contactIds: [contact.id], tenantId: batch.tenantId,
          name: `${company.displayName} — ${n.opportunity.offer || "DGTL approach"}`, approachAngle: n.opportunity.approachAngle,
          offer: n.opportunity.offer, qualification: { priority: n.opportunity.priority, score: n.opportunity.score },
          source: n.company.source, importBatchId: batch.id, ownerUserId: this.actor.id, metadata: { sourceRow: row.rowNumber }
        });
        const researchIds = [];
        for (const research of n.research) {
          const record = await core.createResearch({ ...research, companyId: company.id, opportunityId: opportunity.id, tenantId: batch.tenantId, importBatchId: batch.id, authorType: "user", authorId: this.actor.id });
          researchIds.push(record.id);
        }
        await core.createActivity({ companyId: company.id, contactId: contact.id, opportunityId: opportunity.id, activityType: "prospect_imported", actorType: "user", actorId: this.actor.id, summary: `Imported from ${batch.sourceFilename}`, metadata: { importBatchId: batch.id, importRowId: row.id, matchDecision: row.reviewDecision } });
        const ids = { companyId: company.id, contactId: contact.id, opportunityId: opportunity.id, researchIds };
        await repository.updateImportRow(row.id, this.teamId, { beforeState, appliedChanges: { createdOrLinked: ids }, importedEntityIds: ids, status: "applied", updatedAt: at });
        appliedRows += 1;
      }
      const updatedBatch = await repository.updateImportBatch(batch.id, this.teamId, { status: "applied", appliedRows, approvedBy: this.actor.id || "", approvedAt: at, updatedAt: at });
      return { ...updatedBatch, rows: await repository.listImportRows(batch.id, this.teamId) };
    });
  }

  async reverse(batchId) {
    requireRole(this.actor.role, APPROVE_ROLES, "reverse imports");
    const batch = await this.getBatch(batchId);
    if (!batch || batch.status !== "applied") throw new Error("Only an applied import can be reversed.");
    const at = this.now();
    return this.repository.transaction(async (repository) => {
      for (const row of batch.rows.filter((item) => item.status === "applied")) {
        const ids = row.importedEntityIds || {};
        const opportunity = ids.opportunityId ? await repository.getOpportunity(ids.opportunityId, this.teamId) : null;
        if (opportunity?.importBatchId === batch.id) await repository.updateOpportunity(opportunity.id, this.teamId, { status: "closed", stage: "import_reverted", metadata: { ...(opportunity.metadata || {}), importRevertedAt: at }, updatedAt: at });
        const company = ids.companyId ? await repository.getCompany(ids.companyId, this.teamId) : null;
        if (company?.importBatchId === batch.id) await repository.updateCompany(company.id, this.teamId, { relationshipStatus: "inactive", metadata: { ...(company.metadata || {}), importRevertedAt: at }, updatedAt: at });
        const contact = ids.contactId ? await repository.getContact(ids.contactId, this.teamId) : null;
        if (contact?.importBatchId === batch.id) await repository.updateContact(contact.id, this.teamId, { suppressionState: "suppressed", metadata: { ...(contact.metadata || {}), importRevertedAt: at }, updatedAt: at });
        await repository.updateImportRow(row.id, this.teamId, { status: "compensated", appliedChanges: { ...(row.appliedChanges || {}), compensation: "records_retained_and_deactivated" }, updatedAt: at });
      }
      const updatedBatch = await repository.updateImportBatch(batch.id, this.teamId, { status: "reverted", revertedBy: this.actor.id || "", revertedAt: at, updatedAt: at });
      return { ...updatedBatch, rows: await repository.listImportRows(batch.id, this.teamId) };
    });
  }
}

function approvedMerge(current, incoming, fields = [], updatedAt) {
  const patch = { updatedAt };
  for (const field of fields || []) if (Object.hasOwn(incoming, field) && incoming[field] !== "" && incoming[field] !== null) patch[field] = incoming[field];
  return patch;
}
