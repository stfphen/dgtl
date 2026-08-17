"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMMANDS, completions, helpRows, parseCommand } from "./commandGrammar";
import { renderToolResult } from "./renderToolResult";
import { DEMO_ACTIVITY, DEMO_ASK_PREFIX, DEMO_BANNER, DEMO_COMPANIES, DEMO_EXCEPTIONS, DEMO_OPPORTUNITIES, DEMO_SNAPSHOT } from "./demoData";
import { KeyValueRows, Line, MetricRow, Panel, Pre, Prompt, SourceRefChips, SuggestRow, TerminalProposal, ThinkingLine, ToolSummaryLine } from "./TerminalBlocks";

// DGTL.chat terminal mode.
//
// Reads the same thread as the chat view through the same useChatSession hook,
// so switching surfaces neither re-fetches nor loses anything.
//
// Only command history and the mode preference are persisted. Message content,
// tool results, refs, proposal ids and thread ids are NOT: Stage 6 treats
// business data as untrusted and team-scoped, while localStorage is origin-
// scoped and survives both logout and a user switch on a shared machine. The
// server already persists threads — that is the right store.
const STORAGE_KEY = "dgtl.terminal.v1";
const HISTORY_LIMIT = 50;

const readStore = () => {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {}; } catch { return {}; }
};
const writeStore = (patch) => {
  try {
    const next = { ...readStore(), ...patch, v: 1 };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* private mode, quota — history is a convenience, never required */ }
};

let seq = 0;
const uid = () => { seq += 1; return `t${seq}`; };

const BOOT_CHIPS = ["home", "search ", "exceptions", "activity", "help"];

