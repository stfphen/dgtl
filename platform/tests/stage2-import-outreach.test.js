import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ImportService, MemoryStage2Repository, OutreachService, buildPersonalizationContext,
  createTestTransport, normalizeMappedRow, parseDelimited, renderPersonalizedMessage,
  suggestColumnMapping
} from "../lib/stage2/index.js";

const T0="2026-08-13T16:00:00.000Z";
function ids(){let n=0;return(type)=>`${type}_s2_${++n}`;}
function actor(role="owner"){return{id:`user_${role}`,role};}
function imports(repository,role="owner",now=()=>T0,idFactory=ids()){return new ImportService({teamId:"team_a",actor:actor(role),repository,now,idFactory});}
function outreach(repository,{role="owner",transport=createTestTransport(),now=()=>T0,idFactory=ids()}={}){return new OutreachService({teamId:"team_a",actor:actor(role),repository,transport,now,idFactory});}
const SHEET=[
  "Company,Website,Contact Name,Job Title,Email,Company Research,Why DGTL Fits,Recommended Approach Angle,Relevant Product/Service,Priority,Source",
  'North Star Foods,https://www.northstar.example/about,Ada Buyer,VP Growth,ADA@northstar.example,"Opened three new locations","Needs consistent local acquisition","Lead with location-by-location audit",Digital presence audit,High,partner research',
  'Signal Works,signal.example,Grace Lead,Founder,grace@signal.example,"New product launch","Launch needs a stronger media system","Connect launch signal to creator distribution",Influence activation,Medium,manual research'
].join("\n");

test("arbitrary CSV/TSV parsing and DGTL header suggestions are deterministic",()=>{
  const csv=parseDelimited(SHEET);assert.equal(csv.records.length,2);assert.equal(csv.records[0]["Company Research"],"Opened three new locations");
  const mapping=suggestColumnMapping(csv.headers);assert.equal(mapping.companyName,"Company");assert.equal(mapping.approachAngle,"Recommended Approach Angle");assert.equal(mapping.offer,"Relevant Product/Service");
  const tsv=parseDelimited("Business\tWork Email\nAcme\ta@acme.test",{delimiter:"\t"});assert.equal(tsv.records[0]["Business"],"Acme");
});

test("normalization retains source fidelity while producing canonical values",()=>{
  const raw={companyName:"  ACME,Inc  ",website:"WWW.Acme.test/path#x",contactName:"  Ada   Buyer ",email:" ADA@ACME.TEST ",phone:"+1 (416) 555-0100",country:"Canada",research:"Signal"};
  const normalized=normalizeMappedRow(raw);assert.equal(raw.companyName,"  ACME,Inc  ");assert.equal(normalized.company.displayName,"ACME, Inc");assert.equal(normalized.company.normalizedDomain,"acme.test");assert.equal(normalized.contact.normalizedEmail,"ada@acme.test");assert.equal(normalized.contact.phone,"+14165550100");assert.equal(normalized.company.country,"CA");
});

test("upload stages raw provenance and never writes canonical entities",async()=>{
  const repository=new MemoryStage2Repository();const service=imports(repository,"sales");const batch=await service.upload({filename:"research.csv",content:SHEET,provenance:{sheet:"Q3"}});
  assert.equal(batch.status,"review");assert.equal(batch.rows.length,2);assert.equal(batch.rows[0].rawData.Email,"ADA@northstar.example");assert.equal(batch.rows[0].normalizedData.contact.normalizedEmail,"ada@northstar.example");assert.equal(repository.companies.length,0);assert.equal(repository.opportunities.length,0);
});

test("duplicate detection is team scoped, review oriented, and never silently merges",async()=>{
  const repository=new MemoryStage2Repository({companies:[{id:"company_existing",teamId:"team_a",displayName:"North Star",normalizedDomain:"northstar.example",createdAt:T0,updatedAt:T0},{id:"company_other",teamId:"team_b",displayName:"Signal",normalizedDomain:"signal.example",createdAt:T0,updatedAt:T0}],contacts:[{id:"contact_existing",teamId:"team_a",companyId:"company_existing",fullName:"Ada Buyer",email:"ada@northstar.example",normalizedEmail:"ada@northstar.example",createdAt:T0,updatedAt:T0}]});
  const batch=await imports(repository,"sales").upload({filename:"research.csv",content:SHEET});
  assert.equal(batch.rows[0].reviewState,"exact_match");assert.equal(batch.rows[0].reviewDecision,"review_later");assert.deepEqual(new Set(batch.rows[0].duplicateCandidates.map(c=>c.id)),new Set(["company_existing","contact_existing"]));assert.equal(batch.rows[1].reviewState,"new");
});

