import { NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { claimAdjudicationSchema } from "@/lib/reviewer/schemas";
import { adjudicateClaim } from "@/lib/reviewer/service";

/**
 * POST /api/reviewer/claims/[id]/adjudicate
 * Approves, overrides, or escalates a claim with audit logging.
 * Module 4: Human Review & Public Reporting - Ayush
 */
export async function POST(req, { params }) {
  const { user, errorResponse } = await enforceRbac(["REVIEWER", "ADMIN"]);
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
  } catch (err) {
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
