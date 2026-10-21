import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role, ActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { userRoleUpdateSchema } from "@/lib/reviewer/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { id: targetUserId } = await params;
    const body = await req.json().catch(() => ({}));

    const parsed = userRoleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role specified.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `User #${targetUserId} not found.`,
          },
        },
        { status: 404 }
      );
    }

    // Safety guard: prevent demoting the only active administrator
    if (targetUser.role === Role.ADMIN && parsed.data.role !== Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Cannot demote the only remaining administrator in the platform.",
            },
          },
          { status: 403 }
        );
      }
    }

    const oldRole = targetUser.role;
    const newRole = parsed.data.role;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
        select: { id: true, name: true, email: true, role: true, updatedAt: true },
      });

      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          event: "USER_ROLE_UPDATED",
          entity: "User",
          entityId: targetUserId,
          metadata: {
            targetEmail: targetUser.email,
            oldRole,
            newRole,
            updatedBy: user.email,
          },
        },
      });

      return u;
    });

    return NextResponse.json({
      status: "success",
      data: updatedUser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user role.";
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
