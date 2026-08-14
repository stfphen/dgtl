import { Pool } from "pg";
import { PostgresCoreRepository } from "../core/repository.js";
import { listOutreachSuppressions } from "../store.js";

function camelKey(key) { return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()); }
function mapRow(row) { return row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value?.toISOString?.() || value])) : null; }
function json(value) { return JSON.stringify(value ?? {}); }

const PATCH_COLUMNS = {
  import_batches: { sourceType: "source_type", status: "status", columnMapping: "column_mapping", validRows: "valid_rows", warningRows: "warning_rows", conflictingRows: "conflicting_rows", appliedRows: "applied_rows", approvedBy: "approved_by", approvedAt: "approved_at", revertedBy: "reverted_by", revertedAt: "reverted_at", metadata: "metadata", updatedAt: "updated_at" },
  import_rows: { normalizedData: "normalized_data", duplicateCandidates: "duplicate_candidates", validationErrors: "validation_errors", reviewState: "review_state", reviewDecision: "review_decision", decisionMetadata: "decision_metadata", reviewedBy: "reviewed_by", reviewedAt: "reviewed_at", beforeState: "before_state", appliedChanges: "applied_changes", importedEntityIds: "imported_entity_ids", status: "status", updatedAt: "updated_at" },
  companies: { displayName: "display_name", normalizedDomain: "normalized_domain", websiteUrl: "website_url", industry: "industry", category: "category", city: "city", region: "region", country: "country", relationshipStatus: "relationship_status", metadata: "metadata", updatedAt: "updated_at" },
  contacts: { companyId: "company_id", firstName: "first_name", lastName: "last_name", fullName: "full_name", title: "title", role: "role", email: "email", normalizedEmail: "normalized_email", phone: "phone", linkedinUrl: "linkedin_url", deliverabilityState: "deliverability_state", consentState: "consent_state", suppressionState: "suppression_state", metadata: "metadata", updatedAt: "updated_at" },
  opportunities: { stage: "stage", status: "status", approachAngle: "approach_angle", offer: "offer", qualification: "qualification", metadata: "metadata", updatedAt: "updated_at" },
  campaigns: { status: "status", approvalState: "approval_state", approvedBy: "approved_by", approvedAt: "approved_at", audienceDefinition: "audience_definition", sequence: "sequence", sendingIdentity: "sending_identity", personalizationConfig: "personalization_config", metrics: "metrics", metadata: "metadata", updatedAt: "updated_at" },
  messages: { subject: "subject", body: "body", renderedSubject: "rendered_subject", renderedBody: "rendered_body", contentHash: "content_hash", approvedSubject: "approved_subject", approvedBody: "approved_body", approvedContentHash: "approved_content_hash", approvedBy: "approved_by", approvedAt: "approved_at", status: "status", recipientEmail: "recipient_email", senderEmail: "sender_email", personalizationContext: "personalization_context", provider: "provider", externalMessageId: "external_message_id", scheduledAt: "scheduled_at", sentAt: "sent_at", idempotencyKey: "idempotency_key", queueState: "queue_state", attemptCount: "attempt_count", maxAttempts: "max_attempts", nextAttemptAt: "next_attempt_at", lastAttemptAt: "last_attempt_at", lockedAt: "locked_at", lockedBy: "locked_by", permanentFailureAt: "permanent_failure_at", deadLetteredAt: "dead_lettered_at", failureReason: "failure_reason", providerMetadata: "provider_metadata", metadata: "metadata", updatedAt: "updated_at" },
  operation_exceptions: { status: "status", assignedTo: "assigned_to", resolvedBy: "resolved_by", resolvedAt: "resolved_at", resolution: "resolution", updatedAt: "updated_at" }
};
const JSON_FIELDS = new Set(["columnMapping", "metadata", "normalizedData", "duplicateCandidates", "validationErrors", "decisionMetadata", "beforeState", "appliedChanges", "importedEntityIds", "qualification", "audienceDefinition", "sequence", "sendingIdentity", "personalizationConfig", "metrics", "personalizationContext", "providerMetadata", "resolution"]);

