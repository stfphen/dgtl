import { getDomainFromUrl, isHttpUrl, normalizeUrl, sameDomain } from "./url.js";
import { safeFetch, SsrfBlockedError } from "./ssrfGuard.js";
import {
  classifySocialUrl,
  createEmptySocialProfiles,
  extractHandle,
  normalizeSocialUrl
} from "./socialProfiles.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RESPONSE_BYTES = 350000;
const DEFAULT_MAX_INTERNAL_PAGES = 3;
const TEXT_SAMPLE_LENGTH = 320;

const PRIORITY_PAGE_RULES = [
  { category: "contact", keywords: ["contact", "contact-us", "get-in-touch", "reach-us"] },
  { category: "about", keywords: ["about", "about-us", "our-story", "company"] },
  { category: "services", keywords: ["services", "service", "what-we-do", "solutions"] },
  { category: "team", keywords: ["team", "staff", "our-team", "meet-the-team", "people"] }
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}\d/g;

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

function now() {
  return new Date().toISOString();
}

function createResult({ requestedUrl, normalizedUrl, business }) {
  return {
    ok: false,
    reason: null,
    website: {
      requestedUrl: requestedUrl || "",
      url: normalizedUrl || "",
      finalUrl: "",
      domain: normalizedUrl ? getDomainFromUrl(normalizedUrl) || "" : "",
      business: business || "",
      title: "",
      metaDescription: "",
      openGraph: {
        title: "",
        description: "",
        image: ""
      },
      canonicalUrl: "",
      headings: {
        h1: [],
        h2: [],
        h3: []
      },
      textSample: "",
      schemaOrg: [],
      priorityPages: []
    },
    contacts: [],
    socialProfiles: createEmptySocialProfiles(),
    sources: [],
    signals: [],
    compliance: {
      publicDataOnly: true,
      requestCount: 0,
      scannedAt: now()
    }
  };
}

function decodeHtmlEntities(value) {
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return HTML_ENTITY_MAP[normalized] || match;
  });
}

function normalizeWhitespace(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function parseAttributes(value = "") {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(value))) {
    const name = match[1].toLowerCase();
    const content = normalizeWhitespace(match[2] ?? match[3] ?? match[4] ?? "");
    attributes[name] = content;
  }

  return attributes;
}

function collectVoidTagAttributes(html, tagName) {
  const results = [];
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  let match;

  while ((match = pattern.exec(html))) {
    results.push(parseAttributes(match[1]));
  }

  return results;
}

function collectTagContents(html, tagName) {
  const results = [];
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  let match;

  while ((match = pattern.exec(html))) {
    results.push({
      attributes: parseAttributes(match[1]),
      content: match[2]
    });
  }

  return results;
}

function stripInvisibleMarkup(html) {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ");
}

function stripTags(value) {
  return normalizeWhitespace(String(value || "").replace(/<[^>]+>/g, " "));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return value.replace(/\s+/g, " ").trim();
}

function resolveUrl(baseUrl, value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    return normalizeUrl(new URL(value, baseUrl).toString());
  } catch {
    return null;
  }
}

function getMetaContent(metaTags, key, attributeName = "name") {
  return metaTags.find((tag) => tag[attributeName]?.toLowerCase() === key)?.content || "";
}

function extractHeadings(html) {
  const headings = { h1: [], h2: [], h3: [] };

  for (const level of ["1", "2", "3"]) {
    const key = `h${level}`;
    const matches = collectTagContents(html, key);
    headings[key] = uniqueValues(matches.map((match) => stripTags(match.content)).filter(Boolean));
  }

  return headings;
}

function extractSchemaOrg(html) {
  const scripts = collectTagContents(html, "script");
  const results = [];

  for (const script of scripts) {
    if ((script.attributes.type || "").toLowerCase() !== "application/ld+json") continue;

    const raw = script.content.replace(/^\s*<!--/, "").replace(/-->\s*$/, "").trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // Ignore invalid JSON-LD blocks. This is a best-effort extractor.
    }
  }

  return results;
}

function extractAnchors(html, pageUrl) {
  return collectTagContents(html, "a")
    .map((anchor) => {
      const href = anchor.attributes.href || "";
      const resolvedUrl = href.startsWith("mailto:") || href.startsWith("tel:") ? href : resolveUrl(pageUrl, href);
      return {
        href,
        url: resolvedUrl,
        text: stripTags(anchor.content)
      };
    })
    .filter((anchor) => anchor.href || anchor.text);
}

