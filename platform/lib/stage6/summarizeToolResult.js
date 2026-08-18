// Deterministic, server-side rendering of a READ tool's result into plain text.
//
// Why text, and why here: assistantService.getThread returns messages and
// proposals only — tool-run result DATA is audited but is not part of the thread
// view. So a read command persists its output as the content of a system_notice
// message, which means switching between the terminal and the bubble chat never
// loses what a command printed, with no schema change.
//
// No model is involved. No HTML is produced — every value is plain text, and the
// client renders it into monospace lines. `data` is also returned live to the
// caller for the richer in-session panel; only this summary is stored.

const text = (value) => (value === undefined || value === null ? "" : String(value));
const clip = (value, max = 160) => { const s = text(value); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const rows = (pairs) => pairs.filter(([, v]) => text(v) !== "").map(([k, v]) => `${k}: ${v}`);

// A tool section may be { unavailable: "..." } when its upstream is down; say so
// rather than printing a confident blank.
const section = (value, render, label) => {
  if (!value || typeof value !== "object") return [];
  if (value.unavailable) return [`${label}: unavailable — ${clip(value.unavailable, 100)}`];
  return render(value);
};

const RENDERERS = {
  "home.get_snapshot": (d) => {
    const lines = [];
    const attention = Array.isArray(d.attention) ? d.attention : [];
    if (d.attention?.unavailable) lines.push(`attention: unavailable — ${clip(d.attention.unavailable, 100)}`);
    else if (!attention.length) lines.push("nothing needs attention right now.");
    else {
      lines.push(`${attention.length} item${attention.length === 1 ? "" : "s"} need attention:`);
      for (const item of attention) lines.push(`  [${text(item.severity) || "info"}] ${clip(item.title)}`);
    }
    lines.push(...section(d.approvals, (a) => [`approvals waiting: ${a.count ?? 0}`], "approvals"));
    lines.push(...section(d.pipeline, (p) => rows([
      ["pipeline active", p.activeCount],
      ["known value", p.knownValueTotal],
      ["awaiting handoff", p.awaitingHandoff],
    ]), "pipeline"));
    lines.push(...section(d.outreach, (o) => rows([
      ["draft messages", o.draftMessages],
      ["queued", o.queued],
      ["dead letter", o.deadLetter],
    ]), "outreach"));
    return lines;
  },

  "core.search": (d) => {
    const results = Array.isArray(d.results) ? d.results : [];
    if (!results.length) return ["no matching DGTL record."];
    // Numbered so the terminal's #n references line up with what was printed.
    return [`${results.length} result${results.length === 1 ? "" : "s"}:`,
      ...results.map((r, i) => `  [${i + 1}] ${text(r.kind).padEnd(14)} ${clip(r.title, 60)}${r.status ? `  · ${r.status}` : ""}`)];
  },

  "company.get": (d) => [
    ...rows([["company", d.company?.name], ["domain", d.company?.domain], ["relationship", d.company?.relationshipStatus], ["industry", d.company?.industry]]),
    ...(d.contacts?.length ? [`contacts (${d.contacts.length}):`, ...d.contacts.map((c) => `  ${clip(c.name, 40)}${c.title ? ` · ${clip(c.title, 40)}` : ""}${c.email ? ` · ${c.email}` : ""}`)] : []),
    ...(d.opportunities?.length ? [`opportunities (${d.opportunities.length}):`, ...d.opportunities.map((o) => `  ${clip(o.name, 50)} · ${text(o.stage)} · ${text(o.status)}`)] : []),
  ],

  "opportunity.get": (d) => [
    ...rows([
      ["opportunity", d.opportunity?.name], ["company", d.company?.name],
      ["stage", d.opportunity?.stage], ["status", d.opportunity?.status],
      ["value", d.opportunity?.estimatedValue ? `${d.opportunity.estimatedValue} ${text(d.opportunity.currency)}`.trim() : ""],
      ["next action", d.opportunity?.nextAction], ["due", d.opportunity?.nextActionAt],
    ]),
    ...(d.contacts?.length ? [`contacts (${d.contacts.length}):`, ...d.contacts.map((c) => `  ${clip(c.name, 40)}${c.primary ? " (primary)" : ""}${c.email ? ` · ${c.email}` : ""}`)] : []),
    ...(d.artifacts?.length ? [`artifacts: ${d.artifacts.length}`] : []),
  ],

  "opportunity.get_activity": (d) => {
    const items = Array.isArray(d.activity) ? d.activity : Array.isArray(d.items) ? d.items : [];
    if (!items.length) return ["no recent activity."];
    return items.map((a) => `  ${text(a.at || a.occurredAt).slice(0, 10)}  ${clip(a.summary || a.type, 90)}`);
  },

  "campaign.get": (d) => [
    ...rows([["campaign", d.campaign?.name], ["status", d.campaign?.status], ["approval", d.campaign?.approvalState], ["members", d.memberCount]]),
    ...(d.messages?.length ? [`messages (${d.messages.length}):`, ...d.messages.map((m) => `  ${text(m.status).padEnd(10)} ${clip(m.subject, 60)}`)] : []),
  ],

  "campaign.get_status": (d) => [
    ...rows([["campaign", d.name], ["status", d.status], ["approval", d.approvalState], ["messages", d.messageCount]]),
    ...Object.entries(d.byQueueState || {}).map(([state, count]) => `  ${state}: ${count}`),
  ],

  "generation.get_job": (d) => rows([
    ["job", d.job?.id], ["status", d.job?.status], ["slug", d.job?.slug],
    ["adapter", d.job?.adapterId], ["kind", d.job?.artifactKind], ["created", d.job?.createdAt],
  ]),

  "artifact.get": (d) => rows([
    ["artifact", d.artifact?.id], ["kind", d.artifact?.kind], ["slug", d.artifact?.slug],
    ["version", d.artifact?.version], ["status", d.artifact?.status], ["deployment", d.artifact?.deploymentUrl],
  ]),

  "worklog.get_delivery_summary": (d) => [
    ...rows([["state", d.state || d.status], ["project", d.project?.name], ["captured", d.snapshotAt || d.capturedAt]]),
    ...(d.pendingOperations?.length
      ? [`pending operations (${d.pendingOperations.length}):`, ...d.pendingOperations.map((o) => `  ${text(o.action)} · ${text(o.status)}`)]
      : ["no pending delivery operations."]),
  ],

  "operations.list_exceptions": (d) => {
    const items = Array.isArray(d.exceptions) ? d.exceptions : [];
    if (!items.length) return ["no open exceptions."];
    return [`${items.length} open exception${items.length === 1 ? "" : "s"}:`,
      ...items.map((e) => `  [${text(e.severity)}] ${text(e.type)} · ${clip(e.summary, 90)}`)];
  },

  "activity.list_recent": (d) => {
    const items = Array.isArray(d.activity) ? d.activity : Array.isArray(d.items) ? d.items : [];
    if (!items.length) return ["no recent activity."];
    return items.map((a) => `  ${text(a.at || a.occurredAt).slice(0, 10)}  ${clip(a.summary, 90)}`);
  },
};

/**
 * Render a read tool's result as plain text. Falls back to a generic key dump
 * for a tool with no bespoke renderer, so a newly added tool degrades to
 * something readable rather than to nothing.
 */
export function summarizeToolResult(toolId, data) {
  const payload = data && typeof data === "object" ? data : {};
  const renderer = RENDERERS[toolId];
  let lines;
  try {
    lines = renderer ? renderer(payload) : rows(Object.entries(payload).filter(([, v]) => typeof v !== "object"));
  } catch {
    lines = [];
  }
  const body = (lines || []).filter((line) => text(line).trim() !== "");
  return body.length ? body.join("\n") : "(no data)";
}

export const SUMMARIZED_TOOL_IDS = Object.freeze(Object.keys(RENDERERS));
