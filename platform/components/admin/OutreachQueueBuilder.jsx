"use client";

import { useMemo, useState } from "react";
import {
  findSuppressionForLead,
  isAlreadyContacted,
  renderOutreachTemplate
} from "../../lib/outreachSequence";

export default function OutreachQueueBuilder({
  leads = [],
  tenants = [],
  templates = [],
  campaigns = [],
  suppressions = []
}) {
  const activeTemplates = templates.filter((template) => template.isActive !== false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [templateId, setTemplateId] = useState(activeTemplates[0]?.id || "");
  const [campaignId, setCampaignId] = useState("");
  const [queueStatus, setQueueStatus] = useState("queued");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [includeContacted, setIncludeContacted] = useState(false);

  const tenant = tenants.find((item) => item.id === tenantId) || tenants[0] || {};
  const template = activeTemplates.find((item) => item.id === templateId) || activeTemplates[0];
  const selectedLeads = leads.filter((lead) => selectedIds.includes(lead.id));
  const selectedLeadSet = new Set(selectedIds);

  const previewRows = useMemo(() => {
    if (!template) return [];
    return selectedLeads.map((lead) => {
      const suppression = findSuppressionForLead(lead, suppressions);
      const alreadyContacted = isAlreadyContacted(lead);
      const skippedReason = !lead.email
        ? "missing email"
        : suppression
          ? `suppressed: ${suppression.reason}`
          : !includeContacted && alreadyContacted
            ? "already contacted"
            : "";
      return {
        lead,
        skippedReason,
        rendered: renderOutreachTemplate(template, { lead, tenant, senderName })
      };
    });
  }, [selectedLeads, template, tenant, senderName, suppressions, includeContacted]);

  const eligibleCount = previewRows.filter((row) => !row.skippedReason).length;

  function toggleLead(leadId) {
    setSelectedIds((current) =>
      current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]
    );
  }

  function selectAllEligible() {
    const ids = leads
      .filter((lead) => lead.email && !findSuppressionForLead(lead, suppressions) && (includeContacted || !isAlreadyContacted(lead)))
      .map((lead) => lead.id);
    setSelectedIds(ids);
  }

  return (
    <div className="outreach-builder">
      <form action="/api/admin/outreach/queue" method="post" className="outreach-builder__form">
        {selectedIds.map((leadId) => (
          <input key={leadId} type="hidden" name="leadId" value={leadId} />
        ))}
        <label>
          Tenant
          <select name="tenantId" value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            {tenants.map((item) => (
              <option key={item.id} value={item.id}>{item.brand?.name || item.slug}</option>
            ))}
          </select>
        </label>
        <label>
          Template
          <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {activeTemplates.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.system ? " (starter)" : ""}</option>
            ))}
          </select>
        </label>
        <label>
          Campaign
          <select name="campaignId" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
            <option value="">No campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
        </label>
        <label>
          Sender Email
          <input name="senderEmail" type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} placeholder="you@approved-domain.com" />
        </label>
        <label>
          Sender Name
          <input name="senderName" value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder="Your name" />
        </label>
        <label>
          Schedule
          <input name="scheduledFor" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
        </label>
        <label>
          Queue Status
          <select name="queueStatus" value={queueStatus} onChange={(event) => setQueueStatus(event.target.value)}>
            <option value="queued">Queued</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label className="admin-check">
          <input name="includeContacted" type="checkbox" checked={includeContacted} onChange={(event) => setIncludeContacted(event.target.checked)} />
          Include already contacted leads
        </label>

        <div className="outreach-builder__actions">
          <button className="button button--secondary" type="button" onClick={selectAllEligible}>Select Eligible</button>
          <button className="button button--secondary" type="button" onClick={() => setSelectedIds([])}>Clear</button>
          <button className="button button--primary" type="submit" disabled={!eligibleCount || !template || !senderEmail}>
            Queue {eligibleCount} Item{eligibleCount === 1 ? "" : "s"}
          </button>
        </div>
      </form>

      <div className="outreach-builder__leads">
        <h3>Select Leads</h3>
        <div className="outreach-lead-list">
          {leads.slice(0, 100).map((lead) => {
            const suppression = findSuppressionForLead(lead, suppressions);
            return (
              <label key={lead.id} className="outreach-lead-row">
                <input
                  type="checkbox"
                  checked={selectedLeadSet.has(lead.id)}
                  onChange={() => toggleLead(lead.id)}
                />
                <span>
                  <strong>{lead.businessName || lead.business || "Unknown business"}</strong>
                  <small>{lead.email || "No email"} | {lead.city || "No city"} | {lead.category || "No category"}</small>
                </span>
                {suppression ? <em>Suppressed</em> : null}
              </label>
            );
          })}
          {!leads.length ? (
            <div className="ui-empty">
              <div className="ui-empty__icon" aria-hidden="true">○</div>
              <div className="ui-empty__title">No matching leads</div>
              <p>Adjust the pipeline filters to surface leads here.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="outreach-builder__preview">
        <h3>Preview</h3>
        {previewRows.slice(0, 5).map((row) => (
          <article key={row.lead.id} className={row.skippedReason ? "outreach-preview outreach-preview--skipped" : "outreach-preview"}>
            <div>
              <strong>{row.lead.businessName || row.lead.business || "Unknown business"}</strong>
              {row.skippedReason ? <span>{row.skippedReason}</span> : <span>{row.lead.email}</span>}
            </div>
            <p><b>{row.rendered.subject}</b></p>
            <pre>{row.rendered.body}</pre>
          </article>
        ))}
        {!previewRows.length ? (
          <div className="ui-empty">
            <div className="ui-empty__icon" aria-hidden="true">✎</div>
            <div className="ui-empty__title">Nothing selected yet</div>
            <p>Select leads to preview personalized outreach.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
