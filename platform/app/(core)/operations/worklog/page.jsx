import { DateText, DefinitionGrid, EmptyState, PageHeader, RecordLink, Section, Status } from "../../../../components/core/CoreUi";
import { WorklogOperationsList } from "../../../../components/core/WorklogPanels";
import { getStage4PageContext } from "../../../../lib/stage4/server";

export const dynamic = "force-dynamic";

export default async function WorklogOperationsPage({ searchParams }) {
  const query = await searchParams;
  const { worklog } = await getStage4PageContext();
  if (!worklog) {
    return (
      <div className="core-page">
        <PageHeader eyebrow="Operations" title="Worklog" description="Delivery bridge between the commercial graph and DGTL Worklog." />
        <Section title="Unavailable"><EmptyState>DATABASE_URL and migration 013 are required for the Worklog bridge.</EmptyState></Section>
      </div>
    );
  }
  const overview = await worklog.operationsOverview();
  const { status, pendingOperations, recentOperations, projectLinks, clientLinks, staleLinks, overdueProjects, unlinkedDeliveryReady, worklogExceptions } = overview;
  const health = status.health || {};
  return (
    <div className="core-page">
      <PageHeader eyebrow="Operations" title="Worklog" description="Connection health, delivery handoff, and execution status. Worklog stays authoritative for all execution data." />
      {query?.notice ? <p className="core-notice">{query.notice}</p> : null}
      <div className="core-grid">
        <Section title="Connection" description="Server-configured connector; credentials never reach the browser.">
          <DefinitionGrid items={[
            { label: "State", value: <Status value={health.state} /> },
            { label: "Endpoint", value: status.connector.baseUrl || "Not configured" },
            { label: "Identity", value: health.identity ? `${health.identity.email} (${health.identity.role})` : "" },
            { label: "Worklog timezone", value: health.timezone },
            { label: "Checked", value: <DateText value={health.checkedAt} includeTime /> },
            { label: "Last success", value: <DateText value={status.lastSuccessAt} includeTime /> },
            { label: "Last error", value: status.lastErrorSummary ? `${status.lastErrorSummary}` : "", wide: true },
            { label: "Consequential actions", value: status.connector.actions.join(", "), wide: true }
          ]} />
          {health.state === "auth_failed" ? <p className="core-notice">Worklog rejected the integration credentials. Update CORE_WORKLOG_EMAIL / CORE_WORKLOG_PASSWORD; sessions are revoked when the account password changes.</p> : null}
          {health.state === "unconfigured" ? <p className="core-notice">Set CORE_WORKLOG_BASE_URL, CORE_WORKLOG_EMAIL, CORE_WORKLOG_PASSWORD, and CORE_WORKLOG_TEAM_ID to enable the bridge.</p> : null}
          {health.state === "team_not_enabled" ? <p className="core-notice">The connector is configured for a different team (CORE_WORKLOG_TEAM_ID).</p> : null}
        </Section>
        <Section title="Delivery handoff queue" description="Won or delivery-ready opportunities without a linked Worklog project." count={unlinkedDeliveryReady.length}>
          {unlinkedDeliveryReady.length ? <div className="core-stack">{unlinkedDeliveryReady.map((opportunity) => <RecordLink key={opportunity.id} href={`/opportunities/${encodeURIComponent(opportunity.id)}`} title={opportunity.name} meta={opportunity.nextAction || opportunity.offer || ""} status={opportunity.stage} />)}</div> : <EmptyState>Every delivery-ready opportunity is linked.</EmptyState>}
        </Section>
        <Section title="Pending operations" description="Draft, approved, executing, and quarantined Worklog operations." count={pendingOperations.length} className="is-wide">
          {pendingOperations.length ? <WorklogOperationsList operations={pendingOperations} /> : <EmptyState>No pending Worklog operations.</EmptyState>}
        </Section>
        <Section title="Linked projects" count={projectLinks.length}>
          {projectLinks.length ? <div className="core-stack">{projectLinks.map((link) => <RecordLink key={link.id} href={`/opportunities/${encodeURIComponent(link.localEntityId)}`} title={link.metadata?.name || `Project ${link.externalId}`} meta={`Worklog id ${link.externalId}${link.snapshotAt ? "" : " · never refreshed"}${link.statusSnapshot?.overdueTasks ? ` · ${link.statusSnapshot.overdueTasks} overdue` : ""}`} status={link.lastVerifiedState === "missing" ? "broken" : link.statusSnapshot?.status || "linked"} />)}</div> : <EmptyState>No opportunities are linked to Worklog projects.</EmptyState>}
        </Section>
        <Section title="Linked clients" count={clientLinks.length}>
          {clientLinks.length ? <div className="core-stack">{clientLinks.map((link) => <RecordLink key={link.id} href={`/companies/${encodeURIComponent(link.localEntityId)}`} title={link.metadata?.name || `Client ${link.externalId}`} meta={`Worklog id ${link.externalId} · verified ${link.lastVerifiedAt ? "" : "never"}`} status={link.lastVerifiedState === "missing" ? "broken" : "linked"} />)}</div> : <EmptyState>No companies are linked to Worklog clients.</EmptyState>}
        </Section>
        <Section title="Execution attention" description="Overdue work and broken links surfaced from the last snapshots." count={overdueProjects.length + staleLinks.length}>
          {overdueProjects.map((link) => <RecordLink key={`overdue-${link.id}`} href={`/opportunities/${encodeURIComponent(link.localEntityId)}`} title={`${link.metadata?.name || link.externalId} · ${link.statusSnapshot?.overdueTasks} overdue task${link.statusSnapshot?.overdueTasks === 1 ? "" : "s"}`} meta={`Snapshot ${link.snapshotAt || "never"}`} status="overdue" />)}
          {staleLinks.map((link) => <RecordLink key={`stale-${link.id}`} href={link.localEntityType === "company" ? `/companies/${encodeURIComponent(link.localEntityId)}` : `/opportunities/${encodeURIComponent(link.localEntityId)}`} title={`${link.metadata?.name || link.externalId} no longer exists in Worklog`} meta={`${link.localEntityType} link · repair or unlink`} status="broken" />)}
          {!overdueProjects.length && !staleLinks.length ? <EmptyState>Nothing needs attention.</EmptyState> : null}
        </Section>
        <Section title="Worklog exceptions" description="Open integration exceptions; resolve them on the exception desk." count={worklogExceptions.length}>
          {worklogExceptions.length ? <div className="core-stack">{worklogExceptions.map((exception) => <RecordLink key={exception.id} href="/operations/exceptions" title={exception.summary} meta={`${exception.sourceEntityType} · ${exception.sourceEntityId}`} status={exception.exceptionType} />)}</div> : <EmptyState>No open Worklog exceptions.</EmptyState>}
        </Section>
        <Section title="Recent operations" count={recentOperations.length} className="is-wide">
          {recentOperations.length ? <div className="core-stack">{recentOperations.map((operation) => <div className="core-record-link" key={operation.id}><span><strong>{operation.action}</strong><small>{operation.id} · {operation.localEntityType} {operation.localEntityId} · <DateText value={operation.createdAt} includeTime /></small></span><Status value={operation.status} /></div>)}</div> : <EmptyState>No Worklog operations yet.</EmptyState>}
        </Section>
      </div>
    </div>
  );
}
