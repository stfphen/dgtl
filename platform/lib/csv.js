export function parseCsv(input) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || "";
    });
    return record;
  });
}

export function leadFromCsvRecord(record, tenantId) {
  return {
    tenantId,
    businessName: record.business || record.business_name || record.company || record.name || "",
    business: record.business || record.business_name || record.company || record.name || "",
    contactName: record.contact || record.contact_name || record.owner || "",
    name: record.contact || record.contact_name || record.owner || "",
    contactTitle: record.contact_title || record.title || record.role || "",
    email: record.email || "",
    phone: record.phone || "",
    website: record.website || record.url || record.instagram || "",
    url: record.website || record.url || record.instagram || "",
    domain: record.domain || "",
    address: record.address || "",
    city: record.city || "",
    region: record.province || record.state || record.region || "",
    country: record.country || "",
    category: record.category || record.industry || "",
    notes: record.notes || "",
    pipelineStatus: record.pipeline_status || record.status || "new",
    outreachStatus: record.outreach_status || "not_started",
    enrichmentStatus: record.enrichment_status || "not_started",
    painPoints: record.pain_points || "",
    recommendedOffer: record.recommended_offer || "",
    assignedTo: record.assigned_to || "",
    sourceType: "csv",
    source: "csv",
    metadata: record
  };
}
