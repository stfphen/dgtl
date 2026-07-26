import { NextResponse } from "next/server";
import { createLead, getTenantByIdOrSlug } from "../../../../lib/store";
import {
  buildSurveyPatch,
  buildSurveyResult,
  buildTeaserResult,
  normalizeSurveyAnswers
} from "../../../../lib/funding/index.js";

export const runtime = "nodejs";

/**
 * Public funding-survey endpoint (no auth).
 *
 * - Without contact (email): score and return a TEASER result (fit + lanes only).
 *   No lead is created.
 * - With contact: re-score server-side (never trust a client result), create a
 *   funding-scan lead with the survey snapshot + compatible fundingScan metadata,
 *   and return the FULL result.
 */
export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const answers = payload.answers || {};
  const contact = payload.contact || {
    businessName: answers.businessName,
    name: answers.name,
    email: answers.email,
    phone: answers.phone
  };

  const { normalizedInput, fundingScan } = normalizeSurveyAnswers(answers);

  // Teaser mode: no contact yet.
  if (!contact.email) {
    return NextResponse.json({ ok: true, teaser: true, result: buildTeaserResult(normalizedInput) });
  }

  const result = buildSurveyResult(normalizedInput);

  // Resolve tenant (default to the funded-growth tenant if not supplied).
  const tenant = await getTenantByIdOrSlug(payload.tenantId || payload.tenantSlug || "funded-growth");
  const metadata = buildSurveyPatch({
    answers,
    normalizedInput,
    result,
    fundingScan,
    completedAt: new Date().toISOString()
  });

  const lead = await createLead({
    tenantId: tenant?.id || payload.tenantId,
    sourceType: "funding_scan",
    businessName: contact.businessName || answers.businessName || "",
    contactName: contact.name || answers.name || "",
    email: contact.email,
    phone: contact.phone || answers.phone || "",
    websiteUrl: answers.companyWebsite || answers.website || "",
    city: answers.city || "",
    region: normalizedInput.province || "",
    country: normalizedInput.country || "",
    category: normalizedInput.industry || "",
    notes: fundingScan.mainGrowthGoal || "",
    packageId: "funding-fit-scan",
    metadata
  });

  return NextResponse.json({ ok: true, result, leadId: lead.id });
}
