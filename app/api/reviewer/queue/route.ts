import { NextRequest, NextResponse } from "next/server";
import { enforceRbac } from "@/lib/security/rbac";
import { Role } from "@prisma/client";
import { reviewerQueueQuerySchema } from "@/lib/reviewer/schemas";
import { getReviewerQueue } from "@/lib/reviewer/service";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await enforceRbac([Role.REVIEWER, Role.ADMIN]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = reviewerQueueQuerySchema.safeParse({
      sort: searchParams.get("sort") || undefined,
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || undefined,
      verdict: searchParams.get("verdict") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters.",
            details: parsedQuery.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const result = await getReviewerQueue(parsedQuery.data);
    return NextResponse.json({
      status: "success",
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load reviewer queue.";
    console.error("[ReviewerQueue API] Error:", message);
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
