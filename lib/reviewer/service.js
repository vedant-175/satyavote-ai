import { prisma } from "@/lib/db/prisma";

/**
 * Retrieves the reviewer queue with priority sorting, filters, and duplicate media calculation.
 * Module 4: Human Review & Public Reporting - Ayush
 */
export async function getReviewerQueue(query) {
  const { sort, status, type, verdict, page, limit } = query;

  const claimWhere = {};
  const submissionWhere = {};

  if (status !== "ALL") {
    if (status === "PUBLISHED") {
      claimWhere.finalVerdict = { not: null };
      claimWhere.publishedAt = { not: null };
    } else if (status === "AI_SUGGESTED") {
      claimWhere.finalVerdict = null;
      submissionWhere.status = "AI_SUGGESTED";
    } else if (status === "IN_REVIEW") {
      submissionWhere.status = "IN_REVIEW";
    } else if (status === "ESCALATED") {
      submissionWhere.status = "ESCALATED";
    }
  }

  if (type !== "ALL") {
    submissionWhere.type = type;
  }

  if (Object.keys(submissionWhere).length > 0) {
    claimWhere.submission = submissionWhere;
  }

  if (verdict !== "ALL") {
    claimWhere.aiVerdict = verdict;
  }

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
    take: 200,
  });

  const hashes = rawClaims
    .map((c) => c.submission.imageAnalysis?.perceptualHash)
    .filter(Boolean);

  const hashCounts = new Map();
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

  const mappedItems = rawClaims.map((claim) => {
    const hash = claim.submission.imageAnalysis?.perceptualHash;
    const duplicateCount = hash ? (hashCounts.get(hash) ?? 1) : 1;
    const isRecycled = (claim.submission.imageAnalysis?.flags || []).some((f) =>
      f.toLowerCase().includes("older") || f.toLowerCase().includes("recycled")
    );
    const isAiGenerated = (claim.submission.imageAnalysis?.aiGeneratedScore ?? 0) > 0.7;

    let priorityScore = 10;

    if (duplicateCount > 1) {
      priorityScore += Math.min(duplicateCount * 25, 100);
    }
    if (isRecycled) priorityScore += 40;
    if (isAiGenerated) priorityScore += 30;

    if (claim.checkable && claim.aiConfidence < 0.45) {
      priorityScore += 50;
    } else if (claim.aiVerdict === "UNVERIFIED") {
      priorityScore += 40;
    } else if (claim.aiVerdict === "MISLEADING") {
      priorityScore += 35;
    }

    if (claim.submission.status === "ESCALATED") {
      priorityScore += 60;
    } else if (claim.submission.status === "AI_SUGGESTED") {
      priorityScore += 20;
    }

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

  if (sort === "viral") {
    mappedItems.sort((a, b) => b.duplicateCount - a.duplicateCount || b.priorityScore - a.priorityScore);
  } else if (sort === "confidence_asc") {
    mappedItems.sort((a, b) => a.aiConfidence - b.aiConfidence || b.priorityScore - a.priorityScore);
  } else if (sort === "recency") {
    mappedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
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
    let targetVerdict = null;
    let finalNoteText = note?.trim() || null;
    let auditEvent = "CLAIM_REVIEWED";
    let actionType = "APPROVE";

    if (action === "APPROVE") {
      actionType = "APPROVE";
      targetVerdict = newVerdict || claim.aiVerdict;
      finalNoteText = finalNoteText || "Approved AI-suggested verdict without modification.";
      auditEvent = "CLAIM_APPROVED";
    } else if (action === "OVERRIDE") {
      actionType = "OVERRIDE";
      if (!newVerdict) {
        throw new Error("New verdict is required when overriding AI suggestion.");
      }
      if (!finalNoteText || finalNoteText.length < 5) {
        throw new Error("A justification note (at least 5 characters) is required when overriding AI verdict.");
      }
      targetVerdict = newVerdict;
      auditEvent = "CLAIM_OVERRIDDEN";
    } else if (action === "ESCALATE") {
      actionType = "ESCALATE";
      targetVerdict = null;
      finalNoteText = finalNoteText || "Claim escalated for senior administrative/legal review.";
      auditEvent = "CLAIM_ESCALATED";
    }

    const isPublished = action === "APPROVE" || action === "OVERRIDE";
    const publishedTimestamp = isPublished ? new Date() : null;

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

    let newSubmissionStatus = claim.submission.status;
    if (action === "ESCALATE") {
      newSubmissionStatus = "ESCALATED";
    } else {
      const siblingClaims = await tx.claim.findMany({
        where: { submissionId: claim.submissionId },
      });
      const allCheckableDone = siblingClaims
        .filter((c) => c.checkable)
        .every((c) => (c.id === claimId ? targetVerdict !== null : c.finalVerdict !== null));

      if (allCheckableDone) {
        newSubmissionStatus = "PUBLISHED";
      } else {
        newSubmissionStatus = "IN_REVIEW";
      }
    }

    await tx.submission.update({
      where: { id: claim.submissionId },
      data: { status: newSubmissionStatus },
    });

    await tx.auditLog.create({
      data: {
        actorType: "USER",
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
