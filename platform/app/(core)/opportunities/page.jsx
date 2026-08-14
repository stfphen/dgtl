import Link from "next/link";
import { DateText, PageHeader, Status } from "../../../components/core/CoreUi";
import { getCorePageContext } from "../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({ searchParams }) {
  const { core } = await getCorePageContext();
  const params = await searchParams;
  const query = String(params?.q || "").trim().toLowerCase();
  const opportunities = (await core.listOpportunities()).filter((opportunity) => {
    if (!query) return true;
    return [opportunity.name, opportunity.companyName, opportunity.approachAngle, opportunity.offer, opportunity.stage]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });
  return (
    <div className="core-page">
      <PageHeader title="Opportunities" description="The operational center of each sales approach: stakeholders, research, angle, offer, campaigns, artifacts, next actions, and linked systems." />
      <form className="core-toolbar" action="/opportunities" method="get">
        <input className="core-search" name="q" type="search" defaultValue={params?.q || ""} placeholder="Search opportunity, company, angle, offer, or stage" aria-label="Search opportunities" />
        <span className="core-count">{opportunities.length}</span>
      </form>
      <div className="core-table-wrap">
        <table className="core-table">
          <thead><tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Next action</th><th>Owner</th></tr></thead>
          <tbody>
            {opportunities.length ? opportunities.map((opportunity) => (
              <tr key={opportunity.id}>
                <td><span className="core-table__primary"><Link href={`/opportunities/${encodeURIComponent(opportunity.id)}`}>{opportunity.name}</Link><small>{opportunity.approachAngle || opportunity.offer || "No approach recorded"}</small></span></td>
                <td>{opportunity.companyName || "—"}</td>
                <td><Status value={opportunity.stage} /></td>
                <td><span className="core-table__primary"><span>{opportunity.nextAction || "—"}</span><small><DateText value={opportunity.nextActionAt} /></small></span></td>
                <td>{opportunity.ownerUserId || "—"}</td>
              </tr>
            )) : <tr><td colSpan="5">No opportunities match this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
