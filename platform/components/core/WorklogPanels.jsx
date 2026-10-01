import { DateText, DefinitionGrid, EmptyState, Section, Status } from "./CoreUi";

/**
 * Server-rendered Worklog panels. They read Core-side state (links, snapshots,
 * operations) so page renders never call Worklog; live candidate searches and
 * status refreshes are explicit user actions. Every figure shown from a
 * snapshot names Worklog as its source and carries its fetch time.
 */

const minutesLabel = (minutes) => {
  const value = Number(minutes || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
};

function Freshness({ at }) {
  if (!at) return null;
  return <small className="core-worklog-freshness">Source: Worklog · Last updated <DateText value={at} includeTime /></small>;
}

export function WorklogHealthBadge({ health }) {
  if (!health) return <Status value="unknown" />;
  return <Status value={health.state} />;
}

function OperationCard({ operation }) {
  const payload = operation.payload || {};
  return (
    <div className="core-record-link" key={operation.id}>
      <span>
        <strong>{operation.action}{payload.name ? ` · ${payload.name}` : ""}{Array.isArray(payload.items) ? ` · ${payload.items.length} task${payload.items.length === 1 ? "" : "s"}` : ""}</strong>
        <small>{operation.id} · requested <DateText value={operation.requestedAt} includeTime />{operation.approvedAt ? <> · approved <DateText value={operation.approvedAt} includeTime /></> : null}</small>
        {operation.errorMetadata?.message ? <small>{operation.errorMetadata.message}</small> : null}
        <details><summary>Exact payload</summary><div className="core-json">{JSON.stringify(payload, null, 2)}</div></details>
      </span>
      <span className="core-record-link__right">
        <Status value={operation.status} />
        {operation.status === "draft" ? <>
          <form action={`/api/core/worklog/operations/${operation.id}/approve`} method="post"><button className="core-button is-primary" type="submit">Approve exact payload</button></form>
          <form action={`/api/core/worklog/operations/${operation.id}/cancel`} method="post"><button className="core-button" type="submit">Cancel</button></form>
        </> : null}
        {operation.status === "approved" ? <>
          <form action={`/api/core/worklog/operations/${operation.id}/execute`} method="post"><button className="core-button is-primary" type="submit">Execute in Worklog</button></form>
          <form action={`/api/core/worklog/operations/${operation.id}/cancel`} method="post"><button className="core-button" type="submit">Cancel</button></form>
        </> : null}
        {operation.status === "outcome_unknown" ? <form action={`/api/core/worklog/operations/${operation.id}/reconcile`} method="post"><button className="core-button is-primary" type="submit">Reconcile against Worklog</button></form> : null}
        {operation.status === "failed" ? <form action={`/api/core/worklog/operations/${operation.id}/retry`} method="post"><button className="core-button" type="submit">Re-approve for retry</button></form> : null}
      </span>
    </div>
  );
}

export function WorklogOperationsList({ operations = [] }) {
  if (!operations.length) return null;
  return <div className="core-stack">{operations.map((operation) => <OperationCard key={operation.id} operation={operation} />)}</div>;
}

function UnlinkForm({ link }) {
  return (
    <form className="core-form" action={`/api/core/worklog/links/${link.id}/unlink`} method="post">
      <div className="core-form__row">
        <label>Type "unlink" to confirm<input name="confirm" placeholder="unlink" autoComplete="off" /></label>
        <label>Reason<input name="reason" placeholder="Why this link is being retired" /></label>
      </div>
      <button className="core-button" type="submit">Unlink (keeps the Worklog record)</button>
    </form>
  );
}

export function CompanyWorklogSection({ companyId, link, match, matchError, findHref }) {
  return (
    <Section title="Worklog" description="Worklog owns clients, projects, tasks, and time. Core stores the link only." className="is-wide">
      {link ? (
        <div className="core-stack">
          <div className="core-record-link">
            <span>
              <strong>Client · {link.metadata?.name || link.externalId}</strong>
              <small>Worklog client id {link.externalId} · linked <DateText value={link.linkedAt || link.createdAt} /></small>
              <Freshness at={link.lastVerifiedAt} />
            </span>
            <span className="core-record-link__right">
              <Status value={link.lastVerifiedState === "missing" ? "broken" : link.syncState} />
            </span>
          </div>
          {link.lastVerifiedState === "missing" ? <p className="core-notice">This Worklog client no longer exists (Worklog prunes clients with no projects). Repair the link with a replacement client id, or unlink.</p> : null}
          {link.lastVerifiedState === "missing" ? (
            <form className="core-form" action={`/api/core/worklog/links/${link.id}/repair`} method="post">
              <div className="core-form__row"><label>Replacement Worklog client id<input name="externalId" required /></label></div>
              <button className="core-button" type="submit">Repair link</button>
            </form>
          ) : null}
          <UnlinkForm link={link} />
        </div>
      ) : (
        <div className="core-stack">
          <EmptyState>No Worklog client linked. A prospect only becomes a Worklog client through an explicit link or an approved delivery-project handoff.</EmptyState>
          <a className="core-button" href={findHref}>Find existing Worklog client</a>
          {matchError ? <p className="core-notice">Worklog is unavailable: {matchError}</p> : null}
          {match ? (
            <div className="core-stack">
              <p className="core-summary">Match state: <Status value={match.state} />{match.state === "multiple_candidates" ? " — choose explicitly; Core never guesses between candidates." : ""}</p>
              {match.candidates.length ? match.candidates.map((candidate) => (
                <div className="core-record-link" key={candidate.id}>
                  <span><strong>{candidate.name}</strong><small>{candidate.projects} project{candidate.projects === 1 ? "" : "s"} · {candidate.matchKind} match · Worklog id {candidate.id}</small></span>
                  <form action={`/api/core/companies/${encodeURIComponent(companyId)}/worklog/link`} method="post">
                    <input type="hidden" name="clientId" value={candidate.id} />
                    <button className="core-button is-primary" type="submit">Link this client</button>
                  </form>
                </div>
              )) : <EmptyState>No Worklog client matches this company name. The client will be created with the first approved delivery project.</EmptyState>}
              <Freshness at={match.fetchedAt} />
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function DeliverySnapshot({ snapshot, snapshotAt }) {
  if (!snapshot) return <EmptyState>No status snapshot yet. Refresh to read the current Worklog state.</EmptyState>;
  return (
    <div className="core-stack">
      <DefinitionGrid items={[
        { label: "Project", value: `${snapshot.name}${snapshot.code ? ` · ${snapshot.code}` : ""}` },
        { label: "Client", value: snapshot.clientName },
        { label: "State", value: <Status value={snapshot.status} /> },
        { label: "Open tasks", value: String(snapshot.openTasks ?? "—") },
        { label: "Overdue", value: String(snapshot.overdueTasks ?? "—") },
        { label: "Completed", value: String(snapshot.doneTasks ?? "—") },
        { label: "Logged time", value: minutesLabel(snapshot.loggedMinutes) },
        { label: "Billable time", value: minutesLabel(snapshot.billableMinutes) },
        { label: "Budget", value: snapshot.budgetMinutes ? `${minutesLabel(snapshot.budgetMinutes)} · ${snapshot.budgetUsedPct}% used` : "No budget set" }
      ]} />
      <Freshness at={snapshotAt || snapshot.fetchedAt} />
    </div>
  );
}

export function OpportunityWorklogSection({ opportunityId, view, preview, match, matchError, findHref, assets = [] }) {
  const { link, operations = [], snapshot, snapshotAt } = view || {};
  const pending = operations.filter((operation) => ["draft", "approved", "executing", "outcome_unknown", "failed"].includes(operation.status));
  const approvedArtifacts = assets.filter((asset) => ["approved", "deployed"].includes(asset.status));
  return (
    <Section title="Worklog delivery" description="Worklog remains the execution authority; Core requests, approves, and reads through." className="is-wide">
      <div className="core-stack">
        {link ? (
          <>
            <div className="core-record-link">
              <span>
                <strong>Project · {link.metadata?.name || link.externalId}</strong>
                <small>Worklog project id {link.externalId}{link.metadata?.clientName ? ` · client ${link.metadata.clientName}` : ""} · linked <DateText value={link.linkedAt || link.createdAt} /></small>
              </span>
              <span className="core-record-link__right">
                <Status value={link.lastVerifiedState === "missing" ? "broken" : snapshot?.status || link.syncState} />
                <form action={`/api/core/opportunities/${encodeURIComponent(opportunityId)}/worklog/refresh`} method="post"><button className="core-button" type="submit">Refresh status</button></form>
              </span>
            </div>
            {link.lastVerifiedState === "missing" ? (
              <>
                <p className="core-notice">The linked Worklog project no longer exists. Repair with a replacement project id, or unlink.</p>
                <form className="core-form" action={`/api/core/worklog/links/${link.id}/repair`} method="post">
                  <div className="core-form__row"><label>Replacement Worklog project id<input name="externalId" required /></label></div>
                  <button className="core-button" type="submit">Repair link</button>
                </form>
              </>
            ) : <DeliverySnapshot snapshot={snapshot} snapshotAt={snapshotAt} />}
            <details>
              <summary>Hand off delivery tasks</summary>
              <form className="core-form" action={`/api/core/opportunities/${encodeURIComponent(opportunityId)}/worklog/tasks`} method="post">
                <div className="core-form__row">
                  <label>Title<input name="title" required maxLength={200} placeholder="Kickoff call with client" /></label>
                  <label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
                </div>
                <div className="core-form__row">
                  <label>Estimate (minutes)<input name="estimateMinutes" type="number" min="0" /></label>
                  <label>Due date<input name="dueDate" type="date" /></label>
                </div>
                <label>Notes<textarea name="notes" maxLength={3800} placeholder="Context the delivery team needs" /></label>
                {approvedArtifacts.length ? <label>Attach approved artifact reference<select name="artifactId" defaultValue=""><option value="">None</option>{approvedArtifacts.map((asset) => <option key={asset.id} value={asset.id}>{asset.kind} · {asset.slug} v{asset.versionNumber || asset.version}</option>)}</select></label> : null}
                <p className="core-summary">Tasks are created unassigned unless assigned later in Worklog. This drafts an operation for separate approval.</p>
                <button className="core-button is-primary" type="submit">Draft task handoff for approval</button>
              </form>
            </details>
            <UnlinkForm link={link} />
          </>
        ) : (
          <>
            <EmptyState>Not handed off. Create the delivery project through an approved operation, or link an existing Worklog project.</EmptyState>
            {preview ? (
              <details open={false}>
                <summary>Create delivery project</summary>
                <form className="core-form" action={`/api/core/opportunities/${encodeURIComponent(opportunityId)}/worklog/handoff`} method="post">
                  <div className="core-form__row">
                    <label>Project name<input name="name" required maxLength={120} defaultValue={preview.payload.name} /></label>
                    <label>Worklog client<input name="clientName" maxLength={120} defaultValue={preview.payload.clientName} readOnly={Boolean(preview.companyLink)} /></label>
                  </div>
                  <div className="core-form__row">
                    <label>Billable<select name="billable" defaultValue="true"><option value="true">Billable</option><option value="false">Non-billable</option></select></label>
                    <label>Budget (minutes)<input name="budgetMinutes" type="number" min="0" /></label>
                  </div>
                  <p className="core-summary">Project code {preview.payload.code} is assigned deterministically for duplicate-safe recovery.{preview.willCreateClient ? ` Worklog client "${preview.payload.clientName}" does not exist yet and will be created with this project.` : ""}</p>
                  <button className="core-button is-primary" type="submit">Draft handoff for approval</button>
                </form>
              </details>
            ) : null}
            <a className="core-button" href={findHref}>Link existing Worklog project</a>
            {matchError ? <p className="core-notice">Worklog is unavailable: {matchError}</p> : null}
            {match ? (
              <div className="core-stack">
                <p className="core-summary">Match state: <Status value={match.state} />{match.state === "multiple_candidates" ? " — choose explicitly; Core never links on a guessed name." : ""}</p>
                {match.candidates.length ? match.candidates.map((candidate) => (
                  <div className="core-record-link" key={candidate.id}>
                    <span><strong>{candidate.name}</strong><small>{candidate.clientName ? `Client ${candidate.clientName} · ` : ""}{candidate.matchKind} match · Worklog id {candidate.id} · {minutesLabel(candidate.loggedMinutes)} logged</small></span>
                    <form action={`/api/core/opportunities/${encodeURIComponent(opportunityId)}/worklog/link`} method="post">
                      <input type="hidden" name="projectId" value={candidate.id} />
                      <button className="core-button is-primary" type="submit">Link this project</button>
                    </form>
                  </div>
                )) : <EmptyState>No matching Worklog project.</EmptyState>}
                <Freshness at={match.fetchedAt} />
              </div>
            ) : null}
          </>
        )}
        {pending.length ? <><p className="core-summary">Worklog operations</p><WorklogOperationsList operations={pending} /></> : null}
      </div>
    </Section>
  );
}
