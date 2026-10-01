import { MemoryStage4Repository } from "../stage4/memoryRepository.js";

const desc = (key) => (a, b) => String(b[key] || "").localeCompare(String(a[key] || ""));
const matches = (value, needle) => String(value || "").toLowerCase().includes(needle);

export class MemoryStage5Repository extends MemoryStage4Repository {
  async listTeamActivities(teamId, limit = 30) {
    return this.activities.filter((item) => item.teamId === teamId).sort(desc("occurredAt")).slice(0, Math.min(Math.max(Number(limit) || 30, 1), 100));
  }
  async countOpportunitiesByStage(teamId) {
    const groups = new Map();
    for (const opportunity of this.opportunities.filter((item) => item.teamId === teamId && item.status !== "closed")) {
      const stage = opportunity.stage || "new";
      const group = groups.get(stage) || { stage, count: 0, knownValue: 0, unknownValueCount: 0 };
      group.count += 1;
      if (opportunity.estimatedValue === null || opportunity.estimatedValue === undefined || opportunity.estimatedValue === "") group.unknownValueCount += 1;
      else group.knownValue += Number(opportunity.estimatedValue) || 0;
      groups.set(stage, group);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));
  }
  async countMessagesByQueueState(teamId) {
    const groups = new Map();
    for (const message of this.messages.filter((item) => item.teamId === teamId)) {
      const key = `${message.queueState || "not_queued"}|${message.status || ""}`;
      const group = groups.get(key) || { queueState: message.queueState || "not_queued", status: message.status || "", count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    return [...groups.values()];
  }
  async listMessagesByStatus(teamId, statuses, limit = 20) {
    const wanted = new Set([].concat(statuses));
    return this.messages.filter((item) => item.teamId === teamId && wanted.has(item.status)).sort(desc("createdAt")).slice(0, Math.min(Math.max(Number(limit) || 20, 1), 100));
  }
  async searchEntities(teamId, query, perKind = 5) {
    const needle = String(query || "").trim().toLowerCase();
    const cap = Math.min(Math.max(Number(perKind) || 5, 1), 10);
    const take = (rows) => rows.slice(0, cap);
    return {
      companies: take(this.companies.filter((row) => row.teamId === teamId && (matches(row.displayName, needle) || matches(row.legalName, needle) || matches(row.normalizedDomain, needle)))),
      contacts: take(this.contacts.filter((row) => row.teamId === teamId && (matches(row.fullName, needle) || matches(row.email, needle)))),
      opportunities: take(this.opportunities.filter((row) => row.teamId === teamId && matches(row.name, needle))),
      campaigns: take(this.campaigns.filter((row) => row.teamId === teamId && matches(row.name, needle))),
      artifacts: take(this.assets.filter((row) => row.teamId === teamId && matches(row.slug, needle))),
      generationJobs: take(this.generationJobs.filter((row) => row.teamId === teamId && (matches(row.slug, needle) || matches(row.id, needle)))),
      worklogProjects: take(this.externalLinks.filter((row) => row.teamId === teamId && row.externalSystem === "worklog" && row.externalObjectType === "project" && row.syncState === "linked" && matches(row.metadata?.name, needle))),
    };
  }
}
