// Turn a READ tool's live result into block descriptors the terminal renders.
//
// Pure and React-free: it returns plain objects, so it is unit-testable and
// provably incapable of emitting markup. TerminalBlocks does the rendering.
//
// This is the RICH in-session view. The persisted form is the server's plain
// text summary (lib/stage6/summarizeToolResult.js), which is what a reload or
// the bubble-chat view shows — so both exist on purpose.

const text = (value) => (value === undefined || value === null ? "" : String(value));
const clip = (value, max = 90) => { const s = text(value); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const kv = (pairs) => ({ type: "kv", rows: pairs.filter(([, v]) => text(v) !== "").map(([key, value]) => ({ key, value: text(value) })) });
const lines = (items) => ({ type: "lines", items: items.filter((item) => text(item.text).trim() !== "") });
const line = (value, tone = "") => ({ text: text(value), tone });

// A section may report itself unavailable; say so instead of showing a blank.
const unavailable = (value, label) => (value && typeof value === "object" && value.unavailable
  ? [line(`${label} unavailable — ${clip(value.unavailable, 80)}`, "warn")]
  : null);

const RENDERERS = {
  "home.get_snapshot": (d) => {
    const blocks = [];
    const metrics = [];
    if (Array.isArray(d.attention)) metrics.push({ label: "attention", value: d.attention.length });
    if (d.approvals && !d.approvals.unavailable) metrics.push({ label: "approvals", value: d.approvals.count ?? 0 });
    if (d.pipeline && !d.pipeline.unavailable) metrics.push({ label: "pipeline", value: d.pipeline.activeCount ?? 0 });
    if (d.outreach && !d.outreach.unavailable) metrics.push({ label: "drafts", value: d.outreach.draftMessages ?? 0 });
    if (metrics.length) blocks.push({ type: "metrics", items: metrics });

    const attentionUnavailable = unavailable(d.attention, "attention");
    if (attentionUnavailable) blocks.push(lines(attentionUnavailable));
    else if (Array.isArray(d.attention)) {
      blocks.push(lines(d.attention.length
        ? d.attention.map((item) => line(`[${text(item.severity) || "info"}] ${clip(item.title)}`, item.severity === "critical" ? "err" : item.severity === "warning" ? "warn" : ""))
        : [line("nothing needs attention right now.", "ok")]));
    }
    return blocks;
  },

  "core.search": (d) => {
    const results = Array.isArray(d.results) ? d.results : [];
    if (!results.length) return [lines([line("no matching DGTL record.", "warn")])];
    // Numbered to match the #n references the grammar resolves.
    return [lines(results.map((r, i) => line(`[${i + 1}] ${text(r.kind).padEnd(14)} ${clip(r.title, 56)}${r.status ? `  · ${r.status}` : ""}`)))];
  },

  "company.get": (d) => [
    kv([["company", d.company?.name], ["domain", d.company?.domain], ["relationship", d.company?.relationshipStatus], ["industry", d.company?.industry]]),
    ...(d.contacts?.length ? [lines([line("contacts", "dim"), ...d.contacts.map((c) => line(`  ${clip(c.name, 34)}${c.title ? ` · ${clip(c.title, 30)}` : ""}${c.email ? ` · ${c.email}` : ""}`))])] : []),
    ...(d.opportunities?.length ? [lines([line("opportunities", "dim"), ...d.opportunities.map((o) => line(`  ${clip(o.name, 44)} · ${text(o.stage)} · ${text(o.status)}`))])] : []),
  ],

  "opportunity.get": (d) => [
    kv([
      ["opportunity", d.opportunity?.name], ["company", d.company?.name],
      ["stage", d.opportunity?.stage], ["status", d.opportunity?.status],
      ["value", d.opportunity?.estimatedValue ? `${d.opportunity.estimatedValue} ${text(d.opportunity.currency)}`.trim() : ""],
      ["next action", d.opportunity?.nextAction], ["due", text(d.opportunity?.nextActionAt).slice(0, 10)],
    ]),
    ...(d.contacts?.length ? [lines([line("contacts", "dim"), ...d.contacts.map((c) => line(`  ${clip(c.name, 34)}${c.primary ? " (primary)" : ""}${c.email ? ` · ${c.email}` : ""}`))])] : []),
  ],

  "opportunity.get_activity": (d) => [activityLines(d)],
  "activity.list_recent": (d) => [activityLines(d)],

  "campaign.get": (d) => [
    kv([["campaign", d.campaign?.name], ["status", d.campaign?.status], ["approval", d.campaign?.approvalState], ["members", d.memberCount]]),
    ...(d.messages?.length ? [lines([line("messages", "dim"), ...d.messages.map((m) => line(`  ${text(m.status).padEnd(10)} ${clip(m.subject, 56)}`))])] : []),
  ],

  "campaign.get_status": (d) => [
    kv([["campaign", d.name], ["status", d.status], ["approval", d.approvalState], ["messages", d.messageCount]]),
    ...(Object.keys(d.byQueueState || {}).length ? [{ type: "metrics", items: Object.entries(d.byQueueState).map(([label, value]) => ({ label, value })) }] : []),
  ],

  "generation.get_job": (d) => [kv([
    ["job", d.job?.id], ["status", d.job?.status], ["slug", d.job?.slug],
    ["adapter", d.job?.adapterId], ["kind", d.job?.artifactKind], ["created", text(d.job?.createdAt).slice(0, 10)],
  ])],

  "artifact.get": (d) => [kv([
    ["artifact", d.artifact?.id], ["kind", d.artifact?.kind], ["slug", d.artifact?.slug],
    ["version", d.artifact?.version], ["status", d.artifact?.status], ["deployment", d.artifact?.deploymentUrl],
  ])],

  "worklog.get_delivery_summary": (d) => [
    kv([["state", d.state || d.status], ["project", d.project?.name], ["captured", text(d.snapshotAt || d.capturedAt).slice(0, 10)]]),
    lines(d.pendingOperations?.length
      ? [line("pending operations", "dim"), ...d.pendingOperations.map((o) => line(`  ${text(o.action)} · ${text(o.status)}`))]
      : [line("no pending delivery operations.", "ok")]),
  ],

  "operations.list_exceptions": (d) => {
    const items = Array.isArray(d.exceptions) ? d.exceptions : [];
    if (!items.length) return [lines([line("no open exceptions.", "ok")])];
    return [lines(items.map((e) => line(`[${text(e.severity)}] ${text(e.type)} · ${clip(e.summary, 80)}`, e.severity === "critical" ? "err" : "warn")))];
  },
};

function activityLines(d) {
  const items = Array.isArray(d.activity) ? d.activity : Array.isArray(d.items) ? d.items : [];
  if (!items.length) return lines([line("no recent activity.", "dim")]);
  return lines(items.map((a) => line(`${text(a.at || a.occurredAt).slice(0, 10)}  ${clip(a.summary || a.type, 80)}`)));
}

/**
 * @returns {Array<{type: "kv"|"metrics"|"lines"|"pre"}>} block descriptors.
 * An unrecognised tool degrades to a readable pre block rather than nothing.
 */
export function renderToolResult(toolId, data) {
  const payload = data && typeof data === "object" ? data : {};
  const renderer = RENDERERS[toolId];
  if (!renderer) return [{ type: "pre", text: JSON.stringify(payload, null, 2).slice(0, 4000) }];
  try {
    return renderer(payload).filter((block) => {
      if (block.type === "kv") return block.rows.length > 0;
      if (block.type === "lines") return block.items.length > 0;
      if (block.type === "metrics") return block.items.length > 0;
      return true;
    });
  } catch {
    return [{ type: "pre", text: JSON.stringify(payload, null, 2).slice(0, 4000) }];
  }
}

export const RENDERED_TOOL_IDS = Object.freeze(Object.keys(RENDERERS));