export class PostgresStage2Repository extends PostgresCoreRepository {
  async transaction(work) {
    if (!this.db.connect) return work(this);
    const client = await this.db.connect();
    try { await client.query("begin"); const result = await work(new PostgresStage2Repository(client)); await client.query("commit"); return result; }
    catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
  }
  async patch(table, id, teamId, patch) {
    const allowed = PATCH_COLUMNS[table]; const entries = Object.entries(patch).filter(([key]) => allowed[key]);
    if (!entries.length) return null;
    const values = entries.map(([key, value]) => JSON_FIELDS.has(key) ? json(value) : (value === "" ? null : value));
    const assignments = entries.map(([key], index) => `${allowed[key]} = $${index + 1}${JSON_FIELDS.has(key) ? "::jsonb" : ""}`).join(", ");
    const result = await this.db.query(`update ${table} set ${assignments} where id = $${entries.length + 1} and team_id = $${entries.length + 2} returning *`, [...values, id, teamId]);
    return mapRow(result.rows[0]);
  }
  async createImportBatch(batch, rows) {
    await this.db.query(`insert into import_batches (id,team_id,tenant_id,source_filename,source_type,source_checksum,status,column_mapping,total_rows,valid_rows,warning_rows,conflicting_rows,applied_rows,metadata,created_by,uploaded_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18)`, [batch.id,batch.teamId,batch.tenantId||null,batch.sourceFilename,batch.sourceType,batch.sourceChecksum,batch.status,json(batch.columnMapping),batch.totalRows,batch.validRows,batch.warningRows,batch.conflictingRows,batch.appliedRows,json(batch.provenance),batch.createdBy||null,batch.uploadedAt,batch.createdAt,batch.updatedAt]);
    for (const row of rows) await this.db.query(`insert into import_rows (id,team_id,import_batch_id,row_number,raw_data,normalized_data,duplicate_candidates,validation_errors,before_state,applied_changes,status,imported_entity_ids,review_state,review_decision,decision_metadata,created_at,updated_at) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14,$15::jsonb,$16,$17)`, [row.id,row.teamId,row.importBatchId,row.rowNumber,json(row.rawData),json(row.normalizedData),json(row.duplicateCandidates),json(row.validationErrors),json(row.beforeState),json(row.appliedChanges),row.status,json(row.importedEntityIds),row.reviewState,row.reviewDecision,json(row.decisionMetadata),row.createdAt,row.updatedAt]);
    return batch;
  }
  async listImportBatches(teamId) { return (await this.db.query("select * from import_batches where team_id=$1 order by created_at desc",[teamId])).rows.map(mapRow); }
  async getImportBatch(id,teamId) { return mapRow((await this.db.query("select * from import_batches where id=$1 and team_id=$2",[id,teamId])).rows[0]); }
  async listImportRows(batchId,teamId) { return (await this.db.query("select * from import_rows where import_batch_id=$1 and team_id=$2 order by row_number",[batchId,teamId])).rows.map(mapRow); }
  updateImportBatch(id,teamId,patch) { return this.patch("import_batches",id,teamId,patch); }
  updateImportRow(id,teamId,patch) { return this.patch("import_rows",id,teamId,patch); }
  async createImportReview(r) { return mapRow((await this.db.query(`insert into import_row_reviews (id,team_id,import_batch_id,import_row_id,decision,actor_user_id,before_state,decision_metadata,created_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) returning *`,[r.id,r.teamId,r.importBatchId,r.importRowId,r.decision,r.actorUserId,json(r.beforeState),json(r.decisionMetadata),r.createdAt])).rows[0]); }
  updateCompany(id,teamId,patch) { return this.patch("companies",id,teamId,patch); }
  updateContact(id,teamId,patch) { return this.patch("contacts",id,teamId,patch); }
  updateOpportunity(id,teamId,patch) { return this.patch("opportunities",id,teamId,patch); }

