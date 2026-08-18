"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiAbortable, isAbort } from "./chatClient";

// One owner of DGTL.chat's state, consumed by both the bubble chat and the
// terminal. They render the SAME messages and proposals arrays, so switching
// surfaces cannot duplicate a message, drop one, or fire a second fetch.
//
// Extracted from ChatSurface, which used to own all of this itself, plus the
// three things the terminal needs and the original lacked: abort, thread-status
// reconciliation, and a demo latch.

export function useChatSession({ initialThreads = [], initialQuery = "", unavailable = false } = {}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState(initialThreads[0]?.id || "");
  const [messages, setMessages] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reconciling, setReconciling] = useState(false);

  const bootRef = useRef(false);
  const abortRef = useRef(null);
  // Demo mode is a hard latch, not a flag the render path consults politely:
  // every server call below refuses outright while it is set, so no scripted
  // value can reach the API and no real value can reach the demo buffer.
  const demoRef = useRef(false);

  const setDemoActive = useCallback((active) => { demoRef.current = Boolean(active); }, []);
  const assertLive = () => {
    if (demoRef.current) throw new Error("demo session cannot reach the DGTL API");
  };

  const loadThread = useCallback(async (threadId) => {
    if (!threadId) { setMessages([]); setProposals([]); return; }
    try {
      const body = await api(`/api/core/chat/threads/${threadId}`);
      setMessages(body.messages || []);
      setProposals(body.proposals || []);
      return body;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    }
  }, []);

  useEffect(() => { loadThread(activeId); }, [activeId, loadThread]);

  const ensureThread = useCallback(async (title) => {
    if (activeId) return activeId;
    const created = await api("/api/core/chat/threads", { method: "POST", body: JSON.stringify({ title: String(title || "").slice(0, 80) }) });
    setThreads((existing) => [created.thread, ...existing]);
    setActiveId(created.thread.id);
    return created.thread.id;
  }, [activeId]);

  // Abort cancels the client fetch only. The server turn continues under the
  // thread CAS, so poll until the thread returns to idle and re-read it rather
  // than pretending the work stopped.
  const reconcile = useCallback(async (threadId) => {
    setReconciling(true);
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const body = await loadThread(threadId);
        if (body?.thread?.status === "idle") return true;
      }
      return false;
    } finally {
      setReconciling(false);
    }
  }, [loadThread]);

  const abort = useCallback(() => {
    abortRef.current?.abort(new DOMException("Cancelled", "AbortError"));
  }, []);

  // A model turn. The only path that spends tokens.
  const send = useCallback(async (text, threadId = activeId) => {
    const message = String(text || "").trim();
    if (!message || busy) return null;
    assertLive();
    setBusy(true); setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    let targetThread = threadId;
    try {
      targetThread = threadId || (await ensureThread(message));
      setMessages((existing) => [...existing, { id: `local-${Date.now()}`, role: "user", content: message }]);
      await apiAbortable(`/api/core/chat/threads/${targetThread}/turns`, {
        method: "POST", body: JSON.stringify({ message }), signal: controller.signal,
      });
      // The reloaded thread is returned, not just stored: a caller that awaits
      // send() still holds the PRE-send `messages` from its own closure, so it
      // must read the answer from here rather than from React state.
      const body = await loadThread(targetThread);
      return { threadId: targetThread, messages: body?.messages || [], proposals: body?.proposals || [] };
    } catch (requestError) {
      if (isAbort(requestError)) {
        if (targetThread) reconcile(targetThread);
        return { aborted: true, threadId: targetThread };
      }
      setError(requestError.message);
      return null;
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [activeId, busy, ensureThread, loadThread, reconcile]);

  // A deterministic read command. No model, no tokens, and it works even when
  // no chat provider is configured.
  const runRead = useCallback(async (toolId, args = {}) => {
    if (busy) return null;
    assertLive();
    setBusy(true); setError("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const targetThread = await ensureThread(toolId);
      const result = await apiAbortable("/api/core/chat/commands", {
        method: "POST", body: JSON.stringify({ threadId: targetThread, toolId, args }), signal: controller.signal, timeoutMs: 30_000,
      });
      await loadThread(targetThread);
      return result;
    } catch (requestError) {
      if (isAbort(requestError)) return { aborted: true };
      // Returned rather than only set, so the terminal can print it as a line
      // in place instead of surfacing a banner far from the prompt.
      setError(requestError.message);
      return { error: requestError.message, code: requestError.code };
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, ensureThread, loadThread]);

  const confirm = useCallback(async (proposalId) => {
    assertLive();
    setBusy(true); setError("");
    try {
      await api(`/api/core/chat/proposals/${proposalId}/confirm`, { method: "POST" });
      await loadThread(activeId);
    } catch (requestError) {
      setError(requestError.message);
      await loadThread(activeId);
    } finally { setBusy(false); }
  }, [activeId, loadThread]);

  const reject = useCallback(async (proposalId) => {
    assertLive();
    setBusy(true); setError("");
    try {
      await api(`/api/core/chat/proposals/${proposalId}/reject`, { method: "POST" });
      await loadThread(activeId);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }, [activeId, loadThread]);

  const newThread = useCallback(() => { setActiveId(""); setMessages([]); setProposals([]); }, []);

  useEffect(() => {
    if (initialQuery && !bootRef.current && !unavailable) { bootRef.current = true; send(initialQuery, ""); }
  }, [initialQuery, send, unavailable]);

  return {
    threads, activeId, messages, proposals, busy, error, reconciling,
    setActiveId, newThread, loadThread, send, runRead, confirm, reject,
    abort, setError, setDemoActive,
  };
}