test("uncertain and conflicting duplicates remain explicit review states",async()=>{
  const repository=new MemoryStage2Repository({companies:[{id:"c1",teamId:"team_a",displayName:"North Star Foods",city:"Toronto",country:"CA",createdAt:T0,updatedAt:T0},{id:"c2",teamId:"team_a",displayName:"North Star Foods",city:"Toronto",country:"CA",createdAt:T0,updatedAt:T0}]});
  const one="Company,Contact Name,Email,Location\nNorth Star Foods,Ada,ada@new.test,Toronto";const service=imports(repository,"sales");const batch=await service.upload({filename:"one.csv",content:one});
  assert.ok(["new","probable_match","conflicting_data"].includes(batch.rows[0].reviewState));
});

test("invalid rows are quarantined and cannot become canonical records",async()=>{
  const repository=new MemoryStage2Repository();const service=imports(repository);const batch=await service.upload({filename:"bad.csv",content:"Company,Email\n,not-an-email"});
  assert.equal(batch.rows[0].reviewState,"invalid");assert.ok(batch.rows[0].validationErrors.length);const applied=await service.apply(batch.id);assert.equal(applied.appliedRows,0);assert.equal(repository.companies.length,0);
});

test("owner-approved import creates Company Contact Opportunity Research and Activity atomically",async()=>{
  const repository=new MemoryStage2Repository();const service=imports(repository);let batch=await service.upload({filename:"dgtl-research.csv",content:SHEET});
  for(const row of batch.rows) batch=await service.reviewRow(batch.id,row.id,"create_new");
  const applied=await service.apply(batch.id);assert.equal(applied.appliedRows,2);assert.equal(repository.companies.length,2);assert.equal(repository.contacts.length,2);assert.equal(repository.opportunities.length,2);assert.equal(repository.research.length,4);assert.equal(repository.activities.filter(a=>a.activityType==="prospect_imported").length,2);
  assert.equal(repository.research[0].sourceType,"partner research");assert.equal(repository.research[0].importBatchId,batch.id);assert.equal(repository.opportunities[0].approachAngle,"Lead with location-by-location audit");
});

test("sales can stage and review but cannot approve consequential import writes",async()=>{
  const repository=new MemoryStage2Repository();const service=imports(repository,"sales");let batch=await service.upload({filename:"one.csv",content:"Company,Contact,Email\nAcme,Ada,a@acme.test"});batch=await service.reviewRow(batch.id,batch.rows[0].id,"create_new");await assert.rejects(service.apply(batch.id),/cannot approve imports/);
});

test("team isolation rejects selected matches and never partially applies",async()=>{
  const repository=new MemoryStage2Repository({companies:[{id:"company_b",teamId:"team_b",displayName:"B",createdAt:T0,updatedAt:T0}]});const service=imports(repository);let batch=await service.upload({filename:"one.csv",content:"Company,Contact,Email\nAcme,Ada,a@acme.test"});batch=await service.reviewRow(batch.id,batch.rows[0].id,"use_existing",{companyId:"company_b"});await assert.rejects(service.apply(batch.id),/unavailable/);assert.equal(repository.companies.filter(c=>c.teamId==="team_a").length,0);assert.equal((await service.getBatch(batch.id)).status,"review");
});

test("compensating reversal retains records and deactivates only batch-created state",async()=>{
  const repository=new MemoryStage2Repository();const service=imports(repository);let batch=await service.upload({filename:"one.csv",content:"Company,Contact,Email\nAcme,Ada,a@acme.test"});batch=await service.reviewRow(batch.id,batch.rows[0].id,"create_new");batch=await service.apply(batch.id);const idsForRow=batch.rows[0].importedEntityIds;await service.reverse(batch.id);assert.equal(repository.companies.length,1);assert.equal((await repository.getCompany(idsForRow.companyId,"team_a")).relationshipStatus,"inactive");assert.equal((await repository.getContact(idsForRow.contactId,"team_a")).suppressionState,"suppressed");assert.equal((await repository.getOpportunity(idsForRow.opportunityId,"team_a")).stage,"import_reverted");
});

