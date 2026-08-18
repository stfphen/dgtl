"use client";

import { useEffect, useState } from "react";
import ChatSurface from "./ChatSurface";
import TerminalSurface from "./terminal/TerminalSurface";
import { useChatSession } from "./useChatSession";

// DGTL.chat: one thread, two surfaces.
//
// The hook is called ONCE here and handed to whichever view is showing, so the
// two can never diverge — switching modes re-renders, it does not re-fetch, and
// a message cannot appear twice or go missing.
//
// Tabs, not buttons: this is one thread rendered two ways, which is exactly the
// tab pattern's semantics.

const STORAGE_KEY = "dgtl.terminal.v1";

export default function ChatWorkspace({ health, initialThreads = [], initialQuery = "", initialMode = "", actor }) {
  const unavailable = !health || ["unconfigured", "disabled", "unavailable"].includes(health.state);
  const terminalFirst = initialMode === "terminal";

  // initialQuery reaches the hook — which auto-sends it as a MODEL TURN — only
  // when this is a chat-bound question. A ⌘K command arrives with
  // mode=terminal and is handed to the terminal to run deterministically, so
  // typing `home` into the palette never buys a turn.
  const session = useChatSession({
    initialThreads,
    initialQuery: terminalFirst ? "" : initialQuery,
    unavailable,
  });
  const [mode, setMode] = useState(terminalFirst ? "terminal" : "chat");
  const [draft, setDraft] = useState("");

  // Restore the preferred surface after mount rather than during render, so the
  // server and client markup agree. An explicit ?mode= wins over the stored
  // preference — it is a deliberate act, not a default.
  useEffect(() => {
    if (terminalFirst) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (stored.mode === "terminal" || stored.mode === "chat") setMode(stored.mode);
      // With no provider configured the chat view can only show its unavailable
      // state, while the terminal's read commands all work — so open there.
      else if (unavailable) setMode("terminal");
    } catch { /* ignore */ }
  }, [terminalFirst, unavailable]);

  const switchMode = (next) => {
    setMode(next);
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, v: 1, mode: next }));
    } catch { /* ignore */ }
  };

  return (
    <div className="chat-shell">
      <aside className="chat-threads">
        {/* Plain, not is-primary: #34 rations gold to the primary action, and on this
            screen that is Send / Confirm, not "New thread". */}
        <button className="core-button" disabled={session.busy} onClick={session.newThread}>New thread</button>
        <div className="chat-threads__list">
          {session.threads.map((thread) => (
            <button
              key={thread.id}
              className={`chat-threads__item${thread.id === session.activeId ? " is-active" : ""}`}
              onClick={() => session.setActiveId(thread.id)}
            >
              {thread.title || "Untitled"}
            </button>
          ))}
          {!session.threads.length ? <p className="chat-hint">No conversations yet.</p> : null}
        </div>
      </aside>

      <div className="chat-workspace">
        <div className="chat-modes" role="tablist" aria-label="DGTL.chat surface">
          <button
            type="button" role="tab" id="tab-chat" aria-controls="panel-chat"
            aria-selected={mode === "chat"}
            className={`chat-mode${mode === "chat" ? " is-active" : ""}`}
            onClick={() => switchMode("chat")}
          >
            Chat
          </button>
          <button
            type="button" role="tab" id="tab-terminal" aria-controls="panel-terminal"
            aria-selected={mode === "terminal"}
            className={`chat-mode${mode === "terminal" ? " is-active" : ""}`}
            onClick={() => switchMode("terminal")}
          >
            Terminal
          </button>
          {unavailable ? <span className="chat-mode__note">no model provider — terminal read commands still work</span> : null}
        </div>

        {mode === "chat" ? (
          <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" className="chat-panel">
            <ChatSurface session={session} health={health} draft={draft} onDraftChange={setDraft} />
          </div>
        ) : (
          <div role="tabpanel" id="panel-terminal" aria-labelledby="tab-terminal" className="chat-panel">
            <TerminalSurface
              session={session}
              health={health}
              actor={actor}
              initialCommand={terminalFirst ? initialQuery : ""}
              onExit={() => switchMode("chat")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
