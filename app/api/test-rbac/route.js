import { NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";

/**
 * Test endpoint for verifying server-side RBAC.
 * Module 1: Auth & RBAC - Vaishnavi
 */
export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const roleParam = searchParams.get("role")?.toUpperCase();

  let requiredRoles = [];
  if (roleParam === "ADMIN") {
    requiredRoles = ["ADMIN"];
  } else if (roleParam === "REVIEWER") {
    requiredRoles = ["REVIEWER", "ADMIN"];
  } else if (roleParam === "SUBMITTER") {
    requiredRoles = ["SUBMITTER", "REVIEWER", "ADMIN"];
  }

  const { user, errorResponse } = await enforceRbac(
    requiredRoles.length > 0 ? requiredRoles : undefined
  );

  if (errorResponse) {
    return errorResponse;
  }

  return NextResponse.json({
    status: "success",
    message: "Server-side RBAC verification passed successfully.",
    requiredRoles: requiredRoles.length > 0 ? requiredRoles : "ANY_AUTHENTICATED",
    authenticatedUser: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
