// E.164 normalization for +1 (US/Canada) only — the scope of this pass.
// Returns "" when the input can't be coerced to a valid +1 number.

export function toE164US(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Already E.164 +1.
  if (/^\+1\d{10}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

export function isValidE164US(value) {
  return /^\+1\d{10}$/.test(String(value || "").trim());
}
