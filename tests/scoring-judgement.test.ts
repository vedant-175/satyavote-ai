import { prisma } from "../lib/db/prisma";
import {
  computeClaimScoreAndVerdict,
  aggregateSubmissionVerdicts,
  ScoredEvidenceInput,
} from "../lib/scoring/score";
import { SCORING_CONFIG } from "../config/scoring";
import {
  JUDGEMENT_PROMPT_VERSION,
  buildClaimJudgementPrompt,
  mockClaimJudgement,
} from "../lib/ai/prompts/judgement.v1";
import { claimJudgementResultSchema } from "../lib/ai/schemas";
import { runVerificationPipeline } from "../lib/pipeline/orchestrator";
import {
  Verdict,
  Stance,
  EvidenceKind,
  SubmissionType,
  SubmissionStatus,
  PipelineRunStatus,
} from "@prisma/client";

async function runPhase5Tests() {
  console.log("========================================================");
  console.log("🧪 RUNNING PHASE 5 TEST SUITE: AI JUDGEMENT & SCORING");
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

  // TEST 1: Zod Validation of Judgement Output Schema
  console.log("--- 1. Schema & Judgement Prompt Validation Tests ---");
  const validOutput = {
    verdict: Verdict.CONTRADICTED,
    confidence: 0.92,
    reasoning: "Debunked by Election Commission of India guidelines and PIB Fact Check alert.",
    usedEvidenceIds: ["ev-1", "ev-2"],
  };
  const parseResult = claimJudgementResultSchema.safeParse(validOutput);
  assert(parseResult.success === true, "Valid judgement payload conforms to claimJudgementResultSchema");

  const invalidOutput = {
    verdict: "INVALID_VERDICT",
    confidence: 1.5, // Exceeds 1.0
    reasoning: "Short",
  };
  const failParse = claimJudgementResultSchema.safeParse(invalidOutput);
  assert(failParse.success === false, "Invalid payload correctly rejected by Zod schema");

  const promptText = buildClaimJudgementPrompt({
    claimText: "Citizens without voter ID card cannot vote under any circumstances.",
    checkable: true,
    language: "en",
    evidence: [
      {
        id: "ev-1",
        kind: EvidenceKind.OFFICIAL,
        sourceName: "Election Commission of India (ECI)",
        title: "ECI Identification FAQ",
        snippet: "12 alternative documents permitted.",
        stance: Stance.CONTRADICTS,
      },
    ],
  });
  assert(promptText.includes("<CLAIM_TO_VERIFY>"), "Judgement prompt includes structured claim tag");
  assert(promptText.includes("<RETRIEVED_EVIDENCE_GROUNDING>"), "Judgement prompt strictly enforces retrieved evidence grounding");

  // TEST 2: Edge Case — Non-Checkable Claim
  console.log("\n--- 2. Edge Case: Non-Checkable Claim (Opinion/Prediction) ---");
  const nonCheckableResult = computeClaimScoreAndVerdict({
    text: "The candidate will deliver a much better future for young voters in 2029.",
    checkable: false,
    evidence: [],
  });
  assert(nonCheckableResult.verdict === Verdict.NOT_CHECKABLE, "Non-checkable claim assigned NOT_CHECKABLE");
  assert(nonCheckableResult.confidence === 1.0, "Non-checkable claim confidence is 1.0");
  assert(nonCheckableResult.reasoning.includes("opinion"), "Reasoning explicitly mentions opinion/prediction");

  // TEST 3: Edge Case — Hard Rule: Zero Evidence Found
  console.log("\n--- 3. Edge Case: Hard Rule — Zero Evidence Found ---");
  const zeroEvidenceResult = computeClaimScoreAndVerdict({
    text: "Secret underground tunnels connect polling booths in northern district.",
    checkable: true,
    evidence: [],
  });
  assert(zeroEvidenceResult.verdict === Verdict.UNVERIFIED, "Zero evidence claim falls to UNVERIFIED");
  assert(zeroEvidenceResult.confidence === 0.0, "Zero evidence claim confidence is 0.0");
  assert(zeroEvidenceResult.usedEvidenceIds.length === 0, "No evidence IDs cited");

  // TEST 4: Edge Case — Single Weak Uncorroborated Source (< Threshold)
  console.log("\n--- 4. Edge Case: Single Weak Source (< minConfidence) ---");
  const singleWeakSource: ScoredEvidenceInput[] = [
    {
      id: "ev-weak-1",
      kind: EvidenceKind.WEB,
      sourceName: "Random Personal Blog",
      title: "Rumor post on social media",
      snippet: "Some people are claiming an issue at a booth.",
      stance: Stance.CONTRADICTS,
      url: "https://unknown-blogger-site.xyz/post",
    },
  ];
  const weakResult = computeClaimScoreAndVerdict({
    text: "Booth voting was canceled in ward 4.",
    checkable: true,
    evidence: singleWeakSource,
  });
  assert(weakResult.verdict === Verdict.UNVERIFIED, "Single weak source claim correctly falls to UNVERIFIED");
  assert(weakResult.confidence < SCORING_CONFIG.thresholds.minConfidence, `Confidence (${weakResult.confidence}) is below minConfidence threshold (${SCORING_CONFIG.thresholds.minConfidence})`);
  assert(weakResult.reasoning.includes("Insufficient"), "Reasoning notes insufficient authoritative corroboration");

  // TEST 5: Edge Case — Conflicting Evidence
  console.log("\n--- 5. Edge Case: Conflicting Evidence Across Sources ---");
  const conflictingEvidence: ScoredEvidenceInput[] = [
    {
      id: "ev-c1",
      kind: EvidenceKind.WEB,
      sourceName: "News Outlet Alpha",
      title: "Voting hours were extended by 2 hours in district",
      snippet: "Local officers stated voting hours extended due to thunderstorm.",
      stance: Stance.SUPPORTS,
    },
    {
      id: "ev-c2",
      kind: EvidenceKind.WEB,
      sourceName: "News Outlet Beta",
      title: "Reports of extended voting hours denied by CEO",
      snippet: "Chief Electoral Officer denied extending voting hours in the district.",
      stance: Stance.CONTRADICTS,
    },
  ];
  const conflictResult = computeClaimScoreAndVerdict({
    text: "Voting hours were extended until 8 PM across the entire district.",
    checkable: true,
    evidence: conflictingEvidence,
  });
  assert(conflictResult.verdict === Verdict.MISLEADING, "Conflicting evidence claim classified as MISLEADING");
  assert(conflictResult.reasoning.includes("conflicting") || conflictResult.reasoning.includes("divergent"), "Reasoning articulates divergence across reporting");

  // TEST 6: Official Authority & Fact-Check Dominance (CONTRADICTED)
  console.log("\n--- 6. Official & Fact-Check Contradiction (CONTRADICTED) ---");
  const debunkedEvidence: ScoredEvidenceInput[] = [
    {
      id: "ev-pib",
      kind: EvidenceKind.OFFICIAL,
      sourceName: "PIB Fact Check Unit",
      title: "Viral notice on mandatory voter ID is fake",
      snippet: "PIB Clarification: Electors can vote using 12 approved photo ID cards.",
      stance: Stance.CONTRADICTS,
      url: "https://pib.gov.in/factcheck/voter-id",
    },
    {
      id: "ev-eci",
      kind: EvidenceKind.OFFICIAL,
      sourceName: "Election Commission of India (ECI)",
      title: "ECI Electors Handbook",
      snippet: "Electors without EPIC shall produce alternative photo ID documents.",
      stance: Stance.CONTRADICTS,
      url: "https://eci.gov.in/voter-id-rules",
    },
    {
      id: "ev-factcheck",
      kind: EvidenceKind.FACT_CHECK,
      sourceName: "Alt News",
      title: "Fact Check: Voter ID myth busted",
      snippet: "Claims that voters are turned away without EPIC are false.",
      stance: Stance.CONTRADICTS,
      url: "https://altnews.in/voter-id-myth",
    },
  ];
  const debunkedResult = computeClaimScoreAndVerdict({
    text: "Voters without physical EPIC card are strictly barred from voting in 2024.",
    checkable: true,
    evidence: debunkedEvidence,
  });
  assert(debunkedResult.verdict === Verdict.CONTRADICTED, "Authoritative debunk assigned CONTRADICTED");
  assert(debunkedResult.confidence >= SCORING_CONFIG.thresholds.highConfidence, `Confidence is high (${debunkedResult.confidence})`);
  assert(debunkedResult.usedEvidenceIds.includes("ev-pib"), "Cited PIB Fact Check evidence ID");
  assert(debunkedResult.usedEvidenceIds.includes("ev-eci"), "Cited ECI official evidence ID");

  // TEST 7: Official Corroboration (SUPPORTED)
  console.log("\n--- 7. Official Corroboration (SUPPORTED) ---");
  const supportedEvidence: ScoredEvidenceInput[] = [
    {
      id: "ev-sup-1",
      kind: EvidenceKind.OFFICIAL,
      sourceName: "Election Commission of India (ECI)",
      title: "ECI Notification: 12 Alternative Documents Permitted",
      snippet: "The Commission mandates that electors may use Aadhaar, Passport, or Driving License.",
      stance: Stance.SUPPORTS,
    },
    {
      id: "ev-sup-2",
      kind: EvidenceKind.WEB,
      sourceName: "The Hindu News",
      title: "ECI issues circular on alternative voter photo documents",
      snippet: "Commission reiterates list of valid voter identification documents.",
      stance: Stance.SUPPORTS,
    },
  ];
  const supportedResult = computeClaimScoreAndVerdict({
    text: "Electors registered on the voter roll may present Aadhaar card as photo identity at polling station.",
    checkable: true,
    evidence: supportedEvidence,
  });
  assert(supportedResult.verdict === Verdict.SUPPORTED, "Official corroborated claim assigned SUPPORTED");
  assert(supportedResult.confidence >= 0.70, `Confidence is robust (${supportedResult.confidence})`);
  assert(supportedResult.reasoning.includes("corroborated") || supportedResult.reasoning.includes("Election Commission"), "Reasoning explains official backing");

  // TEST 8: Image Forensics Discrepancy Impact
  console.log("\n--- 8. Image Forensics Impact on Claim Scoring ---");
  const recycledImageEvidence: ScoredEvidenceInput[] = [
    {
      id: "ev-rec-1",
      kind: EvidenceKind.WEB,
      sourceName: "Social Media Post",
      title: "Crowded polling booth in Mumbai today",
      snippet: "Massive queues outside polling booth 21.",
      stance: Stance.SUPPORTS,
    },
  ];
  const recycledResult = computeClaimScoreAndVerdict({
    text: "Long voter queues outside Mumbai polling station today.",
    checkable: true,
    evidence: recycledImageEvidence,
    imageFlags: [
      "Image appears older than the claimed event: EXIF timestamp is 2019-04-18 10:22:15.",
      "Recycled Media: Earliest known online appearance was in 2019, but it is circulating as current election content.",
    ],
  });
  assert(recycledResult.verdict !== Verdict.SUPPORTED, "Recycled image claim suppressed from SUPPORTED");
  assert(recycledResult.reasoning.includes("recycled") || recycledResult.verdict === Verdict.MISLEADING || recycledResult.verdict === Verdict.CONTRADICTED, "Forensic recycled media reflected in reasoning or verdict");

  // TEST 9: Submission-Level Summary Aggregation
  console.log("\n--- 9. Submission-Level Summary Aggregation Tests ---");
  const mockClaims = [
    { text: "Claim 1: EPIC mandatory", checkable: true, verdict: Verdict.CONTRADICTED, confidence: 0.95 },
    { text: "Claim 2: Aadhaar banned", checkable: true, verdict: Verdict.CONTRADICTED, confidence: 0.90 },
    { text: "Claim 3: Election will be great", checkable: false, verdict: Verdict.NOT_CHECKABLE, confidence: 1.0 },
  ];
  const summary = aggregateSubmissionVerdicts(mockClaims);
  assert(summary.summaryVerdict === Verdict.CONTRADICTED, "Aggregated summary verdict is CONTRADICTED");
  assert(summary.totalClaimsCount === 3, "Total claims counted accurately (3)");
  assert(summary.checkableClaimsCount === 2, "Checkable claims counted accurately (2)");
  assert(summary.overallConfidence > 0.85, `Overall confidence computed (${summary.overallConfidence})`);
  assert(summary.verdictCounts[Verdict.CONTRADICTED] === 2, "Verdict count for CONTRADICTED is 2");

  // TEST 10: Full End-to-End Pipeline Execution with Judgement & Status AI_SUGGESTED
  console.log("\n--- 10. End-to-End Pipeline Judgement & Database Verification ---");
  const testSub = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Claim: Electors without physical voter ID card are banned from voting in 2024 elections. ECI confirmed no other document is accepted.",
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const pipelineOutput = await runVerificationPipeline(testSub.id);
  assert(pipelineOutput.success === true, "Pipeline execution completed with success=true");
  assert(pipelineOutput.status === SubmissionStatus.AI_SUGGESTED, "Pipeline advanced status to AI_SUGGESTED");
  assert(pipelineOutput.summaryVerdict === Verdict.CONTRADICTED, "Submission summary verdict is CONTRADICTED");
  assert(typeof pipelineOutput.overallConfidence === "number" && pipelineOutput.overallConfidence > 0.7, `Submission overall confidence is high (${pipelineOutput.overallConfidence})`);

  // Verify PipelineRun records
  const runs = await prisma.pipelineRun.findMany({
    where: { submissionId: testSub.id },
    orderBy: { startedAt: "asc" },
  });
  const stepNames = runs.map((r) => r.step);
  assert(stepNames.includes("CONTENT_EXTRACTION"), "Step 1: CONTENT_EXTRACTION logged");
  assert(stepNames.includes("CLAIM_EXTRACTION"), "Step 2: CLAIM_EXTRACTION logged");
  assert(stepNames.includes("EMBEDDING_GENERATION"), "Step 3: EMBEDDING_GENERATION logged");
  assert(stepNames.includes("EVIDENCE_GATHERING"), "Step 4: EVIDENCE_GATHERING logged");
  assert(stepNames.includes("AI_JUDGEMENT"), "Step 5: AI_JUDGEMENT logged");

  const judgementRun = runs.find((r) => r.step === "AI_JUDGEMENT");
  assert(judgementRun?.status === PipelineRunStatus.COMPLETED, "AI_JUDGEMENT step marked COMPLETED");
  assert(judgementRun?.promptVersion === JUDGEMENT_PROMPT_VERSION, `AI_JUDGEMENT promptVersion recorded as ${JUDGEMENT_PROMPT_VERSION}`);

  // Verify Claims in database
  const claimsInDb = await prisma.claim.findMany({
    where: { submissionId: testSub.id },
    include: { evidence: true },
  });
  assert(claimsInDb.length > 0, `Extracted ${claimsInDb.length} claims in database`);

  for (const c of claimsInDb) {
    assert(c.aiVerdict !== Verdict.UNVERIFIED || !c.checkable, `Claim #${c.id.slice(0, 8)} aiVerdict assigned: ${c.aiVerdict}`);
    assert(c.aiConfidence > 0.5, `Claim #${c.id.slice(0, 8)} confidence is ${c.aiConfidence}`);
    assert(typeof c.aiReasoning === "string" && c.aiReasoning.length > 10, `Claim #${c.id.slice(0, 8)} has reasoning`);
    assert(c.evidence.length > 0, `Claim #${c.id.slice(0, 8)} has ${c.evidence.length} linked evidence records`);
  }

  // Verify AuditLog record
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: testSub.id },
  });
  const judgementAudit = auditLogs.find((a) => a.event === "PIPELINE_JUDGEMENT_COMPLETED");
  assert(judgementAudit !== undefined, "AuditLog recorded 'PIPELINE_JUDGEMENT_COMPLETED' event");

  // Clean up test submission
  await prisma.submission.delete({ where: { id: testSub.id } });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 5 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Tests()
  .catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