export default function TerminalSurface({ session, health, actor, initialCommand = "", onExit }) {
  const { proposals, busy, error, reconciling, runRead, send, confirm, reject, abort, setError, setDemoActive } = session;

  const [buffer, setBuffer] = useState([]);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState(BOOT_CHIPS);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [refs, setRefs] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [demo, setDemo] = useState(false);

  const inputRef = useRef(null);
  const logRef = useRef(null);
  const pendingAskRef = useRef(null);
  const bootedRef = useRef(false);

  const providerReady = Boolean(health) && !["unconfigured", "disabled", "unavailable"].includes(health.state);

  const push = useCallback((node) => setBuffer((existing) => [...existing, { id: uid(), node }]), []);

  // ------------------------------------------------------------ boot

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const stored = readStore();
    if (Array.isArray(stored.history)) setHistory(stored.history.slice(0, HISTORY_LIMIT));
    push(<Line tone="accent">DGTL.chat terminal · grounded in canonical DGTL data</Line>);
    push(
      <Line tone="dim">
        {providerReady
          ? "read commands run deterministically (no model, no cost) · `ask` and `prepare` run a model turn"
          : "no chat model provider configured — read commands still work; `ask` and `prepare` do not"}
      </Line>
    );
    push(<Line tone="dim">type `help` for the command reference · ↑/↓ history · tab completes · ⌃C cancels</Line>);
  }, [providerReady, push]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [buffer, busy]);

  // Elapsed counter — honest, because elapsed time is observable. Tool progress
  // is not: the turns endpoint is not a stream, so nothing else is claimed.
  useEffect(() => {
    if (!busy) { setElapsed(0); return undefined; }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // New proposals from the shared session get printed into the terminal too.
  const seenProposals = useRef(new Set());
  useEffect(() => {
    for (const proposal of proposals) {
      if (seenProposals.current.has(`${proposal.id}:${proposal.status}`)) continue;
      seenProposals.current.add(`${proposal.id}:${proposal.status}`);
      push(<TerminalProposal proposal={proposal} busy={busy} onConfirm={confirm} onReject={reject} />);
    }
  }, [proposals, busy, confirm, reject, push]);

  useEffect(() => { if (error) { push(<Line tone="err">{error}</Line>); setError(""); } }, [error, push, setError]);
  useEffect(() => { if (reconciling) push(<Line tone="dim">reconciling thread state…</Line>); }, [reconciling, push]);

  const rememberHistory = useCallback((line, parsed) => {
    setHistoryIndex(-1);
    // Only recognised commands persist, and quoted literals are stripped first —
    // a free-text question is business content and stays in memory only.
    const persistable = parsed.kind === "read" || parsed.kind === "local";
    setHistory((existing) => {
      const next = [line, ...existing.filter((item) => item !== line)].slice(0, HISTORY_LIMIT);
      if (persistable) writeStore({ history: next.filter((item) => item.length <= 200) });
      return next;
    });
  }, []);

  // ------------------------------------------------------------ demo

  const enterDemo = useCallback(() => {
    setDemo(true);
    setDemoActive(true);
    setBuffer([]);          // the real buffer is hidden, not merged
    setChips(["home", "search northwind", "opp demo_opp_1", "exceptions", "demo exit"]);
    push(<Line tone="warn">{DEMO_BANNER}</Line>);
    push(<Line tone="dim">every value below is invented. nothing is sent to DGTL.</Line>);
  }, [push, setDemoActive]);

  const exitDemo = useCallback(() => {
    setDemo(false);
    setDemoActive(false);
    setBuffer([]);
    setChips(BOOT_CHIPS);
    push(<Line tone="ok">left the demo · back on your real data</Line>);
  }, [push, setDemoActive]);

  const runDemo = useCallback((parsed, raw) => {
    const head = parsed.kind === "read" ? parsed.head : String(raw.split(/\s+/)[0] || "").toLowerCase();
    if (head === "home" || head === "attention") {
      push(<Panel eyebrow="DEMO" title="operating snapshot" pill="DEMO">
        <MetricRow items={DEMO_SNAPSHOT.metrics} />
        {DEMO_SNAPSHOT.attention.map((item) => <Line key={item.title} tone={item.severity === "critical" ? "err" : item.severity === "warning" ? "warn" : ""}>[{item.severity}] {item.title}</Line>)}
      </Panel>);
      return;
    }
    if (head === "search" || head === "find") {
      const results = [...DEMO_OPPORTUNITIES, ...DEMO_COMPANIES];
      setRefs(results.map((r) => ({ id: r.id })));
      push(<Panel eyebrow="DEMO" title="results" pill="DEMO">
        {results.map((r, i) => <Line key={r.id}>[{i + 1}] {r.name}{r.stage ? ` · ${r.stage}` : ` · ${r.industry}`}</Line>)}
      </Panel>);
      return;
    }
    if (head === "opp" || head === "opportunity") {
      const target = DEMO_OPPORTUNITIES[0];
      push(<Panel eyebrow="DEMO" title={target.name} pill="DEMO">
        <KeyValueRows rows={[
          { key: "company", value: target.company }, { key: "stage", value: target.stage },
          { key: "value", value: target.value }, { key: "next action", value: target.nextAction },
          { key: "due", value: target.nextActionAt },
        ]} />
      </Panel>);
      return;
    }
    if (head === "company") {
      const target = DEMO_COMPANIES[0];
      push(<Panel eyebrow="DEMO" title={target.name} pill="DEMO">
        <KeyValueRows rows={[{ key: "domain", value: target.domain }, { key: "industry", value: target.industry }, { key: "relationship", value: target.relationship }]} />
        {target.contacts.map((c) => <Line key={c.email}>  {c.name} · {c.title} · {c.email}</Line>)}
      </Panel>);
      return;
    }
    if (head === "exceptions") {
      push(<Panel eyebrow="DEMO" title="open exceptions" pill="DEMO">
        {DEMO_EXCEPTIONS.map((e) => <Line key={e.summary} tone="warn">[{e.severity}] {e.type} · {e.summary}</Line>)}
      </Panel>);
      return;
    }
    if (head === "activity") {
      push(<Panel eyebrow="DEMO" title="recent activity" pill="DEMO">
        {DEMO_ACTIVITY.map((a) => <Line key={a.summary}>{a.at}  {a.summary}</Line>)}
      </Panel>);
      return;
    }
    if (head === "ask") {
      push(<Panel eyebrow="DEMO" title="answer" pill="DEMO">
        <Line tone="warn">{DEMO_ASK_PREFIX}</Line>
        <Line>Northwind spring campaign is the one to move on: it is in proposal with no next action set.</Line>
      </Panel>);
      return;
    }
    push(<Line tone="dim">the demo does not cover `{head}` — try home, search, opp, company, exceptions, activity, ask</Line>);
  }, [push]);

  // ------------------------------------------------------------ dispatch

  const runLocal = useCallback((parsed) => {
    switch (parsed.action) {
      case "help":
        push(<Panel eyebrow="REFERENCE" title="commands">
          {helpRows().map((row) => (
            <div key={row.usage}>
              <Line><span className="term-help__kind" data-kind={row.kind}>{row.kind}</span> <span className="term-help__usage">{row.usage}</span> <span className="term-help__summary">{row.summary}</span></Line>
              {row.subs.map((sub) => <Line key={sub.usage} tone="dim">    {sub.usage}  {sub.summary}</Line>)}
            </div>
          ))}
          <Line tone="dim">`read` runs a real tool with no model and no cost. `turn` runs a billable model turn.</Line>
          <Line tone="dim">stored locally: your command history and the mode preference. never any business data.</Line>
        </Panel>);
        return;
      case "clear":
        setBuffer([]);
        push(<Line tone="dim">display cleared — the thread is intact</Line>);
        return;
      case "history":
        if (parsed.args[0] === "clear") { setHistory([]); writeStore({ history: [] }); push(<Line tone="ok">history cleared</Line>); return; }
        push(history.length
          ? <Panel eyebrow="HISTORY">{history.slice(0, 20).map((item, i) => <Line key={`${item}-${i}`}>{String(i + 1).padStart(3)}  {item}</Line>)}</Panel>
          : <Line tone="dim">no history yet</Line>);
        return;
      case "mode":
        if (String(parsed.args[0] || "").toLowerCase() === "chat") { onExit(); return; }
        push(<Line tone="dim">already in terminal mode — `mode chat` to switch</Line>);
        return;
      case "whoami":
        push(<Panel eyebrow="SESSION">
          <KeyValueRows rows={[
            { key: "user", value: actor?.email || "—" },
            { key: "role", value: actor?.role || "—" },
            { key: "read commands", value: "available (deterministic, no model)" },
            { key: "model turns", value: providerReady ? `available · ${health?.provider || "provider"}` : `unavailable · ${health?.state || "unconfigured"}` },
          ]} />
        </Panel>);
        return;
      case "proposals": {
        const open = proposals.filter((p) => p.status === "proposed");
        push(open.length
          ? <Panel eyebrow="PROPOSALS">{open.map((p, i) => <Line key={p.id}>[{i + 1}] {p.actionId} · {p.impactSummary}</Line>)}<Line tone="dim">confirm with the buttons on the proposal card above — never by typing.</Line></Panel>
          : <Line tone="dim">no proposals awaiting confirmation</Line>);
        return;
      }
      case "refs":
        push(refs.length
          ? <Panel eyebrow="REFS">{refs.map((r, i) => <Line key={r.id}>[{i + 1}] {r.label || r.id}</Line>)}</Panel>
          : <Line tone="dim">{"no numbered results yet — run `search <name>` or `home`"}</Line>);
        return;
      case "cancel":
        if (busy) { abort(); push(<Line tone="warn">^C — cancelled locally. the server turn may still complete; reconciling…</Line>); }
        else push(<Line tone="dim">nothing running</Line>);
        return;
      case "demo":
        if (String(parsed.args[0] || "").toLowerCase() === "exit") { if (demo) exitDemo(); else push(<Line tone="dim">not in demo mode</Line>); return; }
        if (demo) push(<Line tone="dim">already in demo mode — `demo exit` to leave</Line>);
        else enterDemo();
        return;
      default:
        push(<Line tone="dim">not wired: {parsed.action}</Line>);
    }
  }, [abort, actor, busy, demo, enterDemo, exitDemo, health, history, onExit, proposals, providerReady, push, refs]);

  const runRead_ = useCallback(async (parsed) => {
    const result = await runRead(parsed.toolId, parsed.args);
    if (!result) return;
    if (result.aborted) { push(<Line tone="warn">^C — cancelled</Line>); return; }
    if (result.error) { push(<Line tone="err">{result.error}</Line>); return; }

    const blocks = renderToolResult(result.toolId, result.data);
    push(
      <Panel eyebrow={result.toolId} pill="live">
        {blocks.map((block, index) => {
          if (block.type === "kv") return <KeyValueRows key={index} rows={block.rows} />;
          if (block.type === "metrics") return <MetricRow key={index} items={block.items} />;
          if (block.type === "pre") return <Pre key={index}>{block.text}</Pre>;
          return block.items.map((item, i) => <Line key={`${index}-${i}`} tone={item.tone}>{item.text}</Line>);
        })}
        <ToolSummaryLine runs={result.toolSummary} />
        <SourceRefChips refs={result.sourceRefs} />
      </Panel>
    );
    // Refs come only from the tool result, so a later #n can never invent an id.
    if (Array.isArray(result.sourceRefs) && result.sourceRefs.length) setRefs(result.sourceRefs);
    if (result.toolId === "core.search") setChips(["opp #1", "company #1", "home", "help"]);
  }, [push, runRead]);

  const runTurn = useCallback(async (parsed) => {
    if (!providerReady) {
      push(<Line tone="warn">no chat model provider is configured, so `{parsed.head}` cannot run. every read command still works.</Line>);
      return;
    }
    push(<Line tone="dim">↳ sent · model turn · tools chosen server-side · up to 60s</Line>);
    const result = await send(parsed.message);
    if (result?.aborted) { push(<Line tone="warn">^C — cancelled locally. the server turn may still complete; reconciling…</Line>); return; }
    if (!result) return;
    // From the returned thread, not from `messages` — that closure variable is
    // the pre-send array and would print the previous answer.
    const latest = [...(result.messages || [])].reverse().find((m) => m.role === "assistant");
    if (latest) {
      push(<Panel eyebrow="DGTL" pill="live">
        {String(latest.content).split("\n").map((l, i) => <Line key={i}>{l}</Line>)}
        <ToolSummaryLine runs={latest.toolSummary} />
        <SourceRefChips refs={latest.sourceRefs} />
      </Panel>);
      if (Array.isArray(latest.sourceRefs) && latest.sourceRefs.length) setRefs(latest.sourceRefs);
    }
  }, [providerReady, push, send]);

  const run = useCallback(async (raw) => {
    const line = String(raw || "");
    const parsed = parseCommand(line, { refs });
    if (parsed.kind === "empty") return;   // no bare prompt row for an empty enter

    push(<Prompt label={demo ? "dgtl-demo ❯" : "dgtl ❯"} command={line} />);
    rememberHistory(line.trim(), parsed);
    setInput("");

    if (demo) {
      if (parsed.kind === "local" && (parsed.action === "demo" || parsed.action === "clear" || parsed.action === "help" || parsed.action === "mode")) { runLocal(parsed); return; }
      runDemo(parsed, line.trim());
      return;
    }

    if (parsed.kind === "error") { push(<Line tone="err">{parsed.message}</Line>); return; }
    if (parsed.kind === "local") { runLocal(parsed); return; }
    if (parsed.kind === "read") { await runRead_(parsed); return; }
    if (parsed.kind === "turn") { await runTurn(parsed); return; }

    // Unknown: refused, and it costs nothing. A second identical enter opts in.
    const trimmed = line.trim();
    if (pendingAskRef.current === trimmed) {
      pendingAskRef.current = null;
      await runTurn({ head: "ask", message: trimmed });
      return;
    }
    pendingAskRef.current = trimmed;
    setTimeout(() => { if (pendingAskRef.current === trimmed) pendingAskRef.current = null; }, 15_000);
    push(<Line tone="warn">{parsed.message}</Line>);
    push(<Line tone="dim">press ⏎ again to ask DGTL instead (billable model turn), or run `help`</Line>);
  }, [demo, push, refs, rememberHistory, runDemo, runLocal, runRead_, runTurn]);

  // ------------------------------------------------------------ keyboard

  const onKeyDown = useCallback((event) => {
    // The input is readOnly — not disabled — while a turn runs, precisely so it
    // keeps focus and ⌃C stays reachable. A disabled input fires no keydown and
    // loses focus, which made the advertised cancel key do nothing. Everything
    // that would edit or submit is ignored here instead.
    if (busy) {
      if (event.ctrlKey && (event.key === "c" || event.key === "C")) {
        event.preventDefault();
        abort();
        push(<Line tone="warn">^C — cancelled locally. the server turn may still complete; reconciling…</Line>);
        return;
      }
      if (event.ctrlKey && (event.key === "l" || event.key === "L")) { event.preventDefault(); setBuffer([]); return; }
      if (event.key === "Escape") { inputRef.current?.blur(); return; }
      if (event.key === "Enter" || event.key === "Tab" || event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
      return;
    }

    if (event.key === "Enter") { event.preventDefault(); run(input); return; }

    if (event.key === "Tab") {
      const result = completions(input);
      // Only swallow Tab when there is genuinely something to offer — otherwise
      // the input becomes a keyboard trap (WCAG 2.1.2).
      if (result.completion) { event.preventDefault(); setInput(result.completion); return; }
      if (result.candidates?.length) { event.preventDefault(); push(<Line tone="dim">{result.candidates.join("  ")}</Line>); return; }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHistoryIndex((index) => {
        const next = Math.min(index + 1, history.length - 1);
        if (next >= 0 && history[next] !== undefined) setInput(history[next]);
        return next;
      });
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHistoryIndex((index) => {
        const next = index - 1;
        if (next < 0) { setInput(""); return -1; }
        setInput(history[next] ?? "");
        return next;
      });
      return;
    }
    if (event.key === "Escape") { inputRef.current?.blur(); return; }

    if (event.ctrlKey && (event.key === "c" || event.key === "C")) {
      event.preventDefault();
      if (busy) { abort(); push(<Line tone="warn">^C — cancelled locally. the server turn may still complete; reconciling…</Line>); }
      else if (input) { push(<Prompt label="dgtl ❯" command={`${input}^C`} />); setInput(""); }
      return;
    }
    if (event.ctrlKey && (event.key === "l" || event.key === "L")) { event.preventDefault(); setBuffer([]); }
  }, [abort, busy, history, input, push, run]);

  // A command handed over by ⌘K runs once, after boot. Only read and local
  // commands arrive this way (the palette checks the grammar before routing
  // here), so an auto-run can never spend tokens.
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (autoRunRef.current || !initialCommand) return;
    const parsed = parseCommand(initialCommand, { refs: [] });
    if (parsed.kind !== "read" && parsed.kind !== "local") return;
    autoRunRef.current = true;
    run(initialCommand);
  }, [initialCommand, run]);

  const chipItems = useMemo(
    () => chips.map((command) => ({ command, billable: /^(ask|prepare)\b/.test(command) })),
    [chips]
  );

  return (
    <section className={`term-shell${demo ? " is-demo" : ""}`}>
      {demo ? <div className="term-demo-banner" role="status">{DEMO_BANNER}</div> : null}

      <div
        className="term-log"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        aria-label="Terminal output"
        tabIndex={0}
        onClick={() => { if (!window.getSelection()?.toString()) inputRef.current?.focus(); }}
      >
        {buffer.map((entry) => <div key={entry.id}>{entry.node}</div>)}
        {busy ? <ThinkingLine seconds={elapsed} onCancel={abort} /> : null}
      </div>

      <div className="term-input">
        <SuggestRow chips={chipItems} onRun={(command) => run(command)} onFill={(command) => { setInput(command); inputRef.current?.focus(); }} />
        <div className="term-row">
          <span className="term-ps" aria-hidden>{demo ? "dgtl-demo ❯" : "dgtl ❯"}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            readOnly={busy}
            aria-busy={busy}
            maxLength={4000}
            aria-label="Terminal command"
            aria-describedby="term-hint"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder={busy ? "working…" : "type a command, or `help`"}
          />
        </div>
        <p className="term-hint" id="term-hint">
          ↑/↓ history · tab completes · ⌃C cancels · ⌃L clears <span className="term-hint__mobile">(keyboard shortcuts are desktop-only — use the chips above)</span>
        </p>
      </div>
    </section>
  );
}
