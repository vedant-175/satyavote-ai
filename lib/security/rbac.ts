import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

/**
 * Returns the currently authenticated user session, or null if unauthenticated.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.role) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: session.user.role as Role,
  };
}

/**
 * Validates that a user role matches at least one of the allowed roles.
 */
export function hasRole(userRole: Role | undefined | null, allowedRoles: Role[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Server-side RBAC guard for Route Handlers.
 * Returns either { user } or { response: NextResponse } (401 or 403).
 */
export async function enforceRbac(allowedRoles?: Role[]): Promise<
  | { user: AuthenticatedUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse }
> {
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
export async function requireUserWithRole(allowedRoles: Role[]): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  if (!hasRole(user.role, allowedRoles)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}
