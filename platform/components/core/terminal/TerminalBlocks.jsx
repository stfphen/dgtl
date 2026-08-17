"use client";

import { CONFIRM_LABELS } from "../chatClient";

// The terminal's render kit, ported from apps/dgtl-os/terminal.html's
// .line/.panel/.kv/.metric/.chip CSS.
//
// Deliberately zero dangerouslySetInnerHTML. The prior art built panels as HTML
// strings with onclick="window.__cmd('…')" attributes, escaped through a helper
// that handled only & < > and not quotes — so any value reaching an attribute
// slot could break out. Here every chip is a real button and every reference is
// a real link, which removes the whole class of problem rather than patching it.

export function Line({ tone = "", children }) {
  return <div className={`term-line${tone ? ` is-${tone}` : ""}`}>{children}</div>;
}

export function Prompt({ label, command }) {
  return (
    <div className="term-line term-echo">
      <span className="term-ps">{label}</span>
      <span className="term-cmd">{command}</span>
    </div>
  );
}

export function Panel({ eyebrow, title, pill, tone = "", children }) {
  return (
    <div className={`term-panel${tone ? ` is-${tone}` : ""}`}>
      {(eyebrow || title || pill) ? (
        <div className="term-panel__head">
          <span className="term-panel__eyebrow">{eyebrow}</span>
          {title ? <span className="term-panel__title">{title}</span> : null}
          {pill ? <span className="term-panel__pill">{pill}</span> : null}
        </div>
      ) : null}
      <div className="term-panel__body">{children}</div>
    </div>
  );
}

export function KeyValueRows({ rows = [] }) {
  if (!rows.length) return null;
  return (
    <dl className="term-kv">
      {rows.map(({ key, value }) => (
        <div className="term-kv__row" key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricRow({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="term-metrics">
      {items.map(({ label, value }) => (
        <div className="term-metric" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Pre({ children }) {
  return <pre className="term-pre">{children}</pre>;
}

// A chip that would spend money never fires on click — it only fills the input.
// On mobile, chips are the primary way to drive the terminal, so a mis-tap must
// not be able to buy an LLM turn.
export function SuggestRow({ chips = [], onRun, onFill, label = "Try" }) {
  if (!chips.length) return null;
  return (
    <div className="term-suggest" role="group" aria-label="Suggested commands">
      <span className="term-suggest__label">{label}</span>
      {chips.map((chip) => {
        const command = typeof chip === "string" ? chip : chip.command;
        const billable = typeof chip === "object" && chip.billable;
        return (
          <button
            key={command}
            type="button"
            className={`term-chip${billable ? " is-billable" : ""}`}
            onClick={() => (billable ? onFill(command) : onRun(command))}
            title={billable ? "Fills the prompt — press enter to run a billable model turn" : undefined}
          >
            {billable ? "✦ " : ""}{command}
          </button>
        );
      })}
    </div>
  );
}

export function SourceRefChips({ refs = [] }) {
  if (!refs.length) return null;
  return (
    <div className="term-refs">
      {refs.slice(0, 8).map((ref) => (
        <a key={`${ref.kind}:${ref.id}`} className="term-ref" href={ref.href}>{ref.label}</a>
      ))}
    </div>
  );
}

// Only ever rendered from the real toolSummary the server returned. The prior
// art printed four invented tool-call lines to make a scripted flow look busy;
// nothing here may claim a tool ran that did not.
export function ToolSummaryLine({ runs = [] }) {
  if (!runs.length) return null;
  return (
    <div className="term-line is-dim">
      {runs.map((run) => `↳ tool ${run.toolId} ${run.status === "completed" ? "ok" : run.status}${run.error ? ` — ${run.error}` : ""}`).join("  ")}
    </div>
  );
}

export function ThinkingLine({ label = "waiting for DGTL", seconds = 0, onCancel }) {
  return (
    <div className="term-line term-thinking">
      <span className="term-dots" aria-hidden><i /><i /><i /></span>
      <span>{label} · {seconds}s</span>
      <button type="button" className="term-chip" onClick={onCancel}>cancel (⌃C)</button>
    </div>
  );
}

// The proposal, in the terminal. The confirm and reject controls are the SAME
// real buttons on the same requireCoreWrite route as the chat view — there is
// deliberately no `confirm 1` command, so "confirmation is a UI button" stays
// literally true rather than nearly true.
export function TerminalProposal({ proposal, busy, onConfirm, onReject }) {
  const open = proposal.status === "proposed";
  return (
    <Panel eyebrow="PROPOSAL" title={CONFIRM_LABELS[proposal.actionId] || proposal.actionId} pill={proposal.status.replaceAll("_", " ")} tone={open ? "accent" : ""}>
      <div className="term-line">{proposal.impactSummary}</div>
      {open ? <div className="term-line is-dim">Nothing has happened yet — this is a proposal awaiting your explicit confirmation.</div> : null}
      {proposal.status === "stale" ? <div className="term-line is-warn">The underlying data changed since this was proposed; nothing was created.</div> : null}
      {proposal.error ? <div className="term-line is-err">{proposal.error}</div> : null}
      {open ? (
        <div className="term-actions">
          <button className="core-button is-primary" disabled={busy} onClick={() => onConfirm(proposal.id)}>{CONFIRM_LABELS[proposal.actionId] || "Confirm"}</button>
          <button className="core-button" disabled={busy} onClick={() => onReject(proposal.id)}>Reject</button>
        </div>
      ) : null}
    </Panel>
  );
}