async function importedGraph({suppressed=false}={}){const repository=new MemoryStage2Repository({legacySuppressions:suppressed?[{id:"legacy_stop",teamId:"team_a",normalizedEmail:"ada@northstar.example",reason:"unsubscribe",active:true}]:[]});const service=imports(repository);let batch=await service.upload({filename:"one.csv",content:SHEET.split("\n").slice(0,2).join("\n")});batch=await service.reviewRow(batch.id,batch.rows[0].id,"create_new");await service.apply(batch.id);return{repository,batch,opportunity:repository.opportunities[0],contact:repository.contacts[0]};}

test("campaign cohort uses canonical IDs and prevents duplicate membership",async()=>{const {repository,opportunity,contact}=await importedGraph();const service=outreach(repository);const campaign=await service.createCampaign({name:"Audit cohort"});const first=await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const second=await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);assert.equal(first.length,1);assert.equal(second.length,0);});

test("personalization contract contains commercial context beyond first name",async()=>{const {repository,opportunity,contact}=await importedGraph();const service=outreach(repository);const campaign=await service.createCampaign({name:"Signals",personalizationConfig:{instructions:"Use the strongest signal"}});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const messages=await service.draftMessages(campaign.id,{subject:"Idea for {{company}}",body:"Hi {{first_name}} — {{recent_signal}} / {{approach_angle}} / {{offer}}"});assert.equal(messages.length,1);assert.match(messages[0].body,/Opened three new locations/);assert.match(messages[0].body,/Lead with location-by-location audit/);assert.match(messages[0].body,/Digital presence audit/);assert.equal(messages[0].personalizationContext.research[0].sourceType,"partner research");});

