import Link from "next/link";
import { PageHeader, Status } from "../../../components/core/CoreUi";
import { getCorePageContext } from "../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({ searchParams }) {
  const { core } = await getCorePageContext();
  const params = await searchParams;
  const query = String(params?.q || "").trim().toLowerCase();
  const companies = (await core.listCompanies()).filter((company) => {
    if (!query) return true;
    return [company.displayName, company.normalizedDomain, company.industry, company.city]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

  return (
    <div className="core-page">
      <PageHeader title="Companies" description="Canonical organizations and accounts. Legacy leads and target accounts remain visible through compatibility records until migrated." />
      <form className="core-toolbar" action="/companies" method="get">
        <input className="core-search" name="q" type="search" defaultValue={params?.q || ""} placeholder="Search company, domain, industry, or city" aria-label="Search companies" />
        <span className="core-count">{companies.length}</span>
      </form>
      <div className="core-table-wrap">
        <table className="core-table">
          <thead><tr><th>Company</th><th>Relationship</th><th>Contacts</th><th>Opportunities</th><th>Source</th></tr></thead>
          <tbody>
            {companies.length ? companies.map((company) => (
              <tr key={company.id}>
                <td><span className="core-table__primary"><Link href={`/companies/${encodeURIComponent(company.id)}`}>{company.displayName}</Link><small>{company.normalizedDomain || company.city || "No domain recorded"}</small></span></td>
                <td><Status value={company.relationshipStatus} /></td>
                <td>{company.contactCount ?? 0}</td>
                <td>{company.opportunityCount ?? 0}</td>
                <td>{company.source || "—"}</td>
              </tr>
            )) : <tr><td colSpan="5">No companies match this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
