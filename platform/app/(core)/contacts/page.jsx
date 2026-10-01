import Link from "next/link";
import { PageHeader, Status } from "../../../components/core/CoreUi";
import { getCorePageContext } from "../../../lib/core/server";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }) {
  const { core } = await getCorePageContext();
  const params = await searchParams;
  const query = String(params?.q || "").trim().toLowerCase();
  const contacts = (await core.listContacts()).filter((contact) => {
    if (!query) return true;
    return [contact.fullName, contact.email, contact.companyName, contact.title]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });
  return (
    <div className="core-page">
      <PageHeader title="Contacts" description="People belong to companies and retain deliverability, consent, suppression, ownership, and source state independently." />
      <form className="core-toolbar" action="/contacts" method="get">
        <input className="core-search" name="q" type="search" defaultValue={params?.q || ""} placeholder="Search name, email, company, or title" aria-label="Search contacts" />
        <span className="core-count">{contacts.length}</span>
      </form>
      <div className="core-table-wrap">
        <table className="core-table">
          <thead><tr><th>Contact</th><th>Company</th><th>Deliverability</th><th>Consent</th><th>Source</th></tr></thead>
          <tbody>
            {contacts.length ? contacts.map((contact) => (
              <tr key={contact.id}>
                <td><span className="core-table__primary"><Link href={`/contacts/${encodeURIComponent(contact.id)}`}>{contact.fullName || contact.email || "Unnamed contact"}</Link><small>{contact.title || contact.email || "No role recorded"}</small></span></td>
                <td>{contact.companyName || "—"}</td>
                <td><Status value={contact.deliverabilityState} /></td>
                <td><Status value={contact.consentState} /></td>
                <td>{contact.source || "—"}</td>
              </tr>
            )) : <tr><td colSpan="5">No contacts match this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
