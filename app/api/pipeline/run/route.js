import { NextResponse } from "next/server";
import { runVerificationPipeline } from "@/lib/pipeline/orchestrator";

/**
 * POST /api/pipeline/run
 * Next.js Route Handler for triggering the AI verification pipeline.
 * Module 3: AI Verification - Vedant
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const submissionId = body?.submissionId;

    if (!submissionId || typeof submissionId !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Parameter 'submissionId' is required.",
          },
        },
        { status: 400 }
      );
    }

    const result = await runVerificationPipeline(submissionId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "PIPELINE_ERROR",
            message: result.errors?.[0] || "Pipeline run failed.",
          },
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline trigger failed.";
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
