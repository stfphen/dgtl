import { notFound } from "next/navigation";
import { DateText, DefinitionGrid, EmptyState, ExternalLinkList, PageHeader, RecordLink, Section, Status } from "../../../../components/core/CoreUi";
import { getCorePageContext } from "../../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }) {
  const { id } = await params;
  const { core } = await getCorePageContext();
  const graph = await core.getOpportunityGraph(decodeURIComponent(id));
  if (!graph) notFound();
  const {
    opportunity, company, contacts = [], research = [], assets = [], campaigns = [],
    messages = [], activities = [], externalLinks = [], generationJobs = []
  } = graph;
  return (
    <div className="core-page">
      <PageHeader eyebrow="Opportunity" title={opportunity.name} description={opportunity.approachAngle || "Operational center for this sales approach."} backHref="/opportunities" backLabel="Opportunities" />
      <div className="core-grid">
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
          {assets.length ? <div className="core-stack">{assets.map((asset) => <div className="core-record-link" key={asset.id}><span><strong>{asset.kind} · {asset.slug || asset.id}</strong><small>{asset.deploymentUrl || asset.sourcePath || "Not deployed"}</small></span><Status value={asset.status} /></div>)}</div> : <EmptyState>No artifacts registered.</EmptyState>}
        </Section>
        <Section title="Generation jobs" count={generationJobs.length}>
          {generationJobs.length ? <div className="core-stack">{generationJobs.map((job) => <div className="core-record-link" key={job.id}><span><strong>{job.requestedSkill || job.requestedTool}</strong><small>{job.id}</small></span><Status value={job.status} /></div>)}</div> : <EmptyState>No generation jobs requested.</EmptyState>}
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
