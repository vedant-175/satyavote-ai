import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role } from "@prisma/client";

/**
 * Test endpoint for verifying server-side RBAC.
 * Query parameter `role`:
 *   - ?role=ADMIN (requires ADMIN)
 *   - ?role=REVIEWER (requires REVIEWER or ADMIN)
 *   - ?role=SUBMITTER (requires any authenticated user)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roleParam = searchParams.get("role")?.toUpperCase();

  let requiredRoles: Role[] = [];
  if (roleParam === "ADMIN") {
    requiredRoles = [Role.ADMIN];
  } else if (roleParam === "REVIEWER") {
    requiredRoles = [Role.REVIEWER, Role.ADMIN];
  } else if (roleParam === "SUBMITTER") {
    requiredRoles = [Role.SUBMITTER, Role.REVIEWER, Role.ADMIN];
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
