import { EmptyState, PageHeader, Section } from "../../../components/core/CoreUi";
import ChatWorkspace from "../../../components/core/ChatWorkspace";
import { getStage6PageContext } from "../../../lib/stage6/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chat" };

export default async function ChatPage({ searchParams }) {
  const query = await searchParams;
  const { assistant, session } = await getStage6PageContext();
  if (!assistant) {
    return (
      <div className="core-page">
        <PageHeader eyebrow="DGTL" title="DGTL.chat" description="The conversational command layer." />
        <Section title="Unavailable"><EmptyState>DATABASE_URL and migration 014 are required for DGTL.chat.</EmptyState></Section>
      </div>
    );
  }
  const [health, threads] = await Promise.all([assistant.health(), assistant.listThreads()]);
  return (
    <div className="core-page core-chat-page">
      <PageHeader
        eyebrow="DGTL"
        title="DGTL.chat"
        description="Grounded in canonical DGTL data. The assistant proposes; you confirm; existing workflows execute. Terminal mode runs the same tools as typed commands — deterministically, with no model in the loop."
      />
      <ChatWorkspace
        health={health}
        initialThreads={threads}
        initialQuery={String(query?.q || "").slice(0, 2000)}
        // ⌘K sends mode=terminal when what was typed parses as a deterministic
        // command, so it runs as one instead of becoming a model turn.
        initialMode={String(query?.mode || "") === "terminal" ? "terminal" : ""}
        // Role and email only — the terminal's `whoami` reports what the actor
        // may do. No provider detail ever reaches the client.
        actor={{ role: session?.role || "", email: session?.email || session?.user?.email || "" }}
      />
    </div>
  );
}
