function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getBusinessLabel(lead) {
  return lead?.business || lead?.name || "This lead";
}

function getEnrichment(lead) {
  return isPlainObject(lead?.metadata?.enrichment) ? lead.metadata.enrichment : {};
}

function getWebsite(enrichment) {
  return isPlainObject(enrichment.website) ? enrichment.website : {};
}

function getGoogleListingMetadata(lead) {
  const metadata = isPlainObject(lead?.metadata) ? lead.metadata : {};
  const candidates = [
    metadata.googlePlaces,
    metadata.google_places,
    metadata.place,
    metadata
  ];

  return candidates.find((candidate) =>
    isPlainObject(candidate) && (candidate.rating !== undefined || candidate.userRatingCount !== undefined)
  ) || {};
}

function collectHeadings(website) {
  return uniqueValues([
    ...asArray(website?.headings?.h1),
    ...asArray(website?.headings?.h2),
    ...asArray(website?.headings?.h3)
  ]);
}

function countSocialUrls(socialProfiles) {
  if (!isPlainObject(socialProfiles)) return 0;
  return Object.values(socialProfiles).reduce(
    (count, urls) => count + asArray(urls).length,
    0
  );
}

function addEvidence(evidence, field, detail, value) {
  evidence.push({
    field,
    detail,
    value
  });
}

function pushUnique(target, value) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function pickSuggestedOffer(primaryAngle) {
  switch (primaryAngle) {
    case "website_content":
      return "Website conversion refresh with clearer service-page copy and stronger call-to-action placement.";
    case "social_content":
      return "Social-to-site content package that turns Instagram attention into consultation-ready landing pages.";
    case "content_repurposing":
      return "Service-content repurposing sprint for FAQs, service pages, and reusable short-form content.";
    case "reputation":
      return "Reputation proof refresh that pulls Google reviews into the website and follow-up messaging.";
    case "caller_first":
      return "Caller-first outreach with a phone opener, tighter front-desk script, and a simple follow-up page.";
    default:
      return "Content and conversion audit focused on the next easiest path to booked consultations.";
  }
}

function buildSummary(label, observations) {
  if (!observations.length) {
    return `${label} has limited public website data, so the first move is a short discovery call and a basic content audit.`;
  }

  const [first, second, third] = observations;
  const details = [first, second, third].filter(Boolean).join("; ");
  return `${label}: ${details}.`;
}

