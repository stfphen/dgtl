// Host-preserving redirects.
//
// The app serves several hosts from one deployment (os.dgtl.ltd, dgtl.chat,
// dgtlmag.com) and the session cookie is host-scoped. A redirect built from
// PUBLIC_APP_URL therefore moves an operator onto a host where their cookie
// does not exist — they land on the login page mid-workflow. PUBLIC_APP_URL's
// real job is the app's canonical identity for links that LEAVE the process
// (email footers, Stripe returns); it must never decide where a request goes
// next.
//
// RFC 7231 allows a relative Location and every browser resolves it against
// the current origin, which is exactly the behaviour we want. NextResponse
// .redirect() cannot express this — it requires an absolute URL — so these
// build the Response directly.

/**
 * 303 redirect to a same-app path, staying on whichever host the request
 * arrived on. `pathname` may already carry a query string.
 */
export function redirectSameHost(pathname, notice = "") {
  const target = notice
    ? `${pathname}${pathname.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`
    : pathname;
  return new Response(null, { status: 303, headers: { Location: target } });
}

// Some routes build their target incrementally (conditional notices, extra
// query params, branching). URL is the right tool for that, so give them one
// on a throwaway origin and emit only its path+query — the origin never
// reaches the client.
const SAME_HOST = "http://same-host.invalid";

/** A mutable URL for building a same-app target. Pair with redirectToUrl(). */
export function sameHostUrl(pathname) {
  return new URL(pathname, SAME_HOST);
}

/** 303 to a URL built by sameHostUrl(), keeping the caller's host. */
export function redirectToUrl(url) {
  return new Response(null, { status: 303, headers: { Location: `${url.pathname}${url.search}` } });
}