function extractEmailsAndPhones(text, anchors) {
  const emails = uniqueValues((text.match(EMAIL_PATTERN) || []).map((value) => value.toLowerCase()));
  const phones = uniqueValues((text.match(PHONE_PATTERN) || []).map(normalizePhone));

  for (const anchor of anchors) {
    if (anchor.href?.startsWith("mailto:")) {
      const email = anchor.href.slice("mailto:".length).split("?")[0].trim().toLowerCase();
      if (email) emails.push(email);
    }

    if (anchor.href?.startsWith("tel:")) {
      const phone = normalizePhone(anchor.href.slice("tel:".length));
      if (phone) phones.push(phone);
    }
  }

  return {
    emails: uniqueValues(emails),
    phones: uniqueValues(phones)
  };
}

function extractSocialProfiles(anchors, sourceUrl) {
  const profiles = createEmptySocialProfiles();

  for (const anchor of anchors) {
    if (!anchor.url) continue;

    const platform = classifySocialUrl(anchor.url);
    const normalizedUrl = normalizeSocialUrl(anchor.url);
    if (!platform || !normalizedUrl) continue;

    const handle = extractHandle(platform, normalizedUrl);
    if (!handle) continue;

    if (!profiles[platform].some((profile) => profile.url === normalizedUrl)) {
      profiles[platform].push({
        url: normalizedUrl,
        handle,
        sourceUrl
      });
    }
  }

  return profiles;
}

function selectPriorityLinks(anchors, homepageUrl, limit) {
  const selected = [];
  const seenUrls = new Set();

  for (const rule of PRIORITY_PAGE_RULES) {
    const match = anchors.find((anchor) => {
      if (!anchor.url || !sameDomain(anchor.url, homepageUrl)) return false;
      if (anchor.url === homepageUrl) return false;

      const haystack = `${anchor.href} ${anchor.text}`.toLowerCase();
      return rule.keywords.some((keyword) => haystack.includes(keyword));
    });

    if (!match || seenUrls.has(match.url)) continue;

    seenUrls.add(match.url);
    selected.push({
      category: rule.category,
      url: match.url,
      label: match.text
    });

    if (selected.length >= limit) break;
  }

  return selected;
}

function buildVisibleText(html) {
  return stripTags(stripInvisibleMarkup(html));
}

function extractPageData(html, pageUrl) {
  const safeHtml = String(html || "");
  const metaTags = collectVoidTagAttributes(safeHtml, "meta");
  const linkTags = collectVoidTagAttributes(safeHtml, "link");
  const anchors = extractAnchors(safeHtml, pageUrl);
  const visibleText = buildVisibleText(safeHtml);
  const emailsAndPhones = extractEmailsAndPhones(visibleText, anchors);

  return {
    title: stripTags(collectTagContents(safeHtml, "title")[0]?.content || ""),
    metaDescription: getMetaContent(metaTags, "description"),
    openGraph: {
      title: getMetaContent(metaTags, "og:title", "property") || getMetaContent(metaTags, "og:title"),
      description:
        getMetaContent(metaTags, "og:description", "property") || getMetaContent(metaTags, "og:description"),
      image: getMetaContent(metaTags, "og:image", "property") || getMetaContent(metaTags, "og:image")
    },
    canonicalUrl:
      resolveUrl(pageUrl, linkTags.find((tag) => (tag.rel || "").toLowerCase().split(/\s+/).includes("canonical"))?.href || "") || "",
    headings: extractHeadings(safeHtml),
    textSample: visibleText.slice(0, TEXT_SAMPLE_LENGTH),
    schemaOrg: extractSchemaOrg(safeHtml),
    anchors,
    emails: emailsAndPhones.emails,
    phones: emailsAndPhones.phones,
    socialProfiles: extractSocialProfiles(anchors, pageUrl)
  };
}

