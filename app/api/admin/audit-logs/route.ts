import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role, ActorType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await enforceRbac([Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const event = searchParams.get("event")?.trim();
    const actorType = searchParams.get("actorType")?.trim();
    const entity = searchParams.get("entity")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));

    const where: Prisma.AuditLogWhereInput = {};

    if (actorType && (actorType === "SYSTEM" || actorType === "USER")) {
      where.actorType = actorType as ActorType;
    }
    if (event && event !== "ALL") {
      where.event = event;
    }
    if (entity && entity !== "ALL") {
      where.entity = entity;
    }
    if (search) {
      where.OR = [
        { event: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { actorId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      status: "success",
      data: {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve audit logs.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
