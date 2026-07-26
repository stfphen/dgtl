---
title: 21 · Admin Shell, Auth & RBAC
type: module
tags: [module]
status: stable
updated: 2026-06-27
---

# Admin Shell, Auth & RBAC

## Purpose
The operator cockpit (`/admin`) plus the security layer that protects it: authentication,
role-based access control, and audit logging.

## Key files
- `app/admin/page.jsx` — the admin shell (server component; imports all admin components).
- `app/admin/login/page.jsx` — login page (redirected to when unauthenticated).
- `components/admin/AdminTabbedShell.jsx` — tabbed shell + bottom nav (framer-motion, dark-mode toggle, reduced-motion aware). Tabs: Dashboard / Pipeline / Prospecting / Outreach / Tenants / Funding / Calls (gated by role).
- `lib/auth.js` — sessions: `ADMIN_COOKIE_NAME`, `createSessionToken` (random 32 bytes), `hashSessionToken` (SHA-256), `createAdminSession`/`getAdminSession`/`deleteAdminSession`, `adminCookie`/`clearAdminCookie`, `validateAdminCredentials`.
- `lib/permissions.js` — RBAC: role constants (`ROLE_OWNER/ADMIN/SALES/CONTRACTOR/VIEWER`, `ALL_ROLES`), `PermissionError`, `requireSession`, `requireRole`, capability checks (`canManageUsers/Tenants/Leads/Contractors`, `canViewDashboard`), `DELETE_ADMIN_EMAIL` + `canDeleteCalls`/`requireCallDelete`, `permissionDeniedResponse`.
- `lib/users.js` — `USER_ROLES`, `USER_STATUSES`, bcrypt `hashPassword`/`verifyPassword`, `createUser`, `ensureUserMembership`, `findUserByEmail/ById`, `listTeamUsers(teamId)`, `updateUserStatus/Role`.
- `lib/audit.js` — `sanitizeAuditMetadata` (secret redaction), `logAudit`, `listAuditLogs`.

## Security properties (verified — [[61-Security-Review]])
- bcrypt cost **12**; session tokens 32 bytes entropy, stored only as **SHA-256** hash; cookies `httpOnly`/`secure`/`sameSite`; parameterized SQL; audit-log secret redaction.
- 28/30 admin routes enforce `requireRole`. No `dangerouslySetInnerHTML`.

## Roles
`owner` > `admin` > `sales` > `contractor` > `viewer`. Owner creates the first account via one-time
`OWNER_PASSWORD` env to `npm run create-owner` (never written to `.env`).
Call deletion is email-gated to `DELETE_ADMIN_EMAIL` (historically `stephen@dgtlgroup.io`).

## ⚠️ Gotchas / open issues
- **No rate limiting anywhere** — no `middleware.ts`; unthrottled bcrypt on `POST /api/admin/login` = brute-force/DoS risk (H1).
- **IDOR:** `leads/enrich` + `leads/enrich-batch` skip `requireRole`/team scoping (H2).
- `permissionDeniedResponse` returns a 303 redirect even for JSON APIs (L1).
- `SESSION_SECRET` is referenced in docs/`.env.example` but **not actually read by code yet** (L2).
- The `team_default` association gotcha — see [[15-Multi-Tenancy]].

## Related
[[14-Routes-Map]] · [[13-Data-Model]] · [[61-Security-Review]] · [[16-Design-System]]

Up: [[20-Modules-MOC]]
