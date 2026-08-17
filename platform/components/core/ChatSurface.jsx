"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { statusTone } from "../../lib/core/statusTone";

/**
 * DGTL.chat surface. All orchestration lives server-side in AssistantService;
 * this component only renders threads, sends turns, and lets a human click
 * the explicit confirmation controls on ActionProposal cards. Nothing
 * consequential happens from render, and no provider detail reaches here.
 */

const CONFIRM_LABELS = {
  "message.prepare_followup": "Create draft",
  "generation.prepare_asset": "Create generation request",
  "worklog.prepare_handoff": "Prepare Worklog handoff",
  "opportunity.prepare_next_action": "Apply next action",
};

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "content-type": "application/json", accept: "application/json" }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status}).`), { status: response.status, code: body.code });
  return body;
}

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

function Message({ message }) {
  if (message.role === "system_notice") return <div className="chat-message is-notice"><p>{message.content}</p></div>;
  return (
    <div className={`chat-message is-${message.role}`}>
      <span className="chat-message__author">{message.role === "user" ? "You" : "DGTL"}</span>
      <div className="chat-message__body">{String(message.content).split("\n").map((line, index) => <p key={index}>{line}</p>)}</div>
      {Array.isArray(message.toolSummary) && message.toolSummary.length ? (
        <p className="chat-message__tools">Tools: {message.toolSummary.map((run) => `${run.toolId}${run.status === "completed" ? "" : ` (${run.status})`}`).join(" · ")}</p>
      ) : null}
      {Array.isArray(message.sourceRefs) && message.sourceRefs.length ? (
        <div className="chat-message__refs">
          {message.sourceRefs.slice(0, 8).map((ref) => <a key={`${ref.kind}:${ref.id}`} className="chat-ref" href={ref.href}>{ref.label}</a>)}
        </div>
      ) : null}
    </div>
  );
}

export default function ChatSurface({ health, initialThreads = [], initialQuery = "" }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const bootRef = useRef(false);
  const unavailable = !health || ["unconfigured", "disabled", "unavailable"].includes(health.state);

  const loadThread = useCallback(async (threadId) => {
    if (!threadId) { setMessages([]); setProposals([]); return; }
    try {
      const body = await api(`/api/core/chat/threads/${threadId}`);
      setMessages(body.messages || []);
      setProposals(body.proposals || []);
    } catch (requestError) { setError(requestError.message); }
  }, []);

  useEffect(() => { loadThread(activeId); }, [activeId, loadThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, proposals]);

  const send = useCallback(async (text, threadId = activeId) => {
    const message = String(text || "").trim();
    if (!message || busy) return;
    setBusy(true); setError("");
    try {
      let targetThread = threadId;
      if (!targetThread) {
        const created = await api("/api/core/chat/threads", { method: "POST", body: JSON.stringify({ title: message.slice(0, 80) }) });
        targetThread = created.thread.id;
        setThreads((existing) => [created.thread, ...existing]);
        setActiveId(targetThread);
      }
      setMessages((existing) => [...existing, { id: `local-${Date.now()}`, role: "user", content: message }]);
      setDraft("");
      await api(`/api/core/chat/threads/${targetThread}/turns`, { method: "POST", body: JSON.stringify({ message }) });
      await loadThread(targetThread);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  }, [activeId, busy, loadThread]);

  useEffect(() => {
    if (initialQuery && !bootRef.current && !unavailable) { bootRef.current = true; send(initialQuery, ""); }
  }, [initialQuery, send, unavailable]);

  const confirm = useCallback(async (proposalId) => {
    setBusy(true); setError("");
    try { await api(`/api/core/chat/proposals/${proposalId}/confirm`, { method: "POST" }); await loadThread(activeId); }
    catch (requestError) { setError(requestError.message); await loadThread(activeId); }
    finally { setBusy(false); }
  }, [activeId, loadThread]);

  const reject = useCallback(async (proposalId) => {
    setBusy(true); setError("");
    try { await api(`/api/core/chat/proposals/${proposalId}/reject`, { method: "POST" }); await loadThread(activeId); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [activeId, loadThread]);

  const proposalsByTurn = new Map();
  for (const proposal of proposals) {
    const list = proposalsByTurn.get(proposal.turnId) || [];
    list.push(proposal);
    proposalsByTurn.set(proposal.turnId, list);
  }
  const renderedProposals = new Set();

  return (
    <div className="chat-shell">
      <aside className="chat-threads">
        <button className="core-button" disabled={busy || unavailable} onClick={() => { setActiveId(""); setMessages([]); setProposals([]); }}>New thread</button>
        <div className="chat-threads__list">
          {threads.map((thread) => (
            <button key={thread.id} className={`chat-threads__item${thread.id === activeId ? " is-active" : ""}`} onClick={() => setActiveId(thread.id)}>
              {thread.title || "Untitled"}
            </button>
          ))}
          {!threads.length ? <p className="chat-hint">No conversations yet.</p> : null}
        </div>
      </aside>
      <section className="chat-main">
        {unavailable ? (
          <div className="chat-unavailable">
            <p><strong>DGTL.chat is {health?.state || "unconfigured"}.</strong></p>
            <p>{health?.detail || "No chat model provider is configured. Everything else — HOME, search, opportunities, campaigns, delivery — keeps working."}</p>
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
            const block = (
              <div key={message.id}>
                <Message message={message} />
                {message.role === "assistant" ? attached.map((proposal) => { renderedProposals.add(proposal.id); return <ProposalCard key={proposal.id} proposal={proposal} busy={busy} onConfirm={confirm} onReject={reject} />; }) : null}
              </div>
            );
            return block;
          })}
          {busy ? <p className="chat-hint">Working…</p> : null}
          {error ? <p className="core-notice">{error} <button className="core-button" onClick={() => setError("")}>Dismiss</button></p> : null}
          <div ref={bottomRef} />
        </div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={unavailable ? "DGTL.chat is not available" : "Ask DGTL… (answers are grounded in canonical data)"}
            disabled={busy || unavailable}
            maxLength={4000}
            aria-label="Message DGTL"
          />
          <button className="core-button is-primary" type="submit" disabled={busy || unavailable || !draft.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}
