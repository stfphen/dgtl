import { notFound } from "next/navigation";
import {
  DateText,
  DefinitionGrid,
  EmptyState,
  ExternalLinkList,
  PageHeader,
  RecordLink,
  Section,
  Status
} from "../../../../components/core/CoreUi";
import { getCorePageContext } from "../../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }) {
  const { id } = await params;
  const { core } = await getCorePageContext();
  const graph = await core.getCompanyGraph(decodeURIComponent(id));
  if (!graph) notFound();
  const { company, contacts = [], opportunities = [], research = [], assets = [], activities = [], externalLinks = [] } = graph;

  return (
    <div className="core-page">
      <PageHeader eyebrow="Company" title={company.displayName} description={company.researchSummary || "Canonical organization record and its connected commercial activity."} backHref="/companies" backLabel="Companies" />
      <div className="core-grid">
        <Section title="Company details">
          <DefinitionGrid items={[
            { label: "Legal name", value: company.legalName },
            { label: "Domain", value: company.normalizedDomain },
            { label: "Website", value: company.websiteUrl },
            { label: "Industry", value: company.industry || company.category },
            { label: "Location", value: [company.city, company.region, company.country].filter(Boolean).join(", ") },
            { label: "Owner", value: company.ownerUserId },
            { label: "Relationship", value: <Status value={company.relationshipStatus} /> },
            { label: "Source", value: company.source },
            { label: "Updated", value: <DateText value={company.updatedAt} /> },
            { label: "Stable ID", value: company.id, wide: true }
          ]} />
        </Section>
        <Section title="Contacts" count={contacts.length}>
          {contacts.length ? <div className="core-stack">{contacts.map((contact) => <RecordLink key={contact.id} href={`/contacts/${encodeURIComponent(contact.id)}`} title={contact.fullName || contact.email || "Unnamed contact"} meta={[contact.title, contact.email].filter(Boolean).join(" · ")} status={contact.deliverabilityState} />)}</div> : <EmptyState>No contacts associated yet.</EmptyState>}
        </Section>
        <Section title="Opportunities" count={opportunities.length} className="is-wide">
          {opportunities.length ? <div className="core-stack">{opportunities.map((opportunity) => <RecordLink key={opportunity.id} href={`/opportunities/${encodeURIComponent(opportunity.id)}`} title={opportunity.name} meta={opportunity.approachAngle || opportunity.nextAction || "No approach recorded"} status={opportunity.stage} />)}</div> : <EmptyState>No opportunities associated yet.</EmptyState>}
        </Section>
        <Section title="Research" count={research.length}>
          {research.length ? <div className="core-stack">{research.slice(0, 8).map((record) => <div className="core-record-link" key={record.id}><span><strong>{record.signalCategory || record.sourceType}</strong><small>{record.content}</small></span><span className="core-record-link__right"><Status value={record.verificationStatus} /><DateText value={record.capturedAt} /></span></div>)}</div> : <EmptyState>No sourced research recorded.</EmptyState>}
        </Section>
        <Section title="Assets" count={assets.length}>
          {assets.length ? <div className="core-stack">{assets.map((asset) => <div className="core-record-link" key={asset.id}><span><strong>{asset.kind} · {asset.slug || asset.id}</strong><small>{asset.deploymentUrl || asset.sourcePath || "Not deployed"}</small></span><Status value={asset.status} /></div>)}</div> : <EmptyState>No pitch, audit, report, or proposal artifacts registered.</EmptyState>}
        </Section>
        <Section title="Recent activity" count={activities.length}>
          {activities.length ? <div className="core-stack">{activities.slice(0, 10).map((activity) => <div className="core-record-link" key={activity.id}><span><strong>{activity.summary || activity.activityType}</strong><small>{activity.activityType}</small></span><small><DateText value={activity.occurredAt} includeTime /></small></div>)}</div> : <EmptyState>No activity recorded.</EmptyState>}
        </Section>
        <Section title="Linked systems" count={externalLinks.length}>
          <ExternalLinkList links={externalLinks} />
        </Section>
      </div>
    </div>
  );
}
