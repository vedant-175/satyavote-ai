import { NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { prisma } from "@/lib/db/prisma";

export async function GET(req) {
  const { user, errorResponse } = await enforceRbac(["ADMIN"]);
  if (errorResponse) return errorResponse;

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      status: "success",
      data: users,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve user list.";
    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message } },
      { status: 500 }
    );
  }
}
