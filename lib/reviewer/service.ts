import { prisma } from "@/lib/db/prisma";
import {
  Verdict,
  SubmissionStatus,
  SubmissionType,
  ReviewActionType,
  ActorType,
  Prisma,
} from "@prisma/client";
import { ReviewerQueueQuery, ClaimAdjudicationInput } from "./schemas";

export interface QueueItem {
  id: string;
  text: string;
  language: string;
  checkable: boolean;
  aiVerdict: Verdict;
  aiConfidence: number;
  aiReasoning: string | null;
  finalVerdict: Verdict | null;
  finalNote: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  submission: {
    id: string;
    type: SubmissionType;
    rawText: string | null;
    url: string | null;
    imageUrl: string | null;
    status: SubmissionStatus;
    language: string;
    createdAt: Date;
    imageAnalysis: {
      flags: string[];
      perceptualHash: string | null;
      aiGeneratedScore: number | null;
      ocrText: string | null;
    } | null;
  };
  evidenceCount: number;
  duplicateCount: number;
  priorityScore: number;
}

/**
 * Retrieves the reviewer queue with priority sorting, filters, and duplicate media calculation.
 */
export async function getReviewerQueue(query: ReviewerQueueQuery): Promise<{
  items: QueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { sort, status, type, verdict, page, limit } = query;

  // Build Prisma where filter
  const claimWhere: Prisma.ClaimWhereInput = {};

  const submissionWhere: Prisma.SubmissionWhereInput = {};

  if (status !== "ALL") {
    if (status === "PUBLISHED") {
      claimWhere.finalVerdict = { not: null };
      claimWhere.publishedAt = { not: null };
    } else if (status === "AI_SUGGESTED") {
      claimWhere.finalVerdict = null;
      submissionWhere.status = SubmissionStatus.AI_SUGGESTED;
    } else if (status === "IN_REVIEW") {
      submissionWhere.status = SubmissionStatus.IN_REVIEW;
    } else if (status === "ESCALATED") {
      submissionWhere.status = SubmissionStatus.ESCALATED;
    }
  }

  if (type !== "ALL") {
    submissionWhere.type = type as SubmissionType;
  }

  if (Object.keys(submissionWhere).length > 0) {
    claimWhere.submission = submissionWhere;
  }

  if (verdict !== "ALL") {
    claimWhere.aiVerdict = verdict as Verdict;
  }

  // Fetch candidate claims with relational context
  const rawClaims = await prisma.claim.findMany({
    where: claimWhere,
    include: {
      submission: {
        include: {
          imageAnalysis: {
            select: {
              flags: true,
              perceptualHash: true,
              aiGeneratedScore: true,
              ocrText: true,
            },
          },
        },
      },
      evidence: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200, // Top candidates for priority ranking
  });

  // Calculate duplicate hashes across the database for media viral prioritization
  const hashes = rawClaims
    .map((c) => c.submission.imageAnalysis?.perceptualHash)
    .filter((h): h is string => Boolean(h));

  const hashCounts = new Map<string, number>();
  if (hashes.length > 0) {
    const duplicates = await prisma.imageAnalysis.groupBy({
      by: ["perceptualHash"],
      where: {
        perceptualHash: { in: Array.from(new Set(hashes)) },
      },
      _count: { perceptualHash: true },
    });
    for (const d of duplicates) {
      if (d.perceptualHash) {
        hashCounts.set(d.perceptualHash, d._count.perceptualHash);
      }
    }
  }

  // Calculate composite priority score for each claim
  const mappedItems: QueueItem[] = rawClaims.map((claim) => {
    const hash = claim.submission.imageAnalysis?.perceptualHash;
    const duplicateCount = hash ? (hashCounts.get(hash) ?? 1) : 1;
    const isRecycled = claim.submission.imageAnalysis?.flags.some((f) =>
      f.toLowerCase().includes("older") || f.toLowerCase().includes("recycled")
    );
    const isAiGenerated = (claim.submission.imageAnalysis?.aiGeneratedScore ?? 0) > 0.7;

    let priorityScore = 10;

    // 1. Viral / Duplicate urgency
    if (duplicateCount > 1) {
      priorityScore += Math.min(duplicateCount * 25, 100);
    }
    if (isRecycled) priorityScore += 40;
    if (isAiGenerated) priorityScore += 30;

    // 2. Low confidence urgency (< 0.45 or UNVERIFIED)
    if (claim.checkable && claim.aiConfidence < 0.45) {
      priorityScore += 50;
    } else if (claim.aiVerdict === Verdict.UNVERIFIED) {
      priorityScore += 40;
    } else if (claim.aiVerdict === Verdict.MISLEADING) {
      priorityScore += 35;
    }

    // 3. Status urgency
    if (claim.submission.status === SubmissionStatus.ESCALATED) {
      priorityScore += 60;
    } else if (claim.submission.status === SubmissionStatus.AI_SUGGESTED) {
      priorityScore += 20;
    }

    // 4. Age factor (older unreviewed claims gently rise)
    const ageHours = (Date.now() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60);
    priorityScore += Math.min(ageHours * 2, 20);

    return {
      id: claim.id,
      text: claim.text,
      language: claim.language,
      checkable: claim.checkable,
      aiVerdict: claim.aiVerdict,
      aiConfidence: claim.aiConfidence,
      aiReasoning: claim.aiReasoning,
      finalVerdict: claim.finalVerdict,
      finalNote: claim.finalNote,
      publishedAt: claim.publishedAt,
      createdAt: claim.createdAt,
      submission: claim.submission,
      evidenceCount: claim.evidence.length,
      duplicateCount,
      priorityScore: Math.round(priorityScore),
    };
  });

  // Apply requested sorting
  if (sort === "viral") {
    mappedItems.sort((a, b) => b.duplicateCount - a.duplicateCount || b.priorityScore - a.priorityScore);
  } else if (sort === "confidence_asc") {
    mappedItems.sort((a, b) => a.aiConfidence - b.aiConfidence || b.priorityScore - a.priorityScore);
  } else if (sort === "recency") {
    mappedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    // Default: "priority"
    mappedItems.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  const total = mappedItems.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginated = mappedItems.slice((page - 1) * limit, page * limit);

  return {
    items: paginated,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Adjudicates a claim with full transactional integrity:
 * Updates Claim, Submission status, creates ReviewAction, and writes immutable AuditLog.
 */
export async function adjudicateClaim({
  claimId,
  reviewerId,
  action,
  newVerdict,
  note,
}: ClaimAdjudicationInput & {
  claimId: string;
  reviewerId: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({
      where: { id: claimId },
      include: {
        submission: {
          include: { claims: true },
        },
      },
    });

    if (!claim) {
      throw new Error(`Claim #${claimId} not found.`);
    }

    const previousVerdict = claim.finalVerdict || claim.aiVerdict;
    let targetVerdict: Verdict | null = null;
    let finalNoteText = note?.trim() || null;
    let auditEvent = "CLAIM_REVIEWED";
    let actionType: ReviewActionType = ReviewActionType.APPROVE;

    if (action === "APPROVE") {
      actionType = ReviewActionType.APPROVE;
      targetVerdict = newVerdict || claim.aiVerdict;
      finalNoteText = finalNoteText || "Approved AI-suggested verdict without modification.";
      auditEvent = "CLAIM_APPROVED";
    } else if (action === "OVERRIDE") {
      actionType = ReviewActionType.OVERRIDE;
      if (!newVerdict) {
        throw new Error("New verdict is required when overriding AI suggestion.");
      }
      if (!finalNoteText || finalNoteText.length < 5) {
        throw new Error("A justification note (at least 5 characters) is required when overriding AI verdict.");
      }
      targetVerdict = newVerdict;
      auditEvent = "CLAIM_OVERRIDDEN";
    } else if (action === "ESCALATE") {
      actionType = ReviewActionType.ESCALATE;
      targetVerdict = null;
      finalNoteText = finalNoteText || "Claim escalated for senior administrative/legal review.";
      auditEvent = "CLAIM_ESCALATED";
    }

    const isPublished = action === "APPROVE" || action === "OVERRIDE";
    const publishedTimestamp = isPublished ? new Date() : null;

    // 1. Update the target claim
    const updatedClaim = await tx.claim.update({
      where: { id: claimId },
      data: {
        finalVerdict: targetVerdict,
        finalNote: finalNoteText,
        reviewedById: reviewerId,
        publishedAt: publishedTimestamp,
      },
      include: {
        submission: true,
        evidence: true,
        reviewedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // 2. Record ReviewAction
    const reviewAction = await tx.reviewAction.create({
      data: {
        claimId,
        reviewerId,
        action: actionType,
        fromVerdict: previousVerdict,
        toVerdict: targetVerdict,
        note: finalNoteText,
      },
    });

    // 3. Update Submission status based on sibling claims
    let newSubmissionStatus: SubmissionStatus = claim.submission.status;
    if (action === "ESCALATE") {
      newSubmissionStatus = SubmissionStatus.ESCALATED;
    } else {
      // Check if all checkable claims now have a finalVerdict
      const siblingClaims = await tx.claim.findMany({
        where: { submissionId: claim.submissionId },
      });
      const allCheckableDone = siblingClaims
        .filter((c) => c.checkable)
        .every((c) => (c.id === claimId ? targetVerdict !== null : c.finalVerdict !== null));

      if (allCheckableDone) {
        newSubmissionStatus = SubmissionStatus.PUBLISHED;
      } else {
        newSubmissionStatus = SubmissionStatus.IN_REVIEW;
      }
    }

    await tx.submission.update({
      where: { id: claim.submissionId },
      data: { status: newSubmissionStatus },
    });

    // 4. Write immutable AuditLog
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: reviewerId,
        event: auditEvent,
        entity: "Claim",
        entityId: claimId,
        metadata: {
          submissionId: claim.submissionId,
          action: actionType,
          fromVerdict: previousVerdict,
          toVerdict: targetVerdict,
          note: finalNoteText,
          publishedAt: publishedTimestamp,
          submissionStatus: newSubmissionStatus,
        },
      },
    });

    return {
      claim: updatedClaim,
      reviewAction,
      submissionStatus: newSubmissionStatus,
    };
  });
}
