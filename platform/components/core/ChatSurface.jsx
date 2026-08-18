"use client";

import { useEffect, useRef } from "react";
import { CONFIRM_LABELS } from "./chatClient";
import { statusTone } from "../../lib/core/statusTone";

/**
 * DGTL.chat conversation view. All orchestration lives server-side in
 * AssistantService; this component only renders a thread's messages and lets a
 * human click the explicit confirmation controls on ActionProposal cards.
 * Nothing consequential happens from render, and no provider detail reaches here.
 *
 * State is owned by useChatSession, shared with the terminal view, so this is
 * now purely presentational — but ProposalCard stays in THIS file deliberately:
 * stage6-chat-command-layer.test.js reads this file to assert the proposal card
 * still tells the user that nothing has happened yet.
 */

function ProposalCard({ proposal, busy, onConfirm, onReject }) {
  const open = proposal.status === "proposed";
  return (
    <div className={`chat-proposal is-${proposal.status}`}>
      <div className="chat-proposal__head">
        <strong>{CONFIRM_LABELS[proposal.actionId] || proposal.actionId}</strong>
        <span className={`core-status is-${statusTone(proposal.status)}`}>{proposal.status.replaceAll("_", " ")}</span>
      </div>
      <p className="chat-proposal__impact">{proposal.impactSummary}</p>
      {open ? <p className="chat-proposal__notice">Nothing has happened yet — this is a proposal awaiting your explicit confirmation.</p> : null}
      {proposal.status === "stale" ? <p className="chat-proposal__notice">The underlying data changed since this was proposed; nothing was created. Ask the assistant to prepare it again.</p> : null}
      {proposal.status === "executed" && proposal.resultEntityId ? (
        <p className="chat-proposal__notice">Created: <a href={proposal.resultEntityType === "message" ? "/campaigns" : proposal.resultEntityType === "generation_job" ? `/generation-jobs/${proposal.resultEntityId}` : proposal.resultEntityType === "integration_operation" ? "/operations/worklog" : `/opportunities/${encodeURIComponent(proposal.resultEntityId)}`}>{proposal.resultEntityType.replaceAll("_", " ")} {proposal.resultEntityId}</a></p>
      ) : null}
      {proposal.error ? <p className="chat-proposal__notice">{proposal.error}</p> : null}
      {open ? (
        <div className="chat-proposal__actions">
          <button className="core-button is-primary" disabled={busy} onClick={() => onConfirm(proposal.id)}>{CONFIRM_LABELS[proposal.actionId] || "Confirm"}</button>
          <button className="core-button is-danger" disabled={busy} onClick={() => onReject(proposal.id)}>Reject</button>
        </div>
      ) : null}
    </div>
  );
}

function Refs({ refs }) {
  if (!Array.isArray(refs) || !refs.length) return null;
  return (
    <div className="chat-message__refs">
      {refs.slice(0, 8).map((ref) => <a key={`${ref.kind}:${ref.id}`} className="chat-ref" href={ref.href}>{ref.label}</a>)}
    </div>
  );
}

function Tools({ runs }) {
  if (!Array.isArray(runs) || !runs.length) return null;
  return <p className="chat-message__tools">Tools: {runs.map((run) => `${run.toolId}${run.status === "completed" ? "" : ` (${run.status})`}`).join(" · ")}</p>;
}

function Message({ message }) {
  // A system_notice tagged noticeKind "command" is the output of a deterministic
  // terminal read command — the server produced it, not the model. It keeps its
  // real refs and tool line so both surfaces show the same thing, and it is
  // rendered preformatted because the summary is column-aligned text.
  if (message.role === "system_notice") {
    const fromCommand = message.providerMetadata?.noticeKind === "command";
    return (
      <div className={`chat-message is-notice${fromCommand ? " is-command" : ""}`}>
        {fromCommand ? <span className="chat-message__author">Command · {message.providerMetadata.toolId}</span> : null}
        {fromCommand ? <pre className="chat-message__pre">{message.content}</pre> : <p>{message.content}</p>}
        <Tools runs={message.toolSummary} />
        <Refs refs={message.sourceRefs} />
      </div>
    );
  }
  return (
    <div className={`chat-message is-${message.role}`}>
      <span className="chat-message__author">{message.role === "user" ? "You" : "DGTL"}</span>
      <div className="chat-message__body">{String(message.content).split("\n").map((line, index) => <p key={index}>{line}</p>)}</div>
      <Tools runs={message.toolSummary} />
      <Refs refs={message.sourceRefs} />
    </div>
  );
}

export default function ChatSurface({ session, health, draft, onDraftChange }) {
  const { messages, proposals, busy, error, confirm, reject, send, setError } = session;
  const bottomRef = useRef(null);
  const unavailable = !health || ["unconfigured", "disabled", "unavailable"].includes(health.state);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, proposals]);

  const proposalsByTurn = new Map();
  for (const proposal of proposals) {
    const list = proposalsByTurn.get(proposal.turnId) || [];
    list.push(proposal);
    proposalsByTurn.set(proposal.turnId, list);
  }
  const renderedProposals = new Set();

  return (
    <section className="chat-main">
      {unavailable ? (
        <div className="chat-unavailable">
          <p><strong>Conversational replies are {health?.state || "unconfigured"}.</strong></p>
          <p>{health?.detail || "No chat model provider is configured."} Terminal mode still runs every read command — switch with the toggle above. Everything else — HOME, search, opportunities, campaigns, delivery — keeps working.</p>
        </div>
      ) : null}
      <div className="chat-log" aria-live="polite">
        {!messages.length && !unavailable ? (
          <div className="chat-empty">
            <p>Ask about the agency, or ask me to prepare a follow-up, pitch request, or delivery handoff. Consequential actions always come back to you as proposals to confirm.</p>
          </div>
        ) : null}
        {messages.map((message) => {
          const attached = (proposalsByTurn.get(message.turnId) || []).filter((proposal) => !renderedProposals.has(proposal.id));
          return (
            <div key={message.id}>
              <Message message={message} />
              {message.role === "assistant" ? attached.map((proposal) => { renderedProposals.add(proposal.id); return <ProposalCard key={proposal.id} proposal={proposal} busy={busy} onConfirm={confirm} onReject={reject} />; }) : null}
            </div>
          );
        })}
        {busy ? <p className="chat-hint">Working…</p> : null}
        {error ? <p className="core-notice">{error} <button className="core-button" onClick={() => setError("")}>Dismiss</button></p> : null}
        <div ref={bottomRef} />
      </div>
      {/* The draft lives in ChatWorkspace so it survives a mode switch, so this
          form must clear it itself — useChatSession owns the thread, not the
          composer, and cannot reach back into it. */}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text || busy || unavailable) return;
          onDraftChange("");
          send(text);
        }}
      >
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={unavailable ? "Conversational replies are unavailable — try Terminal" : "Ask DGTL… (answers are grounded in canonical data)"}
          disabled={busy || unavailable}
          maxLength={4000}
          aria-label="Message DGTL"
        />
        <button className="core-button is-primary" type="submit" disabled={busy || unavailable || !draft.trim()}>Send</button>
      </form>
    </section>
  );
}
