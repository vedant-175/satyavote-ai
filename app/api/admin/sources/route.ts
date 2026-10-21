import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role, ActorType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sourceProfileInputSchema } from "@/lib/reviewer/schemas";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const tier = searchParams.get("tier");

    const where: any = {};
    if (search) {
      where.OR = [
        { domain: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }
    if (tier && tier !== "ALL") {
      where.reputationTier = tier;
    }

    const profiles = await prisma.sourceProfile.findMany({
      where,
      orderBy: { domain: "asc" },
    });

    return NextResponse.json({
      status: "success",
      data: profiles,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch source profiles.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = sourceProfileInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid source profile payload.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { domain, reputationTier, ageDays, notes } = parsed.data;

    // Check if domain exists
    const existing = await prisma.sourceProfile.findUnique({
      where: { domain },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: `Domain '${domain}' already exists in source directory. Use edit to update it.`,
          },
        },
        { status: 409 }
      );
    }

    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.sourceProfile.create({
        data: {
          domain,
          reputationTier,
          ageDays: ageDays ?? 365,
          notes: notes || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          event: "SOURCE_PROFILE_CREATED",
          entity: "SourceProfile",
          entityId: p.id,
          metadata: {
            domain,
            reputationTier,
            notes,
            createdBy: user.email,
          },
        },
      });

      return p;
    });

    return NextResponse.json({
      status: "success",
      data: profile,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create source profile.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
