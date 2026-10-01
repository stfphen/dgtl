import { notFound } from "next/navigation";
import { DateText, DefinitionGrid, EmptyState, ExternalLinkList, PageHeader, RecordLink, Section, Status } from "../../../../components/core/CoreUi";
import { getCorePageContext } from "../../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }) {
  const { id } = await params;
  const { core } = await getCorePageContext();
  const graph = await core.getContactGraph(decodeURIComponent(id));
  if (!graph) notFound();
  const { contact, company, opportunities = [], activities = [], externalLinks = [] } = graph;
  return (
    <div className="core-page">
      <PageHeader eyebrow="Contact" title={contact.fullName || contact.email || "Unnamed contact"} description={[contact.title, company?.displayName].filter(Boolean).join(" at ")} backHref="/contacts" backLabel="Contacts" />
      <div className="core-grid">
        <Section title="Contact details">
          <DefinitionGrid items={[
            { label: "Email", value: contact.email },
            { label: "Phone", value: contact.phone },
            { label: "Title", value: contact.title },
            { label: "Role", value: contact.role },
            { label: "Deliverability", value: <Status value={contact.deliverabilityState} /> },
            { label: "Consent", value: <Status value={contact.consentState} /> },
            { label: "Suppression", value: <Status value={contact.suppressionState} /> },
            { label: "Source", value: contact.source },
            { label: "Updated", value: <DateText value={contact.updatedAt} /> },
            { label: "Stable ID", value: contact.id, wide: true }
          ]} />
        </Section>
        <Section title="Company">
          {company ? <RecordLink href={`/companies/${encodeURIComponent(company.id)}`} title={company.displayName} meta={company.normalizedDomain || company.industry} status={company.relationshipStatus} /> : <EmptyState>No company associated.</EmptyState>}
        </Section>
        <Section title="Opportunities" count={opportunities.length}>
          {opportunities.length ? <div className="core-stack">{opportunities.map((opportunity) => <RecordLink key={opportunity.id} href={`/opportunities/${encodeURIComponent(opportunity.id)}`} title={opportunity.name} meta={opportunity.approachAngle || opportunity.nextAction} status={opportunity.stage} />)}</div> : <EmptyState>No opportunities associated.</EmptyState>}
        </Section>
        <Section title="Recent activity" count={activities.length}>
          {activities.length ? <div className="core-stack">{activities.slice(0, 10).map((activity) => <div className="core-record-link" key={activity.id}><span><strong>{activity.summary || activity.activityType}</strong><small><DateText value={activity.occurredAt} includeTime /></small></span><Status value={activity.activityType} /></div>)}</div> : <EmptyState>No contact activity recorded.</EmptyState>}
        </Section>
        <Section title="Linked systems" count={externalLinks.length} className="is-wide"><ExternalLinkList links={externalLinks} /></Section>
      </div>
    </div>
  );
}
