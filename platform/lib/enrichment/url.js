function hasScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function stripWww(hostname) {
  return hostname.replace(/^www\./, "");
}

export function normalizeUrl(value) {
  if (typeof value !== "string") return null;

  let candidate = value.trim();
  if (!candidate) return null;

  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  } else if (!hasScheme(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return null;

    url.hash = "";
    if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
      url.port = "";
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getDomainFromUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    return stripWww(url.hostname.toLowerCase());
  } catch {
    return null;
  }
}

export function isHttpUrl(value) {
  return Boolean(normalizeUrl(value));
}

export function sameDomain(urlA, urlB) {
  const domainA = getDomainFromUrl(urlA);
  const domainB = getDomainFromUrl(urlB);
  return Boolean(domainA && domainB && domainA === domainB);
}
