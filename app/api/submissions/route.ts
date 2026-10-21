import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/security/rbac";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { validateUrlForSsrf } from "@/lib/security/ssrf";
import { submissionInputSchema } from "@/lib/ai/schemas";
import { runVerificationPipeline } from "@/lib/pipeline/orchestrator";
import { ActorType, SubmissionStatus, SubmissionType } from "@prisma/client";

/**
 * POST /api/submissions
 * Ingest election content (link, text, or image) for verification.
 */
export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const currentUser = await getCurrentUser();
    const rateLimitKey = currentUser?.id || clientIp;

    // 1. Rate limiting (15 requests per minute per IP or User)
    const rateLimit = await checkRateLimit(rateLimitKey, { limit: 15, windowSeconds: 60 });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many submission attempts. Please wait before submitting more content.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 2. Parse and validate JSON body with Zod
    const body = await req.json().catch(() => null);
    const parsed = submissionInputSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: firstIssue ? firstIssue.message : "Invalid submission payload.",
          },
        },
        { status: 400 }
      );
    }

    const { type, rawText, url, imageUrl, language } = parsed.data;

    // 3. SSRF validation if URL provided
    let verifiedUrl: string | null = null;
    if (type === SubmissionType.LINK && url) {
      const ssrfCheck = await validateUrlForSsrf(url);
      if (!ssrfCheck.valid) {
        return NextResponse.json(
          {
            error: {
              code: "SSRF_GUARD_REJECTED",
              message: ssrfCheck.reason || "The supplied URL is not permitted for security reasons.",
            },
          },
          { status: 400 }
        );
      }
      verifiedUrl = ssrfCheck.normalizedUrl || url;
    }

    // 4. Persist Submission in Database with status RECEIVED
    const submission = await prisma.submission.create({
      data: {
        type,
        rawText: rawText ? rawText.trim() : null,
        url: verifiedUrl,
        imageUrl: imageUrl || null,
        language: language || "en",
        status: SubmissionStatus.RECEIVED,
        submitterId: currentUser?.id ?? null,
      },
    });

    // 5. Write Immutable AuditLog entry
    await prisma.auditLog.create({
      data: {
        actorType: currentUser ? ActorType.USER : ActorType.SYSTEM,
        actorId: currentUser?.id ?? null,
        event: "SUBMISSION_RECEIVED",
        entity: "Submission",
        entityId: submission.id,
        metadata: {
          type,
          language: submission.language,
          hasUrl: !!verifiedUrl,
          hasImage: !!imageUrl,
          textLength: rawText?.length || 0,
          ip: clientIp,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // 6. Trigger Asynchronous Background Verification Pipeline (Rule 2.3.3)
    setImmediate(() => {
      runVerificationPipeline(submission.id).catch((err) => {
        console.error(`[Background Worker] Pipeline failed for submission #${submission.id}:`, err);
      });
    });

    return NextResponse.json(
      {
        status: "success",
        data: {
          submissionId: submission.id,
          status: submission.status,
          type: submission.type,
          createdAt: submission.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Unhandled error in POST /api/submissions:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred while processing the submission.",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/submissions
 * Query recent submissions.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const submissions = await prisma.submission.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        language: true,
        createdAt: true,
        _count: {
          select: { claims: true },
        },
      },
    });

    return NextResponse.json({
      status: "success",
      data: submissions,
    });
  } catch (error: unknown) {
    console.error("Unhandled error in GET /api/submissions:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch submissions.",
        },
      },
      { status: 500 }
    );
  }
}
