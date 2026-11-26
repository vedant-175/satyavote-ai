import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Returns the currently authenticated user session, or null if unauthenticated.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.role) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: session.user.role,
  };
}

/**
 * Validates that a user role matches at least one of the allowed roles.
 */
export function hasRole(userRole, allowedRoles) {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Server-side RBAC guard for Route Handlers.
 * Returns either { user, errorResponse: null } or { user: null, errorResponse: NextResponse } (401 or 403).
 */
export async function enforceRbac(allowedRoles) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to access this resource.",
          },
        },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(user.role, allowedRoles)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `Forbidden: role '${user.role}' lacks sufficient privileges. Required: [${allowedRoles.join(", ")}].`,
          },
        },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * Server-side RBAC assertion for Server Actions & Server Components.
 * Throws an Error with code if unauthorized/forbidden.
 */
export async function requireUserWithRole(allowedRoles) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  if (!hasRole(user.role, allowedRoles)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
