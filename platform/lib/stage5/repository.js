import { Pool } from "pg";
import { PostgresStage4Repository } from "../stage4/repository.js";

function camelKey(key){return key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());}
function mapRow(row){return row?Object.fromEntries(Object.entries(row).map(([key,value])=>[camelKey(key),value?.toISOString?.()||value])):null;}

/**
 * Stage 5 read-only aggregation queries for the HOME dashboard. Additive
 * SELECTs over existing tables — no schema change, no new ownership. Every
 * query is team-scoped and bounded.
 */
export class PostgresStage5Repository extends PostgresStage4Repository {
  async listTeamActivities(teamId, limit = 30) {
    return (await this.db.query(
      "select * from activities where team_id=$1 order by occurred_at desc limit $2",
      [teamId, Math.min(Math.max(Number(limit) || 30, 1), 100)],
    )).rows.map(mapRow);
  }
  async countOpportunitiesByStage(teamId) {
    return (await this.db.query(
      `select stage, count(*)::int as count,
              coalesce(sum(estimated_value) filter (where estimated_value is not null), 0)::numeric as known_value,
              count(*) filter (where estimated_value is null)::int as unknown_value_count
       from opportunities where team_id=$1 and status <> 'closed'
       group by stage order by count desc, stage`,
      [teamId],
    )).rows.map(mapRow);
  }
  async countMessagesByQueueState(teamId) {
    return (await this.db.query(
      "select queue_state, status, count(*)::int as count from messages where team_id=$1 group by queue_state, status",
      [teamId],
    )).rows.map(mapRow);
  }
  async listMessagesByStatus(teamId, statuses, limit = 20) {
    return (await this.db.query(
      "select * from messages where team_id=$1 and status = any($2::text[]) order by created_at desc limit $3",
      [teamId, [].concat(statuses), Math.min(Math.max(Number(limit) || 20, 1), 100)],
    )).rows.map(mapRow);
  }
  /**
   * Bounded, team-scoped lookup for the command palette. ILIKE on name-ish
   * columns only; per-kind caps keep the response small and existence of
   * other teams' objects can never leak because every branch filters team_id.
   */
  async searchEntities(teamId, query, perKind = 5) {
    const term = `%${String(query || "").trim().replace(/[%_\\]/g, "\\$&")}%`;
    const cap = Math.min(Math.max(Number(perKind) || 5, 1), 10);
    const [companies, contacts, opportunities, campaigns, artifacts, jobs, projectLinks] = await Promise.all([
      this.db.query("select id, display_name, normalized_domain, relationship_status from companies where team_id=$1 and (display_name ilike $2 or legal_name ilike $2 or normalized_domain ilike $2) order by updated_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, full_name, email, title from contacts where team_id=$1 and (full_name ilike $2 or email ilike $2) order by updated_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, name, stage, status from opportunities where team_id=$1 and name ilike $2 order by updated_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, name, status, approval_state from campaigns where team_id=$1 and name ilike $2 order by updated_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, slug, kind, status, version_number from artifacts where team_id=$1 and slug ilike $2 order by created_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, slug, requested_skill, status from generation_jobs where team_id=$1 and (slug ilike $2 or id ilike $2) order by created_at desc limit $3", [teamId, term, cap]),
      this.db.query("select id, local_entity_id, external_id, metadata from external_links where team_id=$1 and external_system='worklog' and external_object_type='project' and sync_state='linked' and metadata->>'name' ilike $2 order by updated_at desc limit $3", [teamId, term, cap]),
    ]);
    return {
      companies: companies.rows.map(mapRow),
      contacts: contacts.rows.map(mapRow),
      opportunities: opportunities.rows.map(mapRow),
      campaigns: campaigns.rows.map(mapRow),
      artifacts: artifacts.rows.map(mapRow),
      generationJobs: jobs.rows.map(mapRow),
      worklogProjects: projectLinks.rows.map(mapRow),
    };
  }
}

let pool;
export function getStage5Repository(){if(!process.env.DATABASE_URL)return null;if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL});return new PostgresStage5Repository(pool);}
export function __resetStage5RepositoryForTests(){pool=null;}
