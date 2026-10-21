import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role, ActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sourceProfileInputSchema } from "@/lib/reviewer/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Allow partial updates on edit
    const existing = await prisma.sourceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Source profile #${id} not found.` } },
        { status: 404 }
      );
    }

    const merged = {
      domain: body.domain ?? existing.domain,
      reputationTier: body.reputationTier ?? existing.reputationTier,
      ageDays: body.ageDays !== undefined ? body.ageDays : existing.ageDays,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    };

    const parsed = sourceProfileInputSchema.safeParse(merged);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid source profile update data.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.sourceProfile.update({
        where: { id },
        data: {
          domain: parsed.data.domain,
          reputationTier: parsed.data.reputationTier,
          ageDays: parsed.data.ageDays ?? existing.ageDays,
          notes: parsed.data.notes ?? existing.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          event: "SOURCE_PROFILE_UPDATED",
          entity: "SourceProfile",
          entityId: id,
          metadata: {
            domain: p.domain,
            previousTier: existing.reputationTier,
            newTier: p.reputationTier,
            notes: p.notes,
            updatedBy: user.email,
          },
        },
      });

      return p;
    });

    return NextResponse.json({
      status: "success",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update source profile.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    const existing = await prisma.sourceProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Source profile #${id} not found.` } },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.sourceProfile.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          event: "SOURCE_PROFILE_DELETED",
          entity: "SourceProfile",
          entityId: id,
          metadata: {
            domain: existing.domain,
            tier: existing.reputationTier,
            deletedBy: user.email,
          },
        },
      });
    });

    return NextResponse.json({
      status: "success",
      message: `Source profile for domain '${existing.domain}' successfully removed.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete source profile.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
