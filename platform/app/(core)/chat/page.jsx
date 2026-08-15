import { EmptyState, PageHeader, Section } from "../../../components/core/CoreUi";
import ChatSurface from "../../../components/core/ChatSurface";
import { getStage6PageContext } from "../../../lib/stage6/server";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }) {
  const query = await searchParams;
  const { assistant } = await getStage6PageContext();
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
      <PageHeader eyebrow="DGTL" title="DGTL.chat" description="Grounded in canonical DGTL data. The assistant proposes; you confirm; existing workflows execute." />
      <ChatSurface health={health} initialThreads={threads} initialQuery={String(query?.q || "").slice(0, 2000)} />
    </div>
  );
}