  async createCampaign(r) { return mapRow((await this.db.query(`insert into campaigns (id,team_id,tenant_id,name,kind,status,owner_user_id,source,audience_definition,sequence,sending_identity,approval_state,personalization_config,metrics,metadata,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17) returning *`,[r.id,r.teamId,r.tenantId||null,r.name,r.kind,r.status,r.ownerUserId||null,r.source,json(r.audienceDefinition),json(r.sequence),json(r.sendingIdentity),r.approvalState,json(r.personalizationConfig),json(r.metrics),json(r.metadata),r.createdAt,r.updatedAt])).rows[0]); }
  async listCampaigns(teamId) { return (await this.db.query("select * from campaigns where team_id=$1 order by updated_at desc",[teamId])).rows.map(mapRow); }
  async getCampaign(id,teamId) { return mapRow((await this.db.query("select * from campaigns where id=$1 and team_id=$2",[id,teamId])).rows[0]); }
  updateCampaign(id,teamId,patch) { return this.patch("campaigns",id,teamId,patch); }
  async addCampaignMember(r) { return mapRow((await this.db.query(`insert into campaign_members (id,team_id,tenant_id,campaign_id,opportunity_id,contact_id,import_batch_id,status,personalization_context,created_by,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) on conflict (campaign_id,opportunity_id,contact_id) do nothing returning *`,[r.id,r.teamId,r.tenantId||null,r.campaignId,r.opportunityId,r.contactId,r.importBatchId||null,r.status,json(r.personalizationContext),r.createdBy||null,r.createdAt,r.updatedAt])).rows[0]); }
  async listCampaignMembers(campaignId,teamId) { return (await this.db.query("select * from campaign_members where campaign_id=$1 and team_id=$2 order by created_at",[campaignId,teamId])).rows.map(mapRow); }
  async createMessage(r) { return mapRow((await this.db.query(`insert into messages (id,team_id,tenant_id,opportunity_id,campaign_id,contact_id,channel,direction,subject,body,status,provider,recipient_email,sender_email,personalization_context,rendered_subject,rendered_body,content_hash,queue_state,attempt_count,max_attempts,metadata,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24) returning *`,[r.id,r.teamId,r.tenantId||null,r.opportunityId,r.campaignId,r.contactId,r.channel,r.direction,r.subject,r.body,r.status,r.provider,r.recipientEmail||null,r.senderEmail||null,json(r.personalizationContext),r.renderedSubject,r.renderedBody,r.contentHash,r.queueState,r.attemptCount,r.maxAttempts,json(r.metadata),r.createdAt,r.updatedAt])).rows[0]); }
  async getMessage(id,teamId) { return mapRow((await this.db.query("select * from messages where id=$1 and team_id=$2",[id,teamId])).rows[0]); }
  async listMessages(teamId,{campaignId}={}) { const result=campaignId?await this.db.query("select * from messages where team_id=$1 and campaign_id=$2 order by created_at desc",[teamId,campaignId]):await this.db.query("select * from messages where team_id=$1 order by created_at desc",[teamId]); return result.rows.map(mapRow); }
  async updateMessage(id,teamId,patch,expected={}) {
    const allowed=PATCH_COLUMNS.messages; const entries=Object.entries(patch).filter(([key])=>allowed[key]); const conditions=Object.entries(expected).filter(([key])=>allowed[key]);
    const values=entries.map(([key,value])=>JSON_FIELDS.has(key)?json(value):(value===""?null:value));
    const sets=entries.map(([key],i)=>`${allowed[key]}=$${i+1}${JSON_FIELDS.has(key)?"::jsonb":""}`).join(",");
    const base=values.length; values.push(id,teamId);
    const where=conditions.map(([key,value],i)=>{values.push(value);return `${allowed[key]}=$${base+3+i}`;}).join(" and ");
    const result=await this.db.query(`update messages set ${sets} where id=$${base+1} and team_id=$${base+2}${where?` and ${where}`:""} returning *`,values); return mapRow(result.rows[0]);
  }
  async claimDueMessages(teamId,now,limit,workerId) { const result=await this.db.query(`with due as (select id from messages where team_id=$1 and queue_state in ('queued','retry') and coalesce(scheduled_at,$2)<= $2 and coalesce(next_attempt_at,$2)<= $2 and locked_at is null order by coalesce(next_attempt_at,scheduled_at,created_at) for update skip locked limit $3) update messages m set queue_state='sending',locked_at=$2,locked_by=$4,updated_at=$2 from due where m.id=due.id returning m.*`,[teamId,now,limit,workerId]); return result.rows.map(mapRow); }
  async createDeliveryAttempt(r) { return mapRow((await this.db.query(`insert into message_delivery_attempts (id,team_id,message_id,attempt_number,transport,status,provider_message_id,error_code,error_message,started_at,completed_at,metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) returning *`,[r.id,r.teamId,r.messageId,r.attemptNumber,r.transport,r.status,r.providerMessageId||null,r.errorCode||null,r.errorMessage||null,r.startedAt,r.completedAt,json(r.metadata)])).rows[0]); }
  async createSuppression(r) { return mapRow((await this.db.query(`insert into contact_suppressions (id,team_id,tenant_id,contact_id,normalized_email,normalized_domain,reason,source,provider,external_event_id,metadata,active,created_by,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15) on conflict do nothing returning *`,[r.id,r.teamId,r.tenantId||null,r.contactId||null,r.normalizedEmail||null,r.normalizedDomain||null,r.reason,r.source,r.provider||null,r.externalEventId||null,json(r.metadata),r.active,r.createdBy||null,r.createdAt,r.updatedAt])).rows[0]); }
  async listSuppressions(teamId) { const canonical=(await this.db.query("select * from contact_suppressions where team_id=$1 and active=true",[teamId])).rows.map(mapRow); const legacy=(await listOutreachSuppressions({teamId})).map(item=>({id:item.id,teamId,tenantId:item.tenantId,normalizedEmail:item.email,normalizedDomain:item.domain,reason:item.reason,source:"legacy",active:true,createdAt:item.createdAt})); return [...canonical,...legacy]; }
  async createProviderEvent(r) { const result=await this.db.query(`insert into provider_events (id,team_id,message_id,provider,provider_event_id,provider_message_id,event_type,occurred_at,payload_reference,metadata,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) on conflict (team_id,provider,provider_event_id) do nothing returning *`,[r.id,r.teamId,r.messageId,r.provider,r.providerEventId,r.providerMessageId||null,r.eventType,r.occurredAt,r.payloadReference||null,json(r.metadata),r.createdAt]); if(result.rows[0]) return mapRow(result.rows[0]); return {...r,duplicate:true}; }
  async createInboundReply(r) { return mapRow((await this.db.query(`insert into inbound_replies (id,team_id,message_id,contact_id,company_id,opportunity_id,campaign_id,provider,provider_message_id,in_reply_to,normalized_sender,association_state,candidate_message_ids,received_at,metadata,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16,$17) returning *`,[r.id,r.teamId,r.messageId||null,r.contactId||null,r.companyId||null,r.opportunityId||null,r.campaignId||null,r.provider||null,r.providerMessageId||null,r.inReplyTo||null,r.normalizedSender||null,r.associationState,json(r.candidateMessageIds),r.receivedAt,json(r.metadata),r.createdAt,r.updatedAt])).rows[0]); }
  async createOperationException(r) { return mapRow((await this.db.query(`insert into operation_exceptions (id,team_id,exception_type,severity,source_entity_type,source_entity_id,status,summary,details,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) returning *`,[r.id,r.teamId,r.exceptionType,r.severity,r.sourceEntityType,r.sourceEntityId,r.status,r.summary,json(r.details),r.createdAt,r.updatedAt])).rows[0]); }
  async listOperationExceptions(teamId,status="open") { const result=status?await this.db.query("select * from operation_exceptions where team_id=$1 and status=$2 order by created_at desc",[teamId,status]):await this.db.query("select * from operation_exceptions where team_id=$1 order by created_at desc",[teamId]); return result.rows.map(mapRow); }
  updateOperationException(id,teamId,patch) { return this.patch("operation_exceptions",id,teamId,patch); }
}

let pool;
export function getStage2Repository() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool=new Pool({connectionString:process.env.DATABASE_URL});
  return new PostgresStage2Repository(pool);
}
export function __resetStage2RepositoryForTests(){pool=null;}
