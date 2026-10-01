import { getAdminSession } from "./auth.js";

export const ROLE_OWNER = "owner";
export const ROLE_ADMIN = "admin";
export const ROLE_SALES = "sales";
export const ROLE_CONTRACTOR = "contractor";
export const ROLE_VIEWER = "viewer";

export const ALL_ROLES = [
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_SALES,
  ROLE_CONTRACTOR,
  ROLE_VIEWER
];

const USER_MANAGEMENT_ROLES = [ROLE_OWNER, ROLE_ADMIN];
const TENANT_MANAGEMENT_ROLES = [ROLE_OWNER, ROLE_ADMIN];
const LEAD_MANAGEMENT_ROLES = [ROLE_OWNER, ROLE_ADMIN, ROLE_SALES];
const CONTRACTOR_MANAGEMENT_ROLES = [ROLE_OWNER, ROLE_ADMIN];
const DASHBOARD_VIEW_ROLES = ALL_ROLES;
const CORE_WRITE_ROLES = [ROLE_OWNER, ROLE_ADMIN, ROLE_SALES];
const CORE_APPROVAL_ROLES = [ROLE_OWNER, ROLE_ADMIN];

export class PermissionError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = "PermissionError";
    this.status = status;
  }
}

export async function requireSession() {
  const session = await getAdminSession();
  if (!session) throw new PermissionError("Authentication required.", 401);
  return session;
}

export async function requireRole(allowedRoles) {
  const session = await requireSession();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!allowed.includes(session.role)) throw new PermissionError("Forbidden.", 403);
  return session;
}

export function canManageUsers(session) {
  return USER_MANAGEMENT_ROLES.includes(session?.role);
}

export function canManageTenants(session) {
  return TENANT_MANAGEMENT_ROLES.includes(session?.role);
}

export function canManageLeads(session) {
  return LEAD_MANAGEMENT_ROLES.includes(session?.role);
}

export function canManageContractors(session) {
  return CONTRACTOR_MANAGEMENT_ROLES.includes(session?.role);
}

export function canViewDashboard(session) {
  return DASHBOARD_VIEW_ROLES.includes(session?.role);
}

export function canWriteCore(session) {
  return CORE_WRITE_ROLES.includes(session?.role);
}

export function canApproveCore(session) {
  return CORE_APPROVAL_ROLES.includes(session?.role);
}

export async function requireCoreWrite() {
  return requireRole(CORE_WRITE_ROLES);
}

export async function requireCoreApproval() {
  return requireRole(CORE_APPROVAL_ROLES);
}

// Hard-restricted destructive action (call deletion). Limited to a single
// account by email — defaults to the owner, overridable via DELETE_ADMIN_EMAIL.
export const DELETE_ADMIN_EMAIL = String(
  process.env.DELETE_ADMIN_EMAIL || "stephen@dgtlgroup.io"
).toLowerCase();

export function canDeleteCalls(session) {
  return String(session?.email || "").toLowerCase() === DELETE_ADMIN_EMAIL;
}

export async function requireCallDelete() {
  const session = await requireSession();
  if (!canDeleteCalls(session)) throw new PermissionError("Forbidden.", 403);
  return session;
}

// A programmatic (fetch/XHR) caller should get a JSON status, not an HTML-login
// redirect it can't follow. Browser navigations (form posts, page loads) set
// Sec-Fetch-Dest: document and prefer text/html — those still get the redirect.
function prefersJsonResponse(request) {
  const accept = request?.headers?.get?.("accept") || "";
  const dest = request?.headers?.get?.("sec-fetch-dest") || "";
  if (dest && dest !== "document") return true;
  return accept.includes("application/json") && !accept.includes("text/html");
}

export function permissionDeniedResponse(error, request) {
  const status = error instanceof PermissionError ? error.status : error?.status;
  if (![401, 403].includes(status)) throw error;
  if (status === 401) {
    if (prefersJsonResponse(request)) {
      return Response.json({ error: error.message || "Authentication required." }, { status: 401 });
    }
    // Relative Location keeps the browser on the origin it is already using —
    // this app serves more than one host (dgtl.chat + dgtlmag.com), so an
    // auth bounce must never jump domains. PUBLIC_APP_URL remains the
    // canonical identity for outbound links (emails), not request redirects.
    return new Response(null, { status: 303, headers: { Location: "/admin/login" } });
  }

  return Response.json({ error: error.message || "Forbidden." }, { status: 403 });
}
