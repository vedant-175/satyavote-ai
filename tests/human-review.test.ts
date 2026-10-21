import { prisma } from "../lib/db/prisma";
import {
  adjudicateClaim,
  getReviewerQueue,
} from "../lib/reviewer/service";
import {
  claimAdjudicationSchema,
  sourceProfileInputSchema,
  userRoleUpdateSchema,
} from "../lib/reviewer/schemas";
import {
  Role,
  Verdict,
  SubmissionType,
  SubmissionStatus,
  ActorType,
  ReviewActionType,
} from "@prisma/client";

async function runPhase6Tests() {
  console.log("========================================================");
  console.log("🧪 RUNNING PHASE 6 TEST SUITE: HUMAN REVIEW WORKFLOW");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Set up test users: Reviewer and Admin
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer.test@satyavote.internal" },
    update: { role: Role.REVIEWER },
    create: {
      name: "Test Reviewer",
      email: "reviewer.test@satyavote.internal",
      passwordHash: "test-hash",
      role: Role.REVIEWER,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin.test@satyavote.internal" },
    update: { role: Role.ADMIN },
    create: {
      name: "Test Administrator",
      email: "admin.test@satyavote.internal",
      passwordHash: "test-hash",
      role: Role.ADMIN,
    },
  });

  // TEST 1: Zod Schema Validation for Adjudication
  console.log("--- 1. Adjudication Schema & Validation Tests ---");
  const validApprove = claimAdjudicationSchema.safeParse({ action: "APPROVE" });
  assert(validApprove.success === true, "Valid APPROVE action passes without newVerdict");

  const invalidOverride = claimAdjudicationSchema.safeParse({ action: "OVERRIDE" });
  assert(invalidOverride.success === false, "OVERRIDE without newVerdict and note is rejected");

  const invalidOverrideShortNote = claimAdjudicationSchema.safeParse({
    action: "OVERRIDE",
    newVerdict: Verdict.SUPPORTED,
    note: "No", // < 5 chars
  });
  assert(invalidOverrideShortNote.success === false, "OVERRIDE with note < 5 characters is rejected");

  const validOverride = claimAdjudicationSchema.safeParse({
    action: "OVERRIDE",
    newVerdict: Verdict.MISLEADING,
    note: "Official press release clarified timing exception for rural polling booths.",
  });
  assert(validOverride.success === true, "Valid OVERRIDE with justification note passes validation");

  const invalidEscalate = claimAdjudicationSchema.safeParse({ action: "ESCALATE", note: "a" });
  assert(invalidEscalate.success === false, "ESCALATE with note < 3 characters is rejected");

  const validEscalate = claimAdjudicationSchema.safeParse({
    action: "ESCALATE",
    note: "Requires clarification from Chief Electoral Officer regarding special district orders.",
  });
  assert(validEscalate.success === true, "Valid ESCALATE with reason passes validation");

  // TEST 2: Reviewer Queue Sorting & Priority Scoring
  console.log("\n--- 2. Reviewer Queue Priority & Sorting Tests ---");

  // Create mock submissions with varied confidence, viral media, and age
  const testSub1 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Normal claim with moderate confidence.",
      status: SubmissionStatus.AI_SUGGESTED,
      claims: {
        create: {
          text: "Standard election declaration in district.",
          aiVerdict: Verdict.SUPPORTED,
          aiConfidence: 0.85,
          checkable: true,
        },
      },
    },
  });

  const testSub2 = await prisma.submission.create({
    data: {
      type: SubmissionType.IMAGE,
      rawText: "Viral recycled image claim.",
      status: SubmissionStatus.AI_SUGGESTED,
      imageAnalysis: {
        create: {
          perceptualHash: "a1b2c3d4e5f67890",
          flags: ["Recycled Media: Earliest known online appearance in 2019."],
          aiGeneratedScore: 0.15,
        },
      },
      claims: {
        create: {
          text: "Crowded polling station violence today.",
          aiVerdict: Verdict.CONTRADICTED,
          aiConfidence: 0.92,
          checkable: true,
        },
      },
    },
  });

  // Duplicate image with identical dHash to test viral ranking
  const testSub3 = await prisma.submission.create({
    data: {
      type: SubmissionType.IMAGE,
      rawText: "Duplicate circulation of viral image.",
      status: SubmissionStatus.AI_SUGGESTED,
      imageAnalysis: {
        create: {
          perceptualHash: "a1b2c3d4e5f67890", // Matching perceptual hash
          flags: ["Duplicate Image Detected."],
          aiGeneratedScore: 0.15,
        },
      },
      claims: {
        create: {
          text: "Another report of polling station queues.",
          aiVerdict: Verdict.CONTRADICTED,
          aiConfidence: 0.92,
          checkable: true,
        },
      },
    },
  });

  const testSub4 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Low confidence uncorroborated claim.",
      status: SubmissionStatus.AI_SUGGESTED,
      claims: {
        create: {
          text: "Secret counting center shifted overnight.",
          aiVerdict: Verdict.UNVERIFIED,
          aiConfidence: 0.12, // Low confidence
          checkable: true,
        },
      },
    },
  });

  // Query queue with "priority" sort
  const priorityQueue = await getReviewerQueue({
    sort: "priority",
    status: "AI_SUGGESTED",
    type: "ALL",
    verdict: "ALL",
    page: 1,
    limit: 20,
  });
  assert(priorityQueue.items.length >= 4, "Reviewer queue returns candidate claims");
  assert(priorityQueue.items[0].priorityScore >= priorityQueue.items[priorityQueue.items.length - 1].priorityScore, "Priority queue sorted in descending order of urgency");

  // Query queue with "viral" sort
  const viralQueue = await getReviewerQueue({
    sort: "viral",
    status: "AI_SUGGESTED",
    type: "ALL",
    verdict: "ALL",
    page: 1,
    limit: 20,
  });
  assert(viralQueue.items[0].duplicateCount >= 2, "Viral queue prioritizes recirculating duplicate media");

  // Query queue with "confidence_asc" sort
  const lowConfQueue = await getReviewerQueue({
    sort: "confidence_asc",
    status: "AI_SUGGESTED",
    type: "ALL",
    verdict: "ALL",
    page: 1,
    limit: 20,
  });
  assert(lowConfQueue.items[0].aiConfidence <= lowConfQueue.items[1].aiConfidence, "Confidence_asc queue prioritizes lowest confidence first");

  // TEST 3: One-Click Approve Action
  console.log("\n--- 3. One-Click Approve Action Tests ---");
  const claimToApprove = await prisma.claim.findFirst({
    where: { submissionId: testSub1.id },
  });
  assert(claimToApprove !== null, "Found test claim to approve");

  const approveResult = await adjudicateClaim({
    claimId: claimToApprove!.id,
    reviewerId: reviewer.id,
    action: "APPROVE",
    note: "Approved based on official gazette notice.",
  });

  assert(approveResult.claim.finalVerdict === claimToApprove!.aiVerdict, "Approved claim adopts aiVerdict as finalVerdict");
  assert(approveResult.claim.publishedAt !== null, "Approved claim has publishedAt timestamp set");
  assert(approveResult.claim.reviewedById === reviewer.id, "Claim reviewedById set to reviewer");
  assert(approveResult.reviewAction.action === ReviewActionType.APPROVE, "ReviewAction record logged with type APPROVE");
  assert(approveResult.submissionStatus === SubmissionStatus.PUBLISHED, "Submission status advanced to PUBLISHED");

  // Verify AuditLog for APPROVE
  const approveAudit = await prisma.auditLog.findFirst({
    where: { entityId: claimToApprove!.id, event: "CLAIM_APPROVED" },
  });
  assert(approveAudit !== null, "Immutable AuditLog recorded 'CLAIM_APPROVED' event");
  assert(approveAudit?.actorType === ActorType.USER, "AuditLog recorded actorType as USER");
  assert(approveAudit?.actorId === reviewer.id, "AuditLog attributed to reviewer ID");

  // TEST 4: Override Action with Mandatory Note
  console.log("\n--- 4. Override Action Tests ---");
  const claimToOverride = await prisma.claim.findFirst({
    where: { submissionId: testSub4.id },
  });
  assert(claimToOverride !== null, "Found test claim to override");

  // Attempt override without note via service (must throw)
  let threwWithoutNote = false;
  try {
    await adjudicateClaim({
      claimId: claimToOverride!.id,
      reviewerId: reviewer.id,
      action: "OVERRIDE",
      newVerdict: Verdict.CONTRADICTED,
      note: "bad", // < 5 chars
    });
  } catch {
    threwWithoutNote = true;
  }
  assert(threwWithoutNote, "AdjudicateClaim threw validation error when override note was too short");

  // Execute valid override
  const overrideResult = await adjudicateClaim({
    claimId: claimToOverride!.id,
    reviewerId: reviewer.id,
    action: "OVERRIDE",
    newVerdict: Verdict.CONTRADICTED,
    note: "Official district administration press conference confirmed counting center remains unchanged at statutory facility.",
  });

  assert(overrideResult.claim.finalVerdict === Verdict.CONTRADICTED, "Overridden claim has finalVerdict CONTRADICTED");
  assert(overrideResult.claim.finalNote?.includes("statutory facility") === true, "Overridden claim persists justification note");
  assert(overrideResult.reviewAction.action === ReviewActionType.OVERRIDE, "ReviewAction logged with type OVERRIDE");
  assert(overrideResult.reviewAction.fromVerdict === Verdict.UNVERIFIED, "ReviewAction logged fromVerdict correctly");
  assert(overrideResult.reviewAction.toVerdict === Verdict.CONTRADICTED, "ReviewAction logged toVerdict correctly");

  // Verify AuditLog for OVERRIDE
  const overrideAudit = await prisma.auditLog.findFirst({
    where: { entityId: claimToOverride!.id, event: "CLAIM_OVERRIDDEN" },
  });
  assert(overrideAudit !== null, "Immutable AuditLog recorded 'CLAIM_OVERRIDDEN' event");

  // TEST 5: Escalate Action
  console.log("\n--- 5. Escalate Action Tests ---");
  const claimToEscalate = await prisma.claim.findFirst({
    where: { submissionId: testSub2.id },
  });

  const escalateResult = await adjudicateClaim({
    claimId: claimToEscalate!.id,
    reviewerId: reviewer.id,
    action: "ESCALATE",
    note: "Requires legal review on whether video footage breaches silence period regulations.",
  });

  assert(escalateResult.submissionStatus === SubmissionStatus.ESCALATED, "Submission status advanced to ESCALATED");
  assert(escalateResult.claim.finalVerdict === null, "Escalated claim is not finalized or published");
  assert(escalateResult.reviewAction.action === ReviewActionType.ESCALATE, "ReviewAction logged with type ESCALATE");

  const escalateAudit = await prisma.auditLog.findFirst({
    where: { entityId: claimToEscalate!.id, event: "CLAIM_ESCALATED" },
  });
  assert(escalateAudit !== null, "Immutable AuditLog recorded 'CLAIM_ESCALATED' event");

  // TEST 6: Admin User & Role Management
  console.log("\n--- 6. Admin User & Role Management Tests ---");
  const tempUser = await prisma.user.create({
    data: {
      name: "Temporary Staff",
      email: "temp.staff@satyavote.internal",
      passwordHash: "test-hash",
      role: Role.SUBMITTER,
    },
  });

  // Promote user to REVIEWER
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tempUser.id },
      data: { role: Role.REVIEWER },
    });
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: admin.id,
        event: "USER_ROLE_UPDATED",
        entity: "User",
        entityId: tempUser.id,
        metadata: {
          targetEmail: tempUser.email,
          oldRole: "SUBMITTER",
          newRole: "REVIEWER",
        },
      },
    });
  });

  const updatedStaff = await prisma.user.findUnique({ where: { id: tempUser.id } });
  assert(updatedStaff?.role === Role.REVIEWER, "Staff role successfully updated to REVIEWER");

  const roleAudit = await prisma.auditLog.findFirst({
    where: { entityId: tempUser.id, event: "USER_ROLE_UPDATED" },
  });
  assert(roleAudit !== null, "AuditLog recorded 'USER_ROLE_UPDATED' event");

  // TEST 7: Admin Source Profile Allowlist Editor
  console.log("\n--- 7. Admin Source Profile Allowlist Editor Tests ---");
  const testDomain = "press-factcheck.gov.in";

  // Create SourceProfile
  const createdProfile = await prisma.$transaction(async (tx) => {
    const sp = await tx.sourceProfile.create({
      data: {
        domain: testDomain,
        reputationTier: "OFFICIAL",
        ageDays: 3200,
        notes: "Official State Press Bureau Verification Wing",
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: admin.id,
        event: "SOURCE_PROFILE_CREATED",
        entity: "SourceProfile",
        entityId: sp.id,
        metadata: { domain: testDomain, tier: "OFFICIAL" },
      },
    });
    return sp;
  });
  assert(createdProfile.domain === testDomain, "SourceProfile record created in database");

  // Update SourceProfile Tier
  await prisma.$transaction(async (tx) => {
    await tx.sourceProfile.update({
      where: { id: createdProfile.id },
      data: { reputationTier: "CERTIFIED_FACT_CHECKER" },
    });
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: admin.id,
        event: "SOURCE_PROFILE_UPDATED",
        entity: "SourceProfile",
        entityId: createdProfile.id,
        metadata: { domain: testDomain, newTier: "CERTIFIED_FACT_CHECKER" },
      },
    });
  });

  const updatedSource = await prisma.sourceProfile.findUnique({ where: { id: createdProfile.id } });
  assert(updatedSource?.reputationTier === "CERTIFIED_FACT_CHECKER", "SourceProfile reputationTier updated");

  // Delete SourceProfile
  await prisma.$transaction(async (tx) => {
    await tx.sourceProfile.delete({ where: { id: createdProfile.id } });
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: admin.id,
        event: "SOURCE_PROFILE_DELETED",
        entity: "SourceProfile",
        entityId: createdProfile.id,
        metadata: { domain: testDomain },
      },
    });
  });

  const deletedCheck = await prisma.sourceProfile.findUnique({ where: { id: createdProfile.id } });
  assert(deletedCheck === null, "SourceProfile successfully deleted");

  const sourceAudit = await prisma.auditLog.findFirst({
    where: { entityId: createdProfile.id, event: "SOURCE_PROFILE_DELETED" },
  });
  assert(sourceAudit !== null, "AuditLog recorded 'SOURCE_PROFILE_DELETED' event");

  // TEST 8: Done When — Only Reviewer-Approved Claims Are Public
  console.log("\n--- 8. Public Verification Catalog Constraint Tests ---");

  // Unapproved claim (claimToEscalate has finalVerdict=null, publishedAt=null)
  const publicUnapproved = await prisma.claim.findFirst({
    where: {
      id: claimToEscalate!.id,
      finalVerdict: { not: null },
      publishedAt: { not: null },
    },
  });
  assert(publicUnapproved === null, "Done When: Unapproved/Escalated claim is NOT visible in public database");

  // Approved claim (claimToApprove has finalVerdict, publishedAt)
  const publicApproved = await prisma.claim.findFirst({
    where: {
      id: claimToApprove!.id,
      finalVerdict: { not: null },
      publishedAt: { not: null },
    },
  });
  assert(publicApproved !== null, "Done When: Reviewer-approved claim is visible in public database");

  // Clean up mock submissions & temp staff
  await prisma.submission.deleteMany({
    where: { id: { in: [testSub1.id, testSub2.id, testSub3.id, testSub4.id] } },
  });
  await prisma.user.delete({ where: { id: tempUser.id } });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 6 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests()
  .catch((err) => {
    console.error("Phase 6 test runner crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
