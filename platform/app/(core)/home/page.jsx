import { DateText, EmptyState, PageHeader, Section, Status } from "../../../components/core/CoreUi";
import CommandPalette from "../../../components/core/CommandPalette";
import { getStage5PageContext } from "../../../lib/stage5/server";

export const dynamic = "force-dynamic";

const minutesLabel = (minutes) => `${Math.floor(Number(minutes || 0) / 60)}h ${Number(minutes || 0) % 60}m`;
const money = (value) => `CAD ${Number(value || 0).toLocaleString("en-CA")}`;

function Degraded({ section }) {
  return <EmptyState>This section is temporarily unavailable: {section.error}</EmptyState>;
}

function AttentionList({ attention }) {
  if (attention.state !== "ok") return <Degraded section={attention} />;
  const { items } = attention.data;
  if (!items.length) return <EmptyState>Nothing needs attention right now.</EmptyState>;
  return (
    <div className="core-stack">
      {items.slice(0, 12).map((item) => (
        <a className="core-record-link core-attention" key={item.key} href={item.href}>
          <span>
            <strong>{item.title}</strong>
            <small>{item.explanation}{item.recommendedAction ? ` · ${item.recommendedAction}` : ""}</small>
          </span>
          <span className="core-record-link__right">
            <Status value={item.severity} />
          </span>
        </a>
      ))}
      {items.length > 12 ? <p className="core-home-note">{items.length - 12} more attention item{items.length - 12 === 1 ? "" : "s"} below the fold — resolve the top ones first.</p> : null}
    </div>
  );
}

function TodayList({ today }) {
  if (today.state !== "ok") return <Degraded section={today} />;
  const { items, date } = today.data;
  if (!items.length) return <EmptyState>Nothing is due today ({date}).</EmptyState>;
  return (
    <div className="core-stack">
      {items.map((item, index) => (
        <a className="core-record-link" key={`${item.kind}-${index}`} href={item.href}>
          <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
          <Status value={item.overdue ? "overdue" : "due today"} />
        </a>
      ))}
    </div>
  );
}

function ApprovalsList({ approvals }) {
  if (approvals.state !== "ok") return <Degraded section={approvals} />;
  const { items, canApprove } = approvals.data;
  if (!items.length) return <EmptyState>Nothing waiting for approval.</EmptyState>;
  return (
    <div className="core-stack">
      {!canApprove ? <p className="core-home-note">These need an owner or admin; you can review but not approve.</p> : null}
      {items.slice(0, 10).map((item) => (
        <a className="core-record-link" key={item.key} href={item.href}>
          <span><strong>{item.title}</strong><small>{item.explanation}</small></span>
          <Status value={item.kind} />
        </a>
      ))}
    </div>
  );
}

function PipelinePanel({ pipeline }) {
  if (pipeline.state !== "ok") return <Degraded section={pipeline} />;
  const data = pipeline.data;
  return (
    <div className="core-stack">
      <p className="core-home-note">
        <a href="/opportunities">{data.activeCount} active opportunit{data.activeCount === 1 ? "y" : "ies"}</a>
        {" · "}{data.knownValueTotal > 0 ? `${money(data.knownValueTotal)} known value` : "no estimated values recorded"}
        {data.unknownValueCount > 0 ? ` · ${data.unknownValueCount} without a value estimate` : ""}
      </p>
      {data.stages.length ? (
        <div className="core-home-stages">
          {data.stages.map((row) => (
            <a key={row.stage} className="core-home-stage" href="/opportunities">
              <strong>{row.count}</strong>
              <span>{row.stage.replaceAll("_", " ")}</span>
              <small>{row.knownValue > 0 ? money(row.knownValue) : "—"}{row.unknownValueCount ? ` · ${row.unknownValueCount} unvalued` : ""}</small>
            </a>
          ))}
        </div>
      ) : <EmptyState>No active opportunities yet — import prospects to begin.</EmptyState>}
      <p className="core-home-note">{data.needingAction} needing action · {data.awaitingHandoff} awaiting delivery handoff{data.recentWins.length ? <> · recent wins: {data.recentWins.map((win, index) => <span key={win.id}>{index ? ", " : ""}<a href={win.href}>{win.name}</a></span>)}</> : ""}</p>
    </div>
  );
}

