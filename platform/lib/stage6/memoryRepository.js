import { MemoryStage5Repository } from "../stage5/memoryRepository.js";

const byCreated = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

export class MemoryStage6Repository extends MemoryStage5Repository {
  constructor(seed = {}) {
    super(seed);
    this.assistantThreads = structuredClone(seed.assistantThreads || []);
    this.assistantMessages = structuredClone(seed.assistantMessages || []);
    this.assistantToolRuns = structuredClone(seed.assistantToolRuns || []);
    this.actionProposals = structuredClone(seed.actionProposals || []);
  }
  async createAssistantThread(record) { this.assistantThreads.push({ status: "idle", ...record }); return record; }
  async getAssistantThread(id, teamId) { return this.assistantThreads.find((row) => row.id === id && row.teamId === teamId) || null; }
  async listAssistantThreads(teamId, userId, limit = 30) {
    return this.assistantThreads.filter((row) => row.teamId === teamId && row.userId === userId)
      .sort((a, b) => String(b.lastMessageAt || b.createdAt || "").localeCompare(String(a.lastMessageAt || a.createdAt || ""))).slice(0, limit);
  }
  async updateAssistantThread(id, teamId, values, expectedStatus) {
    const record = await this.getAssistantThread(id, teamId);
    if (!record || (expectedStatus && ![].concat(expectedStatus).includes(record.status))) return null;
    Object.assign(record, values); return record;
  }
  async createAssistantMessage(record) { this.assistantMessages.push(record); return record; }
  async listAssistantMessages(threadId, teamId, limit = 60) {
    return this.assistantMessages.filter((row) => row.threadId === threadId && row.teamId === teamId).sort(byCreated).slice(0, limit);
  }
  async createAssistantToolRun(record) { this.assistantToolRuns.push(record); return record; }
  async listAssistantToolRuns(threadId, teamId, limit = 100) {
    return this.assistantToolRuns.filter((row) => row.threadId === threadId && row.teamId === teamId).sort(byCreated).slice(0, limit);
  }
  async createActionProposal(record) { this.actionProposals.push({ status: "proposed", ...record }); return record; }
  async getActionProposal(id, teamId) { return this.actionProposals.find((row) => row.id === id && row.teamId === teamId) || null; }
  async listActionProposals(threadId, teamId) { return this.actionProposals.filter((row) => row.threadId === threadId && row.teamId === teamId).sort(byCreated); }
  async updateActionProposal(id, teamId, values, expectedStatus) {
    const record = await this.getActionProposal(id, teamId);
    if (!record || (expectedStatus && ![].concat(expectedStatus).includes(record.status))) return null;
    Object.assign(record, values); return record;
  }
}