async function readResponseBody(response, maxResponseBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxResponseBytes) {
      throw new Error(`Response exceeded ${maxResponseBytes} bytes.`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxResponseBytes) {
      await reader.cancel?.();
      throw new Error(`Response exceeded ${maxResponseBytes} bytes.`);
    }

    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

function isAbortError(error) {
  return error?.name === "AbortError" || /timed out/i.test(error?.message || "");
}

async function fetchPage(url, { timeoutMs, maxResponseBytes }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // safeFetch validates the URL and every redirect hop against the SSRF guard
    // (scheme allowlist + private/reserved/metadata IP block) before each request.
    const response = await safeFetch(
      url,
      {
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.1"
        },
        signal: controller.signal
      },
      { maxRedirects: 5 }
    );

    if (!response.ok) {
      throw new Error(`Fetch returned ${response.status}.`);
    }

    const contentType = response.headers?.get?.("content-type") || "";
    const html = await readResponseBody(response, maxResponseBytes);
    return {
      ok: true,
      status: response.status,
      url: normalizeUrl(response.url || url) || url,
      contentType,
      html
    };
  } catch (error) {
    return {
      ok: false,
      reason: isAbortError(error) ? `Request timed out after ${timeoutMs}ms.` : error.message || "Fetch failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mergeSocialProfiles(target, source) {
  for (const [platform, profiles] of Object.entries(source)) {
    if (!target[platform]) target[platform] = [];
    for (const profile of profiles) {
      if (!profile?.url) continue;
      if (!target[platform].some((existing) => existing?.url === profile.url)) {
        target[platform].push(profile);
      }
    }
  }
}

function addContacts(result, pageData, sourceUrl) {
  const existing = new Set(result.contacts.map((contact) => `${contact.type}:${contact.value.toLowerCase()}`));

  for (const email of pageData.emails) {
    const key = `email:${email.toLowerCase()}`;
    if (existing.has(key)) continue;
    existing.add(key);
    result.contacts.push({
      type: "email",
      value: email,
      sourceUrl
    });
  }

  for (const phone of pageData.phones) {
    const key = `phone:${phone.toLowerCase()}`;
    if (existing.has(key)) continue;
    existing.add(key);
    result.contacts.push({
      type: "phone",
      value: phone,
      sourceUrl
    });
  }
}

function addSignals(result, pageData, source, selectedLinks = []) {
  for (const [platform, profiles] of Object.entries(pageData.socialProfiles)) {
    for (const profile of profiles) {
      result.signals.push({
        type: "social_profile",
        platform,
        sourceUrl: source.url,
        value: profile.url
      });
    }
  }

  for (const item of pageData.schemaOrg) {
    const schemaType = Array.isArray(item?.["@type"]) ? item["@type"][0] : item?.["@type"];
    if (!schemaType) continue;
    result.signals.push({
      type: "schema_org",
      schemaType,
      sourceUrl: source.url
    });
  }

  for (const link of selectedLinks) {
    result.signals.push({
      type: "priority_page",
      category: link.category,
      sourceUrl: source.url,
      value: link.url
    });
  }
}

function applyHomepageData(result, pageData, homepageUrl, selectedLinks) {
  result.website.finalUrl = homepageUrl;
  result.website.domain = getDomainFromUrl(homepageUrl) || result.website.domain;
  result.website.title = pageData.title;
  result.website.metaDescription = pageData.metaDescription;
  result.website.openGraph = pageData.openGraph;
  result.website.canonicalUrl = pageData.canonicalUrl;
  result.website.headings = pageData.headings;
  result.website.textSample = pageData.textSample;
  result.website.schemaOrg = pageData.schemaOrg;
  result.website.priorityPages = selectedLinks;
}

export async function enrichWebsite({
  url,
  business = "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  maxInternalPages = DEFAULT_MAX_INTERNAL_PAGES
} = {}) {
  const normalizedUrl = normalizeUrl(url);
  const result = createResult({
    requestedUrl: typeof url === "string" ? url : "",
    normalizedUrl,
    business
  });

  if (!normalizedUrl || !isHttpUrl(normalizedUrl)) {
    result.reason = "URL must be a valid http or https website.";
    return result;
  }

  const homepageResponse = await fetchPage(normalizedUrl, { timeoutMs, maxResponseBytes });
  result.compliance.requestCount += 1;

  if (!homepageResponse.ok) {
    result.reason = homepageResponse.reason;
    result.sources.push({
      category: "homepage",
      requestedUrl: normalizedUrl,
      ok: false,
      reason: homepageResponse.reason
    });
    return result;
  }

  const homepageData = extractPageData(homepageResponse.html, homepageResponse.url);
  const priorityLinks = selectPriorityLinks(homepageData.anchors, homepageResponse.url, maxInternalPages);

  const homepageSource = {
    category: "homepage",
    requestedUrl: normalizedUrl,
    url: homepageResponse.url,
    ok: true,
    status: homepageResponse.status,
    contentType: homepageResponse.contentType,
    title: homepageData.title
  };

  result.sources.push(homepageSource);
  applyHomepageData(result, homepageData, homepageResponse.url, priorityLinks);
  addContacts(result, homepageData, homepageResponse.url);
  mergeSocialProfiles(result.socialProfiles, homepageData.socialProfiles);
  addSignals(result, homepageData, homepageSource, priorityLinks);

  for (const link of priorityLinks) {
    const pageResponse = await fetchPage(link.url, { timeoutMs, maxResponseBytes });
    result.compliance.requestCount += 1;

    if (!pageResponse.ok) {
      result.sources.push({
        category: link.category,
        requestedUrl: link.url,
        ok: false,
        reason: pageResponse.reason
      });
      continue;
    }

    const pageData = extractPageData(pageResponse.html, pageResponse.url);
    const source = {
      category: link.category,
      requestedUrl: link.url,
      url: pageResponse.url,
      ok: true,
      status: pageResponse.status,
      contentType: pageResponse.contentType,
      title: pageData.title
    };

    result.sources.push(source);
    addContacts(result, pageData, pageResponse.url);
    mergeSocialProfiles(result.socialProfiles, pageData.socialProfiles);
    addSignals(result, pageData, source);
  }

  result.ok = true;
  return result;
}