function OutreachPanel({ outreach }) {
  if (outreach.state !== "ok") return <Degraded section={outreach} />;
  const data = outreach.data;
  const stats = [
    ["Active campaigns", data.activeCampaigns, "/campaigns"], ["In review", data.reviewCampaigns, "/campaigns"],
    ["Draft messages", data.draftMessages, "/campaigns"], ["Queued", data.queued, "/operations/outbox"],
    ["Sent", data.sent, "/operations/outbox"], ["Delivered", data.delivered, "/operations/outbox"],
    ["Bounced", data.bounced, "/operations/outbox"], ["Suppressed", data.suppressed, "/operations/outbox"],
    ["Dead-letter", data.deadLetter, "/operations/outbox"], ["Uncertain", data.deliveryUncertain, "/operations/outbox"],
  ];
  return (
    <div className="core-home-stats">
      {stats.map(([label, value, href]) => (
        <a key={label} className={`core-home-stat${["Dead-letter", "Uncertain", "Bounced"].includes(label) && value > 0 ? " is-alert" : ""}`} href={href}>
          <strong>{value}</strong><span>{label}</span>
        </a>
      ))}
    </div>
  );
}

function DeliveryPanel({ delivery }) {
  if (delivery.state !== "ok") return <Degraded section={delivery} />;
  const data = delivery.data;
  return (
    <div className="core-stack">
      <div className="core-home-stats">
        <a className="core-home-stat" href="/operations/worklog"><strong>{data.linkedProjects}</strong><span>Linked projects</span></a>
        <a className={`core-home-stat${data.awaitingHandoff > 0 ? " is-alert" : ""}`} href="/operations/worklog"><strong>{data.awaitingHandoff}</strong><span>Awaiting handoff</span></a>
        <a className={`core-home-stat${data.overdueTasks > 0 ? " is-alert" : ""}`} href="/operations/worklog"><strong>{data.overdueTasks}</strong><span>Overdue tasks</span></a>
        <a className="core-home-stat" href="/operations/worklog"><strong>{minutesLabel(data.loggedMinutes)}</strong><span>Logged</span></a>
        <a className="core-home-stat" href="/operations/worklog"><strong>{minutesLabel(data.billableMinutes)}</strong><span>Billable</span></a>
        <a className={`core-home-stat${data.pendingOperations > 0 ? " is-alert" : ""}`} href="/operations/worklog"><strong>{data.pendingOperations}</strong><span>Pending operations</span></a>
      </div>
      {data.budgetRiskProjects.length ? (
        <div className="core-stack">
          {data.budgetRiskProjects.map((project) => (
            <a className="core-record-link" key={project.href + project.name} href={project.href}>
              <span><strong>{project.name}</strong><small>Budget {project.budgetUsedPct}% used</small></span>
              <Status value="budget risk" />
            </a>
          ))}
        </div>
      ) : null}
      {data.linkedProjects || data.awaitingHandoff ? (
        <small className="core-worklog-freshness">Source: Worklog snapshots{data.oldestSnapshotAt ? <> · oldest <DateText value={data.oldestSnapshotAt} includeTime /></> : " · not yet refreshed"}</small>
      ) : <EmptyState>No active delivery projects.</EmptyState>}
    </div>
  );
}

function GenerationPanel({ generation }) {
  if (generation.state !== "ok") return <Degraded section={generation} />;
  const data = generation.data;
  const stats = [
    ["Running", data.running, "/generation-jobs", false], ["Awaiting brief approval", data.awaitingInputApproval, "/generation-jobs", data.awaitingInputApproval > 0],
    ["Awaiting review", data.awaitingReview, "/generation-jobs", data.awaitingReview > 0], ["Failed", data.failed, "/generation-jobs", data.failed > 0],
    ["Approved artifacts", data.approvedArtifacts, "/artifacts", false], ["Deployments pending", data.deploymentsPending, "/artifacts", false],
    ["Deployments failed", data.deploymentsFailed + data.deploymentsUnknown, "/artifacts", data.deploymentsFailed + data.deploymentsUnknown > 0],
  ];
  return (
    <div className="core-home-stats">
      {stats.map(([label, value, href, alert]) => (
        <a key={label} className={`core-home-stat${alert ? " is-alert" : ""}`} href={href}><strong>{value}</strong><span>{label}</span></a>
      ))}
    </div>
  );
}

