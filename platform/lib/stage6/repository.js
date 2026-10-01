import { Pool } from "pg";
import { PostgresStage5Repository } from "../stage5/repository.js";

function camelKey(key){return key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());}
function mapRow(row){return row?Object.fromEntries(Object.entries(row).map(([key,value])=>[camelKey(key),value?.toISOString?.()||value])):null;}
const json=(value,fallback="{}")=>JSON.stringify(value??JSON.parse(fallback));

/**
 * Stage 6 persistence: private assistant threads, final messages, safe
 * tool-run audit records, and ActionProposals. Every transition that guards
 * concurrency or confirmation is a compare-and-swap in SQL, the same
 * mechanic Stages 3-4 use.
 */
export class PostgresStage6Repository extends PostgresStage5Repository {
  async createAssistantThread(r){return mapRow((await this.db.query(`insert into assistant_threads(id,team_id,user_id,title,status,policy_version,last_message_at,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[r.id,r.teamId,r.userId,r.title||"",r.status||"idle",r.policyVersion||"",r.lastMessageAt||null,r.createdAt,r.updatedAt])).rows[0]);}
  async getAssistantThread(id,teamId){return mapRow((await this.db.query("select * from assistant_threads where id=$1 and team_id=$2",[id,teamId])).rows[0]);}
  async listAssistantThreads(teamId,userId,limit=30){return(await this.db.query("select * from assistant_threads where team_id=$1 and user_id=$2 order by last_message_at desc nulls last, created_at desc limit $3",[teamId,userId,Math.min(Math.max(Number(limit)||30,1),100)])).rows.map(mapRow);}
  async updateAssistantThread(id,teamId,values,expectedStatus){const columns={title:"title",status:"status",activeTurnId:"active_turn_id",policyVersion:"policy_version",lastMessageAt:"last_message_at",updatedAt:"updated_at"};const entries=Object.entries(values).filter(([key])=>columns[key]);if(!entries.length)return null;const args=entries.map(([,value])=>value===""?null:value);const set=entries.map(([key],i)=>`${columns[key]}=$${i+1}`).join(",");args.push(id,teamId);let where="";if(expectedStatus){args.push([].concat(expectedStatus));where=` and status=any($${args.length}::text[])`;}return mapRow((await this.db.query(`update assistant_threads set ${set} where id=$${entries.length+1} and team_id=$${entries.length+2}${where} returning *`,args)).rows[0]);}
  async createAssistantMessage(r){return mapRow((await this.db.query(`insert into assistant_messages(id,team_id,thread_id,turn_id,role,content,source_refs,tool_summary,provider_metadata,policy_version,status,created_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12) returning *`,[r.id,r.teamId,r.threadId,r.turnId||"",r.role,r.content||"",json(r.sourceRefs,"[]"),json(r.toolSummary,"[]"),json(r.providerMetadata),r.policyVersion||"",r.status||"completed",r.createdAt])).rows[0]);}
  async listAssistantMessages(threadId,teamId,limit=60){return(await this.db.query("select * from assistant_messages where thread_id=$1 and team_id=$2 order by created_at asc limit $3",[threadId,teamId,Math.min(Math.max(Number(limit)||60,1),200)])).rows.map(mapRow);}
  async createAssistantToolRun(r){return mapRow((await this.db.query(`insert into assistant_tool_runs(id,team_id,thread_id,turn_id,tool_id,classification,arguments,target_refs,status,error,started_at,completed_at,created_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13) returning *`,[r.id,r.teamId,r.threadId,r.turnId,r.toolId,r.classification,json(r.arguments),json(r.targetRefs,"[]"),r.status||"completed",r.error||"",r.startedAt||null,r.completedAt||null,r.createdAt])).rows[0]);}
  async listAssistantToolRuns(threadId,teamId,limit=100){return(await this.db.query("select * from assistant_tool_runs where thread_id=$1 and team_id=$2 order by created_at asc limit $3",[threadId,teamId,Math.min(Math.max(Number(limit)||100,1),300)])).rows.map(mapRow);}
  async createActionProposal(r){return mapRow((await this.db.query(`insert into assistant_action_proposals(id,team_id,thread_id,turn_id,action_id,target_entity_type,target_entity_id,payload,payload_hash,impact_summary,preconditions,proposed_by,status,expires_at,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13,$14,$15,$16) returning *`,[r.id,r.teamId,r.threadId,r.turnId||"",r.actionId,r.targetEntityType,r.targetEntityId,json(r.payload),r.payloadHash,r.impactSummary||"",json(r.preconditions),r.proposedBy,r.status||"proposed",r.expiresAt||null,r.createdAt,r.updatedAt])).rows[0]);}
  async getActionProposal(id,teamId){return mapRow((await this.db.query("select * from assistant_action_proposals where id=$1 and team_id=$2",[id,teamId])).rows[0]);}
  async listActionProposals(threadId,teamId){return(await this.db.query("select * from assistant_action_proposals where thread_id=$1 and team_id=$2 order by created_at asc",[threadId,teamId])).rows.map(mapRow);}
  async updateActionProposal(id,teamId,values,expectedStatus){const columns={status:"status",confirmedBy:"confirmed_by",confirmedAt:"confirmed_at",executedAt:"executed_at",resultEntityType:"result_entity_type",resultEntityId:"result_entity_id",error:"error",updatedAt:"updated_at"};const entries=Object.entries(values).filter(([key])=>columns[key]);if(!entries.length)return null;const args=entries.map(([,value])=>value===""?null:value);const set=entries.map(([key],i)=>`${columns[key]}=$${i+1}`).join(",");args.push(id,teamId);let where="";if(expectedStatus){args.push([].concat(expectedStatus));where=` and status=any($${args.length}::text[])`;}return mapRow((await this.db.query(`update assistant_action_proposals set ${set} where id=$${entries.length+1} and team_id=$${entries.length+2}${where} returning *`,args)).rows[0]);}
}

let pool;
export function getStage6Repository(){if(!process.env.DATABASE_URL)return null;if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL});return new PostgresStage6Repository(pool);}
export function __resetStage6RepositoryForTests(){pool=null;}