export function buildSalesBrief({ lead } = {}) {
  const label = getBusinessLabel(lead);
  const enrichment = getEnrichment(lead);
  const website = getWebsite(enrichment);
  const googleListing = getGoogleListingMetadata(lead);
  const socialProfiles = isPlainObject(enrichment.socialProfiles) ? enrichment.socialProfiles : {};
  const contacts = asArray(enrichment.contacts);
  const headings = collectHeadings(website);
  const websiteTextLength = String(website.textSample || "").trim().length;
  const priorityPages = asArray(website.priorityPages);
  const emails = uniqueValues(
    contacts.filter((contact) => contact?.type === "email").map((contact) => contact?.value)
  );
  const phones = uniqueValues(
    [
      ...contacts.filter((contact) => contact?.type === "phone").map((contact) => contact?.value),
      lead?.phone || ""
    ].filter(Boolean)
  );
  const instagramCount = asArray(socialProfiles.instagram).length;
  const socialUrlCount = countSocialUrls(socialProfiles);
  const reviewCount = toNumber(googleListing.userRatingCount ?? googleListing.reviewCount);
  const rating = toNumber(googleListing.rating);
  const hasContactPage = priorityPages.some((page) => page?.category === "contact");
  const hasWebsite = Boolean(lead?.websiteUrl || website.finalUrl || website.url || website.title);
  const lowWebsiteContent = websiteTextLength < 160 || headings.length < 3;
  const weakCta = hasWebsite && !hasContactPage && !emails.length;
  const manyServices = headings.length >= 5;
  const strongReputation = (rating !== null && rating >= 4.3) || (reviewCount !== null && reviewCount >= 20);
  const callerFirst = !emails.length && phones.length > 0;
  const websiteOpportunity = !hasWebsite || weakCta;
  const socialContentOpportunity = instagramCount > 0 && lowWebsiteContent;

  const likelyNeeds = [];
  const outreachAngles = [];
  const objectionsToExpect = [];
  const evidence = [];
  const observations = [];
  let fitScore = 34;
  let confidenceScore = 18;
  let primaryAngle = "";

  if (hasWebsite) {
    confidenceScore += 8;
    addEvidence(evidence, "websiteUrl", "Lead has a website URL to review.", lead.websiteUrl || website.finalUrl || website.url);
  } else {
    addEvidence(evidence, "websiteUrl", "Lead does not have a usable website URL.", lead?.websiteUrl || "");
  }

  if (enrichment.status === "complete") confidenceScore += 14;
  else if (enrichment.status === "partial") confidenceScore += 8;
  else if (enrichment.status === "failed") confidenceScore += 2;

  if (websiteTextLength >= 160) {
    confidenceScore += 14;
  } else if (websiteTextLength >= 80) {
    confidenceScore += 8;
  } else if (websiteTextLength > 0) {
    confidenceScore += 4;
  }

  if (headings.length >= 3) confidenceScore += 10;
  if (priorityPages.length > 0) confidenceScore += 6;
  if (socialUrlCount > 0) confidenceScore += 7;
  if (emails.length + phones.length > 0) confidenceScore += 8;
  if (rating !== null || reviewCount !== null) confidenceScore += 11;

  if (websiteOpportunity) {
    fitScore += 20;
    pushUnique(likelyNeeds, "A clearer website conversion path with a stronger contact call to action.");
    pushUnique(
      outreachAngles,
      "Website/content angle: tighten the homepage CTA, add clearer service-page copy, and make the next step obvious."
    );
    pushUnique(objectionsToExpect, "We already have a website.");
    observations.push(
      hasWebsite ? "the website looks light on contact capture and conversion cues" : "the public web presence is missing a reliable website"
    );
    addEvidence(
      evidence,
      "metadata.enrichment.website.priorityPages",
      hasContactPage
        ? "A contact page exists, but email capture is still thin."
        : "No contact page was discovered during enrichment.",
      priorityPages.length
    );
    if (!primaryAngle) primaryAngle = "website_content";
  }

  if (socialContentOpportunity) {
    fitScore += 14;
    pushUnique(likelyNeeds, "A stronger handoff from Instagram attention into bookable website traffic.");
    pushUnique(
      outreachAngles,
      "Social/content angle: turn Instagram activity into service landing pages, FAQs, and consultation-ready content."
    );
    pushUnique(objectionsToExpect, "We already post on Instagram.");
    observations.push("Instagram is active, but the website content looks thin compared with the social footprint");
    addEvidence(
      evidence,
      "metadata.enrichment.socialProfiles.instagram",
      "Instagram was found while website copy and headings remain limited.",
      instagramCount
    );
    if (!primaryAngle) primaryAngle = "social_content";
  }

  if (manyServices) {
    fitScore += 12;
    pushUnique(likelyNeeds, "Service expertise repackaged into reusable website, SEO, and social content.");
    pushUnique(
      outreachAngles,
      "Content repurposing angle: spin service headings into FAQs, offer pages, and short-form sales content."
    );
    observations.push("there is enough service depth to repurpose into higher-intent content");
    addEvidence(
      evidence,
      "metadata.enrichment.website.headings.h2",
      "Multiple service headings were found on the website.",
      headings.length
    );
    if (!primaryAngle) primaryAngle = "content_repurposing";
  }

  if (strongReputation) {
    fitScore += 10;
    pushUnique(likelyNeeds, "More visible social proof pulled from Google reviews into the site and follow-up messaging.");
    pushUnique(
      outreachAngles,
      "Reputation angle: package Google review strength into trust blocks, testimonials, and proof-led follow-up."
    );
    pushUnique(objectionsToExpect, "Referrals and Google already bring us leads.");
    observations.push(
      rating !== null && reviewCount !== null
        ? `Google already shows strong public proof at ${rating.toFixed(1)} stars across ${reviewCount} reviews`
        : "Google already shows meaningful public proof"
    );
    if (rating !== null) {
      addEvidence(
        evidence,
        "metadata.rating",
        "Google rating is available for the lead.",
        rating
      );
    }
    if (reviewCount !== null) {
      addEvidence(
        evidence,
        "metadata.userRatingCount",
        "Google review count is available for the lead.",
        reviewCount
      );
    }
    if (!primaryAngle) primaryAngle = "reputation";
  }

  if (callerFirst) {
    fitScore += 9;
    pushUnique(likelyNeeds, "A caller-first qualification path because the business exposes phone access faster than email.");
    pushUnique(
      outreachAngles,
      "Caller-first angle: lead with a short phone opener and use follow-up pages only after interest is confirmed."
    );
    pushUnique(objectionsToExpect, "Just call the front desk.");
    observations.push("phone looks like the clearest response path because no website email was surfaced");
    addEvidence(
      evidence,
      "metadata.enrichment.contacts",
      "Phone contact was found, but no website email was surfaced.",
      { emails: emails.length, phones: phones.length }
    );
    if (!primaryAngle) primaryAngle = "caller_first";
  }

  if (!outreachAngles.length) {
    pushUnique(likelyNeeds, "A clearer public value proposition tied to real services and proof points.");
    pushUnique(
      outreachAngles,
      "Messaging angle: tighten the public offer so service pages, social proof, and next steps tell one story."
    );
    observations.push("the public messaging is present but not yet packaged into a clear sales angle");
  }

  const suggestedOffer = pickSuggestedOffer(primaryAngle);
  const summary = buildSummary(label, observations);
  const callerOpeningLine = strongReputation
    ? `Hi, I was looking at ${label}'s website and Google presence. You already have visible public proof, and I think there is room to turn that into a clearer conversion path.`
    : websiteOpportunity
      ? `Hi, I was reviewing ${label}'s public site and noticed a gap between the services you offer and the next step a prospect can take online.`
      : `Hi, I was looking at ${label}'s public web presence and saw a few places where stronger content could make the sales conversation easier.`;

  if (!objectionsToExpect.length) {
    pushUnique(objectionsToExpect, "We already handle this in-house.");
  }

  return {
    summary,
    likelyNeeds,
    outreachAngles,
    callerOpeningLine,
    objectionsToExpect,
    suggestedOffer,
    confidenceScore: clampScore(confidenceScore),
    fitScore: clampScore(fitScore),
    evidence
  };
}