function HealthPanel({ systemHealth }) {
  if (systemHealth.state !== "ok") return <Degraded section={systemHealth} />;
  return (
    <div className="core-stack">
      {systemHealth.data.entries.map((entry) => (
        <div className="core-record-link" key={entry.id}>
          <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
          <Status value={entry.state} />
        </div>
      ))}
    </div>
  );
}

function ActivityPanel({ recentActivity }) {
  if (recentActivity.state !== "ok") return <Degraded section={recentActivity} />;
  const { items } = recentActivity.data;
  if (!items.length) return <EmptyState>No activity recorded yet.</EmptyState>;
  return (
    <div className="core-stack">
      {items.slice(0, 12).map((item) => (
        <a className="core-record-link" key={item.id} href={item.href}>
          <span><strong>{item.summary}</strong><small><DateText value={item.occurredAt} includeTime /></small></span>
          <Status value={item.activityType} />
        </a>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { session, home } = await getStage5PageContext();
  if (!home) {
    return (
      <div className="core-page">
        <PageHeader eyebrow="DGTL" title="Home" description="The operating command center." />
        <Section title="Unavailable"><EmptyState>DATABASE_URL and migrations 001–013 are required for HOME.</EmptyState></Section>
      </div>
    );
  }
  const snapshot = await home.snapshot();
  const firstName = String(session.user?.name || session.email || "").split(/[\s@]/)[0];
  const attentionCount = snapshot.attention.state === "ok" ? snapshot.attention.data.items.length : null;
  return (
    <div className="core-page core-home">
      <div className="core-home-header">
        <PageHeader eyebrow="DGTL" title={`Welcome back${firstName ? `, ${firstName}` : ""}`} description={attentionCount === null ? "Some sections are degraded — showing what is available." : attentionCount === 0 ? "All clear. Nothing needs your attention." : `${attentionCount} item${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} your attention.`} />
        <CommandPalette />
      </div>
      <div className="core-grid">
        <Section title="Needs attention" description="Derived live from canonical state; items disappear when the source is resolved." count={attentionCount ?? undefined} className="is-wide">
          <AttentionList attention={snapshot.attention} />
        </Section>
        <Section title="Today" description="What is actually due.">
          <TodayList today={snapshot.today} />
        </Section>
        <Section title="Approvals" count={snapshot.approvals.state === "ok" ? snapshot.approvals.data.count : undefined}>
          <span id="approvals" aria-hidden />
          <ApprovalsList approvals={snapshot.approvals} />
        </Section>
        <Section title="Pipeline" description="Live canonical opportunities." className="is-wide">
          <PipelinePanel pipeline={snapshot.pipeline} />
        </Section>
        <Section title="Delivery" description="Worklog remains authoritative; figures come from stored snapshots.">
          <DeliveryPanel delivery={snapshot.delivery} />
        </Section>
        <Section title="Outreach">
          <OutreachPanel outreach={snapshot.outreach} />
        </Section>
        <Section title="Generation">
          <GenerationPanel generation={snapshot.generation} />
        </Section>
        <Section title="System status">
          <HealthPanel systemHealth={snapshot.systemHealth} />
        </Section>
        <Section title="Recent activity" className="is-wide">
          <ActivityPanel recentActivity={snapshot.recentActivity} />
        </Section>
        <Section title="Quick actions" className="is-wide">
          <div className="core-actions">
            {snapshot.quickLinks.map((link) => <a key={link.href + link.label} className="core-button" href={link.href}>{link.label}</a>)}
          </div>
        </Section>
      </div>
    </div>
  );
}
