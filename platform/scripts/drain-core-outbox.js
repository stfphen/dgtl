import { OutreachService } from "../lib/stage2/outreachService.js";
import { getStage2Repository } from "../lib/stage2/repository.js";
import { createConfiguredTransport, productionTransportStatus } from "../lib/stage2/transport.js";

const teamId = String(process.env.CORE_WORKER_TEAM_ID || "").trim();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the Core outbox worker.");
if (!teamId) throw new Error("CORE_WORKER_TEAM_ID is required; worker scope is never accepted from a request.");

const transport = createConfiguredTransport();
const service = new OutreachService({ teamId, actor: { id: "core-worker", role: "system" }, repository: getStage2Repository(), transport });
const workerId = String(process.env.CORE_WORKER_ID || `core-worker-${process.pid}`);
const results = await service.processOutbox({ limit: Number(process.env.CORE_WORKER_BATCH_LIMIT || 50), workerId });
const status = productionTransportStatus();
console.log(JSON.stringify({ teamId, workerId, provider: transport.name, productionEnabled: status.production && status.authorized, processed: results.length, outcomes: results }, null, 2));
