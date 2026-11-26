import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req, { params }) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Missing or invalid submission ID.",
          },
        },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        claims: {
          include: {
            evidence: true,
          },
          orderBy: { createdAt: "asc" },
        },
        imageAnalysis: true,
        pipelineRuns: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Submission with ID '${id}' was not found.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: submission,
    });
  } catch (error) {
    console.error("Error in GET /api/submissions/[id]:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch submission details.",
        },
      },
      { status: 500 }
    );
  }
}
