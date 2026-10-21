import { prisma } from "../lib/db/prisma";
import {
  classifyClaimTopicAndState,
  findSimilarPublishedClaim,
  registerClaimRecurrence,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "../lib/claims/matching";
import { generateEmbedding } from "../lib/ai/provider";
import { runVerificationPipeline } from "../lib/pipeline/orchestrator";
import {
  Verdict,
  SubmissionType,
  SubmissionStatus,
  EvidenceKind,
  Stance,
  Role,
} from "@prisma/client";

async function runPhase7Tests() {
  console.log("========================================================");
  console.log("🧪 RUNNING PHASE 7 TEST SUITE: DUPLICATE DETECTION & PUBLIC CLAIMS");
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

  // TEST 1: Topic & State Jurisdiction Classification
  console.log("--- 1. Automated Topic & State Classification Tests ---");
  const evmClass = classifyClaimTopicAndState("Viral claim: EVM battery tampering in Mumbai polling booth.");
  assert(evmClass.topic === "EVM & Voting Technology", "EVM statement classified under 'EVM & Voting Technology'");
  assert(evmClass.state === "Maharashtra", "Mumbai location resolved to 'Maharashtra' jurisdiction");

  const voterIdClass = classifyClaimTopicAndState("Voters must bring physical voter ID or EPIC card in Uttar Pradesh.");
  assert(voterIdClass.topic === "Voter Identification & Rolls", "Voter ID statement classified under 'Voter Identification & Rolls'");
  assert(voterIdClass.state === "Uttar Pradesh", "Resolved 'Uttar Pradesh' jurisdiction");

  const mccClass = classifyClaimTopicAndState("Cash and liquor distributed at election rally in Amritsar.");
  assert(mccClass.topic === "Model Code of Conduct", "Cash distribution classified under 'Model Code of Conduct'");
  assert(mccClass.state === "Punjab", "Amritsar location resolved to 'Punjab' jurisdiction");

  const generalClass = classifyClaimTopicAndState("Chief Election Commissioner addressed general press conference.");
  assert(generalClass.topic === "General Election Information", "General election announcement classified under 'General Election Information'");
  assert(generalClass.state === "National", "Default jurisdiction resolved to 'National'");

  // TEST 2: Vector Similarity & Duplicate Retrieval
  console.log("\n--- 2. Vector Similarity Matching Tests ---");

  // Create an initial verified published claim in the database
  const canonicalText = "Citizens without a physical voter ID card cannot vote under any circumstances.";
  const canonicalEmbedding = await generateEmbedding(canonicalText);

  const reviewerUser = await prisma.user.upsert({
    where: { email: "reviewer.phase7@satyavote.internal" },
    update: {},
    create: {
      name: "Fact Checker Phase 7",
      email: "reviewer.phase7@satyavote.internal",
      passwordHash: "hash-7",
      role: Role.REVIEWER,
    },
  });

  const canonicalSub = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: canonicalText,
      status: SubmissionStatus.PUBLISHED,
      claims: {
        create: {
          text: canonicalText,
          embedding: canonicalEmbedding,
          aiVerdict: Verdict.CONTRADICTED,
          aiConfidence: 0.98,
          finalVerdict: Verdict.CONTRADICTED,
          finalNote: "Debunked: ECI statutory instructions allow 12 alternative photo documents including Aadhaar and Passport.",
          reviewedById: reviewerUser.id,
          publishedAt: new Date(),
          topic: "Voter Identification & Rolls",
          state: "National",
          repeatCount: 1,
          evidence: {
            create: [
              {
                kind: EvidenceKind.OFFICIAL,
                sourceName: "Election Commission of India (ECI)",
                title: "Statutory identification guidelines",
                snippet: "Electors may present 12 alternative documents including Aadhaar card.",
                stance: Stance.CONTRADICTS,
                url: "https://eci.gov.in/rules",
              },
            ],
          },
        },
      },
    },
    include: { claims: true },
  });

  const canonicalClaim = canonicalSub.claims[0];
  assert(canonicalClaim !== undefined, "Canonical verified claim created in database");

  // Near-duplicate query text (different wording, same atomic claim)
  const rephrasedText = "Electors without physical voter ID card are barred from voting in 2024.";
  const queryEmbedding = await generateEmbedding(rephrasedText);

  const matchResult = await findSimilarPublishedClaim(
    queryEmbedding,
    DEFAULT_SIMILARITY_THRESHOLD,
    canonicalClaim.id + "-dummy"
  );

  assert(matchResult.matchFound === true, "Vector search found similar published claim");
  assert(matchResult.matchedClaim?.id === canonicalClaim.id, "Matched correct canonical claim ID");
  assert(matchResult.similarityScore >= DEFAULT_SIMILARITY_THRESHOLD, `Similarity score (${matchResult.similarityScore}) exceeds threshold (${DEFAULT_SIMILARITY_THRESHOLD})`);
  assert(matchResult.matchedClaim?.finalVerdict === Verdict.CONTRADICTED, "Retrieved verified finalVerdict CONTRADICTED");

  // Non-matching distinct query
  const unrelatedText = "All schools will remain closed for summer holidays in July.";
  const unrelatedEmbedding = await generateEmbedding(unrelatedText);
  const noMatchResult = await findSimilarPublishedClaim(unrelatedEmbedding, DEFAULT_SIMILARITY_THRESHOLD);
  assert(noMatchResult.matchFound === false, "Unrelated claim does not trigger false-positive match");

  // TEST 3: Repeat Submission Counter & Recirculation Tracking
  console.log("\n--- 3. Repeat Submission Counter & Virality Tests ---");
  const countAfter1 = await registerClaimRecurrence(canonicalClaim.id, "sub-resubmit-1", 0.92);
  assert(countAfter1 === 2, "Repeat count incremented to 2");

  const countAfter2 = await registerClaimRecurrence(canonicalClaim.id, "sub-resubmit-2", 0.94);
  assert(countAfter2 === 3, "Repeat count incremented to 3");

  const viralClaim = await prisma.claim.findUnique({ where: { id: canonicalClaim.id } });
  assert((viralClaim?.repeatCount ?? 0) >= 3, "Repeat count persisted in PostgreSQL");

  const recirculationAudit = await prisma.auditLog.findFirst({
    where: { entityId: canonicalClaim.id, event: "CLAIM_RECIRCULATION_DETECTED" },
    orderBy: { createdAt: "desc" },
  });
  assert(recirculationAudit !== null, "AuditLog recorded 'CLAIM_RECIRCULATION_DETECTED'");
  assert((recirculationAudit?.metadata as any)?.isViral === true, "AuditLog flagged viral recirculation (repeatCount >= 3)");

  // TEST 4: End-to-End Pipeline Knowledge Reuse ("Done When")
  console.log("\n--- 4. End-to-End Pipeline Knowledge Reuse (Instant Surface) ---");
  const resubmission = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Citizens without voter ID card are strictly barred from voting in this election.",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const pipelineOutput = await runVerificationPipeline(resubmission.id);
  assert(pipelineOutput.success === true, "Pipeline execution succeeded on resubmission");

  // Check claims of the new submission
  const resubClaims = await prisma.claim.findMany({
    where: { submissionId: resubmission.id },
    include: { evidence: true },
  });

  assert(resubClaims.length > 0, "Extracted claims from resubmitted text");
  const matchedClaimInNewSub = resubClaims.find((c) => c.matchedClaimId === canonicalClaim.id);
  assert(matchedClaimInNewSub !== undefined, "Done When: Pipeline surfaced previous verified claim via matchedClaimId");
  assert(matchedClaimInNewSub!.aiVerdict === Verdict.CONTRADICTED, "Adopted verified verdict CONTRADICTED");
  assert((matchedClaimInNewSub?.aiConfidence ?? 0) >= 0.95, `Confidence is high (${matchedClaimInNewSub?.aiConfidence})`);
  assert(matchedClaimInNewSub?.aiReasoning?.includes("Similar claim already verified") === true, "Reasoning indicates similar claim already verified by human fact-checker");
  assert((matchedClaimInNewSub?.evidence?.length ?? 0) > 0, "Adopted verified evidence citations from canonical claim");

  // TEST 5: Public Claims Query & Filtering
  console.log("\n--- 5. Public Claims Library Query & Filters Tests ---");
  const publishedCount = await prisma.claim.count({
    where: {
      finalVerdict: { not: null },
      publishedAt: { not: null },
    },
  });
  assert(publishedCount > 0, "Public catalog contains published claims");

  // Filter by Verdict CONTRADICTED
  const contradictedClaims = await prisma.claim.findMany({
    where: {
      finalVerdict: Verdict.CONTRADICTED,
      publishedAt: { not: null },
    },
  });
  assert(contradictedClaims.length > 0, "Filtering by verdict CONTRADICTED returns matching claims");

  // Filter by Topic "Voter Identification & Rolls"
  const topicClaims = await prisma.claim.findMany({
    where: {
      topic: "Voter Identification & Rolls",
      finalVerdict: { not: null },
    },
  });
  assert(topicClaims.length > 0, "Filtering by topic 'Voter Identification & Rolls' succeeds");

  // Sorting by Virality (repeatCount desc)
  const viralClaimsSorted = await prisma.claim.findMany({
    where: { finalVerdict: { not: null }, publishedAt: { not: null } },
    orderBy: { repeatCount: "desc" },
  });
  assert(viralClaimsSorted[0].repeatCount >= 3, "Viral sort surfaces canonical claim with highest repeatCount first");

  // Clean up mock submissions
  await prisma.submission.deleteMany({
    where: { id: { in: [canonicalSub.id, resubmission.id] } },
  });
  await prisma.user.delete({ where: { id: reviewerUser.id } });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 7 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7Tests()
  .catch((err) => {
    console.error("Phase 7 test runner crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
