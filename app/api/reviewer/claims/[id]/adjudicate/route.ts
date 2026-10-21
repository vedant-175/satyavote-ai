import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role } from "@prisma/client";
import { claimAdjudicationSchema } from "@/lib/reviewer/schemas";
import { adjudicateClaim } from "@/lib/reviewer/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await enforceRbac([Role.REVIEWER, Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { id: claimId } = await params;
    const body = await req.json().catch(() => ({}));

    const parsed = claimAdjudicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid adjudication input.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const result = await adjudicateClaim({
      claimId,
      reviewerId: user.id,
      action: parsed.data.action,
      newVerdict: parsed.data.newVerdict,
      note: parsed.data.note,
    });

    return NextResponse.json({
      status: "success",
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to adjudicate claim.";
    console.error(`[Adjudicate API] Error:`, message);
    return NextResponse.json(
      {
        error: {
          code: "ADJUDICATION_FAILED",
          message,
        },
      },
      { status: 400 }
    );
  }
}
