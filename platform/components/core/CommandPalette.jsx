"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { parseCommand } from "./terminal/commandGrammar";

/**
 * Global search / command entry (⌘K / Ctrl+K). Stage 5 scope: navigation and
 * team-scoped entity lookup against /api/core/search — no conversational
 * agent is connected or advertised, and nothing consequential runs from
 * here. Stage 6 reuses this trigger surface and the same server search
 * service.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const router = useRouter();

  // If what you typed parses as a deterministic terminal command, the palette's
  // one action row offers to RUN it rather than to ask about it — `home` should
  // not cost a model turn just because it was typed into ⌘K. Anything the
  // grammar does not recognise keeps the existing Ask DGTL behaviour, so a
  // typo can never be reinterpreted as a command.
  const isTerminalCommand = ["read", "local"].includes(parseCommand(query.trim()).kind);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(""); setResults([]); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const runSearch = useCallback((value) => {
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/core/search?q=${encodeURIComponent(value)}`, { headers: { accept: "application/json" } });
        const body = await response.json();
        setResults(Array.isArray(body.results) ? body.results : []);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  const go = useCallback((href) => { setOpen(false); router.push(href); }, [router]);

  const onInputKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
    else if (event.key === "Enter" && results[active]) { event.preventDefault(); go(results[active].href); }
  };

  return (
    <>
      <button type="button" className="core-cmdk-trigger" onClick={() => setOpen(true)} aria-label="Search DGTL (Cmd+K)">
        <Search size={14} aria-hidden />
        <span>Search DGTL…</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="core-cmdk-overlay" role="dialog" aria-modal="true" aria-label="Search DGTL" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="core-cmdk">
            <div className="core-cmdk__input">
              <Search size={16} aria-hidden />
              <input
                ref={inputRef}
                value={query}
                placeholder="Search companies, contacts, opportunities, campaigns, artifacts…"
                onChange={(event) => { setQuery(event.target.value); runSearch(event.target.value); }}
                onKeyDown={onInputKeyDown}
                aria-label="Search DGTL"
              />
              <kbd>esc</kbd>
            </div>
            <div className="core-cmdk__results" role="listbox">
              {query.trim().length >= 2 ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="core-cmdk__result core-cmdk__ask"
                  onClick={() => go(isTerminalCommand
                    ? `/chat?mode=terminal&q=${encodeURIComponent(query.trim())}`
                    : `/chat?q=${encodeURIComponent(query.trim())}`)}
                >
                  <span className="core-cmdk__kind">{isTerminalCommand ? "Run" : "Ask DGTL"}</span>
                  <span className="core-cmdk__title">{query.trim()}</span>
                  <span className="core-cmdk__subtitle">{isTerminalCommand ? "Run in the DGTL.chat terminal — no model, no cost" : "Open in DGTL.chat"}</span>
                </button>
              ) : null}
              {loading ? <p className="core-cmdk__hint">Searching…</p> : null}
              {!loading && query.trim().length >= 2 && !results.length ? <p className="core-cmdk__hint">No direct matches in this team — Ask DGTL above hands the question to chat.</p> : null}
              {!loading && query.trim().length < 2 ? <p className="core-cmdk__hint">Type at least two characters. Results stay inside your team.</p> : null}
              {results.map((result, index) => (
                <button
                  key={`${result.kind}:${result.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`core-cmdk__result${index === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result.href)}
                >
                  <span className="core-cmdk__kind">{result.kind.replaceAll("_", " ")}</span>
                  <span className="core-cmdk__title">{result.title}</span>
                  {result.subtitle ? <span className="core-cmdk__subtitle">{result.subtitle}</span> : null}
                  {result.status ? <span className="core-status">{String(result.status).replaceAll("_", " ")}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
