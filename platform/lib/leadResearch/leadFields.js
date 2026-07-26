// Pure lead-field helpers, free of provider/AI imports so server components can
// use them (e.g. to show a "missing fields" count) without bundling the SDKs.

export const FILLABLE_FIELDS = [
  "email",
  "phone",
  "website",
  "contactName",
  "contactTitle",
  "address",
  "city",
  "region",
  "category"
];

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function leadValue(lead, field) {
  if (field === "website") return str(lead?.website) || str(lead?.websiteUrl);
  return str(lead?.[field]);
}

export function missingFields(lead = {}) {
  return FILLABLE_FIELDS.filter((field) => !leadValue(lead, field));
}
