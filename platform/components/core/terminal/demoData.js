// The scripted demo session: a terminal you can show a prospect without opening
// your real pipeline.
//
// Three things about this file are load-bearing:
//
// 1. It imports NOTHING. No API client, no session hook. The demo dispatcher is
//    the only consumer, and useChatSession additionally refuses every server
//    call while demo mode is latched — so there is no path from here to the API.
// 2. Every record is tagged demo:true and every name is obviously invented.
//    The prior art's fixtures were named DMTV, Ledger and Six Senses Ibiza —
//    two real DGTL clients and a real hotel — which is exactly how a screenshot
//    ends up asserting something false about a real business.
// 3. Nothing here is ever persisted, sent, or rendered beside real data: the
//    real line buffer is hidden (not merged) while demo mode is active.

const demo = (record) => Object.freeze({ ...record, demo: true });

export const DEMO_COMPANIES = Object.freeze([
  demo({
    id: "demo_northwind",
    name: "Northwind Apparel",
    domain: "northwind.example",
    industry: "Apparel / DTC",
    relationship: "client",
    contacts: [
      { name: "Ada Sample", title: "Head of Brand", email: "ada@northwind.example" },
      { name: "Ben Placeholder", title: "Growth Lead", email: "ben@northwind.example" },
    ],
  }),
  demo({
    id: "demo_harbourline",
    name: "Harbourline Coffee",
    domain: "harbourline.example",
    industry: "Hospitality",
    relationship: "prospect",
    contacts: [{ name: "Cleo Example", title: "Founder", email: "cleo@harbourline.example" }],
  }),
]);

export const DEMO_OPPORTUNITIES = Object.freeze([
  demo({ id: "demo_opp_1", name: "Northwind spring campaign", company: "Northwind Apparel", stage: "proposal", status: "open", value: "42,000 CAD", nextAction: "Send the revised scope", nextActionAt: "2026-09-04" }),
  demo({ id: "demo_opp_2", name: "Harbourline site rebuild", company: "Harbourline Coffee", stage: "discovery", status: "open", value: "18,000 CAD", nextAction: "Book the discovery call", nextActionAt: "2026-08-28" }),
  demo({ id: "demo_opp_3", name: "Northwind retainer", company: "Northwind Apparel", stage: "won", status: "open", value: "6,000 CAD/mo", nextAction: "Kick off delivery", nextActionAt: "2026-08-25" }),
]);

export const DEMO_SNAPSHOT = Object.freeze({
  metrics: [
    { label: "attention", value: 3 },
    { label: "approvals", value: 2 },
    { label: "pipeline", value: 3 },
    { label: "drafts", value: 4 },
  ],
  attention: [
    { severity: "critical", title: "Northwind spring campaign has no next action set" },
    { severity: "warning", title: "2 messages have been awaiting approval for 6 days" },
    { severity: "info", title: "Harbourline site rebuild is 12 days into discovery" },
  ],
});

export const DEMO_EXCEPTIONS = Object.freeze([
  demo({ severity: "warning", type: "delivery.uncertain", summary: "One delivery operation has an unknown outcome" }),
]);

export const DEMO_ACTIVITY = Object.freeze([
  demo({ at: "2026-08-16", summary: "Northwind retainer moved to won" }),
  demo({ at: "2026-08-15", summary: "Draft follow-up created for Harbourline Coffee" }),
  demo({ at: "2026-08-14", summary: "Harbourline site rebuild created from an import" }),
]);

// Which commands do something in demo mode. Anything else prints a line saying
// the demo does not cover it — rather than silently appearing to work.
export const DEMO_COMMANDS = Object.freeze(["home", "search", "opp", "company", "exceptions", "activity", "ask", "help", "clear", "demo exit"]);

export const DEMO_BANNER = "DEMO — NOT YOUR DATA · nothing here is canonical · type `demo exit` to return";

export const DEMO_ASK_PREFIX = "DEMO ANSWER — scripted, not a model call";
