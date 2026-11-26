import { NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { prisma } from "@/lib/db/prisma";
import { sourceProfileInputSchema } from "@/lib/reviewer/schemas";

export async function PATCH(req, { params }) {
  const { user, errorResponse } = await enforceRbac(["ADMIN"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

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
          actorType: "USER",
          actorId: user.id,
          event: "SOURCE_PROFILE_UPDATED",
          entity: "SourceProfile",
          entityId: id,
          metadata: {
            previousDomain: existing.domain,
            newDomain: parsed.data.domain,
            previousTier: existing.reputationTier,
            newTier: parsed.data.reputationTier,
          },
        },
      });

      return p;
    });

    return NextResponse.json({ status: "success", data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update source profile.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { user, errorResponse } = await enforceRbac(["ADMIN"]);
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
      await tx.sourceProfile.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorType: "USER",
          actorId: user.id,
          event: "SOURCE_PROFILE_DELETED",
          entity: "SourceProfile",
          entityId: id,
          metadata: { deletedDomain: existing.domain, tier: existing.reputationTier },
        },
      });
    });

    return NextResponse.json({
      status: "success",
      message: `Source profile for '${existing.domain}' permanently deleted.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete source profile.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
