import { notFound } from "next/navigation";
import { DateText, DefinitionGrid, EmptyState, ExternalLinkList, PageHeader, RecordLink, Section, Status } from "../../../../components/core/CoreUi";
import { getCorePageContext } from "../../../../lib/core/server";
import { getStage3PageContext } from "../../../../lib/stage3/server";
import { getStage4PageContext } from "../../../../lib/stage4/server";
import { OpportunityWorklogSection } from "../../../../components/core/WorklogPanels";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const { core } = await getCorePageContext();
  const { automation } = await getStage3PageContext();
  const { worklog } = await getStage4PageContext();
  const graph = await core.getOpportunityGraph(decodeURIComponent(id));
  if (!graph) notFound();
  const {
    opportunity, company, contacts = [], research = [], assets = [], campaigns = [],
    messages = [], activities = [], externalLinks = [], generationJobs = []
  } = graph;

  let worklogView = null; let worklogPreview = null; let worklogMatch = null; let worklogMatchError = "";
  if (worklog) {
    worklogView = await worklog.opportunityDeliveryView(opportunity.id).catch(() => null);
    if (worklogView && !worklogView.link) {
      worklogPreview = await worklog.previewProjectHandoff(opportunity.id).catch(() => null);
      if (query?.worklog === "find") {
        try { worklogMatch = await worklog.matchOpportunityProjects(opportunity.id); }
        catch (error) { worklogMatchError = error?.message || "Worklog is unavailable."; }
      }
    }
  }
  return (
    <div className="core-page">
      <PageHeader eyebrow="Opportunity" title={opportunity.name} description={opportunity.approachAngle || "Operational center for this sales approach."} backHref="/opportunities" backLabel="Opportunities" />
      <p className="core-home-note"><a href={`/chat?q=${encodeURIComponent(`What's the status of ${opportunity.name}?`)}`}>Ask DGTL about this →</a></p>
      {query?.notice ? <p className="core-notice">{query.notice}</p> : null}
      <div className="core-grid">
        {worklog && worklogView ? <OpportunityWorklogSection opportunityId={opportunity.id} view={worklogView} preview={worklogPreview} match={worklogMatch} matchError={worklogMatchError} findHref={`/opportunities/${encodeURIComponent(opportunity.id)}?worklog=find`} assets={assets} /> : null}
        <Section title="Generate sales asset" description="Review this exact context before an authorized agent can claim the job." className="is-wide">
          {automation ? <form className="core-form" action="/api/core/generation-jobs" method="post">
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <div className="core-form__row"><label>Asset type<select name="artifactKind"><option value="pitch">Pitch</option></select></label><label>Workflow<select name="adapterId"><option value="pitch.pages">DGTL Pitch Pages</option><option value="pitch.composer">DGTL Pitch Composer</option></select></label></div>
            <div className="core-form__row"><label>Slug<input name="slug" required placeholder="company-offer" pattern="[a-z0-9][a-z0-9-]{0,60}" /></label><label>Target contact<select name="targetContactId">{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.fullName||contact.email}</option>)}</select></label></div>
            <label>Selected research<div className="core-check-list">{research.length?research.map(record=><label key={record.id}><input type="checkbox" name="researchId" value={record.id} defaultChecked/><span>{record.content} · {record.verificationStatus}</span></label>):<span>No research available.</span>}</div></label>
            <label>Optional instructions<textarea name="instructions" placeholder="Audience nuance or exclusions. These remain strategy, not verified fact." /></label>
            <label>Intended CTA<input name="intendedCta" placeholder="Book a discovery call" /></label>
            <button className="core-button is-primary" type="submit">Create brief for review</button>
          </form> : <EmptyState>DATABASE_URL and migration 012 are required to request generation.</EmptyState>}
        </Section>
        <Section title="Approach">
          <DefinitionGrid items={[
            { label: "Stage", value: <Status value={opportunity.stage} /> },
            { label: "Status", value: <Status value={opportunity.status} /> },
            { label: "Approach angle", value: opportunity.approachAngle, wide: true },
            { label: "Offer", value: opportunity.offer },
            { label: "Entry offer", value: opportunity.entryOffer },
            { label: "Next action", value: opportunity.nextAction, wide: true },
            { label: "Next action date", value: <DateText value={opportunity.nextActionAt} /> },
            { label: "Estimated value", value: opportunity.estimatedValue ? `${opportunity.currency || "CAD"} ${opportunity.estimatedValue}` : "" },
            { label: "Owner", value: opportunity.ownerUserId },
            { label: "Source", value: opportunity.source },
            { label: "Stable ID", value: opportunity.id, wide: true }
          ]} />
        </Section>
        <Section title="Company and stakeholders">
          {company ? <RecordLink href={`/companies/${encodeURIComponent(company.id)}`} title={company.displayName} meta={company.normalizedDomain || company.industry} status={company.relationshipStatus} /> : <EmptyState>Company unavailable.</EmptyState>}
          {contacts.map((contact) => <RecordLink key={contact.id} href={`/contacts/${encodeURIComponent(contact.id)}`} title={contact.fullName || contact.email || "Unnamed contact"} meta={[contact.title, contact.email].filter(Boolean).join(" · ")} status={contact.id === opportunity.primaryContactId ? "primary" : contact.role} />)}
        </Section>
        <Section title="Research" count={research.length} className="is-wide">
          {research.length ? <div className="core-stack">{research.map((record) => <div className="core-record-link" key={record.id}><span><strong>{record.signalCategory || record.sourceType}</strong><small>{record.content}</small></span><span className="core-record-link__right"><Status value={record.verificationStatus} /><DateText value={record.capturedAt} /></span></div>)}</div> : <EmptyState>No provenance-bearing research recorded.</EmptyState>}
        </Section>
        <Section title="Assets" description="Registry entries; pitch/audit/report systems remain independently deployable." count={assets.length}>
          {assets.length ? <div className="core-stack">{assets.map((asset) => <RecordLink key={asset.id} href={`/artifacts/${asset.id}`} title={`${asset.kind} · ${asset.slug || asset.id} v${asset.versionNumber||asset.version}`} meta={asset.deploymentUrl || asset.sourcePath || "Not deployed"} status={asset.status} />)}</div> : <EmptyState>No artifacts registered.</EmptyState>}
        </Section>
        <Section title="Generation jobs" count={generationJobs.length}>
          {generationJobs.length ? <div className="core-stack">{generationJobs.map((job) => <RecordLink key={job.id} href={`/generation-jobs/${job.id}`} title={job.requestedSkill || job.requestedTool} meta={job.id} status={job.status} />)}</div> : <EmptyState>No generation jobs requested.</EmptyState>}
        </Section>
        <Section title="Campaigns and messages" count={campaigns.length + messages.length}>
          {campaigns.map((campaign) => <div className="core-record-link" key={campaign.id}><span><strong>{campaign.name}</strong><small>{campaign.kind}</small></span><Status value={campaign.status} /></div>)}
          {messages.slice(0, 8).map((message) => <div className="core-record-link" key={message.id}><span><strong>{message.subject || `${message.channel} message`}</strong><small>{message.direction} · <DateText value={message.sentAt || message.scheduledAt} /></small></span><Status value={message.status} /></div>)}
          {!campaigns.length && !messages.length ? <EmptyState>No campaign or message references.</EmptyState> : null}
        </Section>
        <Section title="Recent activity" count={activities.length}>
          {activities.length ? <div className="core-stack">{activities.slice(0, 12).map((activity) => <div className="core-record-link" key={activity.id}><span><strong>{activity.summary || activity.activityType}</strong><small><DateText value={activity.occurredAt} includeTime /></small></span><Status value={activity.activityType} /></div>)}</div> : <EmptyState>No activity recorded.</EmptyState>}
        </Section>
        <Section title="Linked systems" description="References only; Worklog remains authoritative for task and time data." count={externalLinks.length} className="is-wide"><ExternalLinkList links={externalLinks} /></Section>
      </div>
    </div>
  );
}