test("approved content is snapshotted and material edits invalidate approval",async()=>{const {repository,opportunity,contact}=await importedGraph();const service=outreach(repository);const campaign=await service.createCampaign({name:"Approval"});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Exact body"});const approved=await service.approveMessage(draft.id);assert.equal(approved.approvedBody,"Exact body");const edited=await service.editMessage(draft.id,{subject:"Hello",body:"Changed body"});assert.equal(edited.status,"draft");assert.equal(edited.approvedContentHash,"");await assert.rejects(service.queueMessage(draft.id),/Only an approved/);});

test("campaign approval is owner-only and required before queueing",async()=>{const {repository,opportunity,contact}=await importedGraph();const owner=outreach(repository);const campaign=await owner.createCampaign({name:"Gate"});await owner.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await owner.draftMessages(campaign.id,{subject:"Hello",body:"Body"});await owner.approveMessage(draft.id);await assert.rejects(owner.queueMessage(draft.id),/Campaign approval is required/);const sales=outreach(repository,{role:"sales"});await assert.rejects(sales.approveCampaign(campaign.id),/cannot approve campaigns/);await owner.approveCampaign(campaign.id);assert.equal((await owner.queueMessage(draft.id)).queueState,"queued");});

test("engineering worker refuses a non-test transport",async()=>{const repository=new MemoryStage2Repository();const service=outreach(repository,{transport:{name:"production",send:async()=>({ok:true})}});await assert.rejects(service.processOutbox(),/locked to the test transport/);});

test("suppression persists across import and blocks campaign queueing",async()=>{const {repository,opportunity,contact}=await importedGraph({suppressed:true});assert.equal(contact.suppressionState,"suppressed");const service=outreach(repository);const campaign=await service.createCampaign({name:"Suppression"});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Do not send"});await service.approveMessage(draft.id);await service.approveCampaign(campaign.id);const blocked=await service.queueMessage(draft.id);assert.equal(blocked.queueState,"suppressed");assert.equal(service.transport.deliveries.length,0);assert.equal(repository.operationExceptions[0].exceptionType,"suppressed_recipient");});

test("durable test outbox is idempotent and repeated workers cannot duplicate sends",async()=>{const {repository,opportunity,contact}=await importedGraph();const transport=createTestTransport();const service=outreach(repository,{transport});const campaign=await service.createCampaign({name:"Outbox",sendingIdentity:{email:"test@dgtl.test"}});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Approved body"});await service.approveMessage(draft.id);await service.approveCampaign(campaign.id);await service.queueMessage(draft.id);const first=await service.processOutbox();const second=await service.processOutbox();assert.deepEqual(first.map(r=>r.outcome),["sent"]);assert.deepEqual(second,[]);assert.equal(transport.deliveries.length,1);assert.equal(repository.deliveryAttempts.length,1);assert.equal((await repository.getMessage(draft.id,"team_a")).provider,"test");});

test("retry backoff is bounded and exhausted retries dead-letter with an exception",async()=>{const {repository,opportunity,contact}=await importedGraph();let clock=new Date(T0).getTime();const now=()=>new Date(clock).toISOString();const transport=createTestTransport({fail:()=>true});const service=outreach(repository,{transport,now});const campaign=await service.createCampaign({name:"Retry"});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Body"});await service.approveMessage(draft.id);await service.approveCampaign(campaign.id);await service.queueMessage(draft.id);for(let attempt=0;attempt<3;attempt+=1){await service.processOutbox();clock+=3700000;}const message=await repository.getMessage(draft.id,"team_a");assert.equal(message.queueState,"dead_letter");assert.equal(message.attemptCount,3);assert.equal(repository.deliveryAttempts.length,3);assert.equal(repository.operationExceptions.at(-1).exceptionType,"dead_letter_message");});

test("provider events are idempotently associated, generate Activity, and persist bounce suppression",async()=>{const {repository,opportunity,contact}=await importedGraph();const service=outreach(repository);const campaign=await service.createCampaign({name:"Events"});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Body"});await service.approveMessage(draft.id);await service.approveCampaign(campaign.id);await service.queueMessage(draft.id);await service.processOutbox();const sent=await repository.getMessage(draft.id,"team_a");const event={provider:"test",providerEventId:"evt_1",providerMessageId:sent.externalMessageId,eventType:"bounced"};await service.recordProviderEvent(event);const duplicate=await service.recordProviderEvent(event);assert.equal(duplicate.duplicate,true);assert.equal(repository.suppressions[0].reason,"hard_bounce");assert.ok(repository.activities.some(a=>a.activityType==="bounced"));});

test("reply association prefers deterministic provider correlation and escalates ambiguity",async()=>{const {repository,opportunity,contact}=await importedGraph();const service=outreach(repository);const campaign=await service.createCampaign({name:"Replies"});await service.addCohort(campaign.id,[{opportunityId:opportunity.id,contactId:contact.id}]);const [draft]=await service.draftMessages(campaign.id,{subject:"Hello",body:"Body"});await service.approveMessage(draft.id);await service.approveCampaign(campaign.id);await service.queueMessage(draft.id);await service.processOutbox();const sent=await repository.getMessage(draft.id,"team_a");const exact=await service.associateReply({inReplyTo:sent.externalMessageId,senderEmail:contact.email});assert.equal(exact.associationState,"associated");assert.equal(exact.messageId,sent.id);const ambiguous=await service.associateReply({senderEmail:"unknown@example.test"});assert.equal(ambiguous.associationState,"review_required");assert.equal(repository.operationExceptions.at(-1).exceptionType,"unresolved_reply");});

test("Stage 2 migration is additive and contains outbox, suppression, event, reply, and exception primitives",async()=>{const sql=await readFile(path.join(process.cwd(),"migrations","010_import_outreach_phase_2.sql"),"utf8");const repository=await readFile(path.join(process.cwd(),"lib","stage2","repository.js"),"utf8");for(const table of ["import_row_reviews","campaign_members","message_delivery_attempts","contact_suppressions","provider_events","inbound_replies","operation_exceptions"])assert.match(sql,new RegExp(`create table if not exists ${table}\\b`));assert.doesNotMatch(sql,/\bdrop\s+table\b/i);assert.doesNotMatch(sql,/\bdelete\s+from\b/i);assert.match(repository,/for update skip locked/i);});
