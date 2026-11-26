import { NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/reviewer/claims/[id]
 * Retrieves claim details, citations, and review history.
 * Module 4: Human Review & Public Reporting - Ayush
 */
export async function GET(req, { params }) {
  const { user, errorResponse } = await enforceRbac(["REVIEWER", "ADMIN"]);
  if (errorResponse) return errorResponse;

  try {
    const { id: claimId } = await params;

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        evidence: {
          orderBy: { createdAt: "asc" },
        },
        reviewActions: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        submission: {
          include: {
            imageAnalysis: true,
            claims: {
              select: {
                id: true,
                text: true,
                checkable: true,
                aiVerdict: true,
                aiConfidence: true,
                finalVerdict: true,
              },
            },
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Claim #${claimId} does not exist.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: claim,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve claim details.";
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
