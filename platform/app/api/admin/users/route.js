import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions";
import {
  createUser,
  updateUserRole,
  updateUserStatus
} from "../../../../lib/users";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const action = String(form.get("action") || "create");
  const teamId = session.team?.id || "";
  const userId = String(form.get("userId") || "");

  try {
    if (!teamId) {
      return redirectAdmin(request, "Team context is required to manage users.");
    }

    if (action === "create") {
      const created = await createUser({
        email: String(form.get("email") || ""),
        name: String(form.get("name") || ""),
        password: String(form.get("password") || ""),
        teamId,
        role: String(form.get("role") || "")
      });
      await logAudit({
        userId: session.user?.id,
        action: "user.created",
        targetType: "user",
        targetId: created.id,
        metadata: {
          email: created.email,
          name: created.name,
          role: created.role,
          teamId
        }
      });
      return redirectAdmin(request, "Team credential created.");
    }

    if (action === "deactivate" || action === "reactivate") {
      if (userId === session.user?.id && action === "deactivate") {
        return redirectAdmin(request, "You cannot deactivate your own account.");
      }

      const status = action === "deactivate" ? "disabled" : "active";
      await updateUserStatus(userId, status, teamId);
      await logAudit({
        userId: session.user?.id,
        action: action === "deactivate" ? "user.deactivated" : "user.reactivated",
        targetType: "user",
        targetId: userId,
        metadata: { status, teamId }
      });
      return redirectAdmin(request, action === "deactivate" ? "User deactivated." : "User reactivated.");
    }

    if (action === "update_role") {
      const role = String(form.get("role") || "");
      await updateUserRole(userId, teamId, role);
      await logAudit({
        userId: session.user?.id,
        action: "user.role_changed",
        targetType: "user",
        targetId: userId,
        metadata: { role, teamId }
      });
      return redirectAdmin(request, "User role updated.");
    }

    return redirectAdmin(request, "Unsupported user management action.");
  } catch (error) {
    return redirectAdmin(request, error.message || "User management failed.");
  }
}
