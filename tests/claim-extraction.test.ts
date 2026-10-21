import { prisma } from "../lib/db/prisma";
import { detectLanguage, normalizeToEnglish } from "../lib/integrations/translate";
import { scrapeArticleFromUrl } from "../lib/integrations/scrape";
import { generateEmbedding, cosineSimilarity } from "../lib/ai/provider";
import { runVerificationPipeline } from "../lib/pipeline/orchestrator";
import { PROMPT_VERSION, mockClaimExtraction } from "../lib/ai/prompts/claim-extraction.v1";
import { SubmissionType, SubmissionStatus, PipelineRunStatus } from "@prisma/client";

async function runPhase2Tests() {
  console.log("==================================================");
  console.log("🧪 RUNNING PHASE 2 TEST SUITE: EXTRACTION & CLAIMS");
  console.log("==================================================\n");

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

  // TEST 1: Language Detection
  console.log("--- 1. Language Detection Tests ---");
  const langEn = detectLanguage("ECI announces that voter slips with QR codes will be distributed.");
  assert(langEn === "en", "English text accurately detected as 'en'");

  const langHi = detectLanguage("चुनाव आयोग ने मतदान का समय बढ़ाने की घोषणा की है।");
  assert(langHi === "hi", "Devanagari text accurately detected as 'hi'");

  const langPa = detectLanguage("ਚੋਣ ਕਮਿਸ਼ਨ ਵੱਲੋਂ ਵੋਟਰ ਕਾਰਡ ਬਾਰੇ ਨਵੀਆਂ ਹਦਾਇਤਾਂ ਜਾਰੀ ਕੀਤੀਆਂ ਗਈਆਂ ਹਨ।");
  assert(langPa === "pa", "Gurmukhi text accurately detected as 'pa'");

  // TEST 2: Multilingual Translation & Normalization
  console.log("\n--- 2. Multilingual Normalization Tests ---");
  const transHi = await normalizeToEnglish("सोशल मीडिया पर दावा किया जा रहा है कि 99% बैटरी वाली ईवीएम में पहले से वोट सेट किए गए हैं");
  assert(transHi.detectedLanguage === "hi", "Hindi claim flagged with correct source language");
  assert(/EVM|battery|vote/i.test(transHi.englishText), "Hindi election keywords mapped to English");

  const transPa = await normalizeToEnglish("ਦਾਅਵਾ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ ਕਿ ਜਿਨ੍ਹਾਂ ਵੋਟਰਾਂ ਕੋਲ ਆਧਾਰ ਕਾਰਡ ਨਹੀਂ ਹੈ ਉਹ ਵੋਟ ਨਹੀਂ ਪਾ ਸਕਦੇ");
  assert(transPa.detectedLanguage === "pa", "Punjabi claim flagged with correct source language");
  assert(/Aadhaar|vote/i.test(transPa.englishText), "Punjabi election keywords mapped to English");

  // TEST 3: Web Article Scraping
  console.log("\n--- 3. Article Scraping Tests ---");
  const scraped = await scrapeArticleFromUrl("https://example.com/mock-eci-announcement");
  assert(scraped.title.length > 0, `Article title extracted: "${scraped.title.slice(0, 40)}..."`);
  assert(scraped.mainText.length > 50, `Main text extracted (${scraped.mainText.length} chars)`);
  assert(!scraped.mainText.includes("<script>"), "Scripts and HTML tags stripped cleanly");

  // TEST 4: Vector Embeddings & Cosine Similarity
  console.log("\n--- 4. Semantic Embedding & Vector Tests ---");
  const embed1 = await generateEmbedding("Voters without voter ID can use alternative photo identity documents.");
  const embed2 = await generateEmbedding("Voters without voter ID can use alternative photo identity documents.");
  const embedSimilar = await generateEmbedding("Citizens missing EPIC card may produce Aadhaar or passport at polling booth.");
  const embedUnrelated = await generateEmbedding("The cricket team won the championship match yesterday in Mumbai.");

  assert(embed1.length === 128, `Embedding vector length is 128 dimensions`);

  const simIdentical = cosineSimilarity(embed1, embed2);
  assert(Math.abs(simIdentical - 1.0) < 0.001, `Identical text cosine similarity is ~1.0 (${simIdentical.toFixed(3)})`);

  const simSemantics = cosineSimilarity(embed1, embedSimilar);
  const simUnrelated = cosineSimilarity(embed1, embedUnrelated);
  assert(
    simSemantics > simUnrelated,
    `Related election claims have higher similarity (${simSemantics.toFixed(3)}) than unrelated sports text (${simUnrelated.toFixed(3)})`
  );

  // TEST 5: Prompt Versioning & Opinion vs Fact Checkability
  console.log("\n--- 5. Claim Extraction Prompt & Checkability Discrimination ---");
  assert(PROMPT_VERSION === "claim-extraction.v1", "Prompt version constant is 'claim-extraction.v1'");

  const mockExtraction = mockClaimExtraction(
    "ECI requires all voters to show voter ID. I think candidate X is the greatest leader ever and will win easily."
  );
  assert(mockExtraction.claims.length >= 2, `Extracted ${mockExtraction.claims.length} atomic claims`);

  const factualClaim = mockExtraction.claims.find((c) => c.type === "FACTUAL" || c.type === "PROCEDURAL");
  const opinionClaim = mockExtraction.claims.find((c) => c.type === "OPINION" || c.type === "PREDICTION");

  assert(factualClaim?.checkable === true, "Factual claim marked checkable = true");
  if (opinionClaim) {
    assert(opinionClaim.checkable === false, "Subjective opinion/prediction marked checkable = false");
  }

  // TEST 6: End-to-End Pipeline Orchestrator Execution
  console.log("\n--- 6. End-to-End Pipeline Orchestration & Database State ---");
  const testSub = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "ECI announcement: Electronic Voting Machines (EVM) batteries with 99% charge contain pre-recorded votes according to viral posts.",
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const pipelineOutput = await runVerificationPipeline(testSub.id);

  assert(pipelineOutput.success === true, "Pipeline completed with success = true");
  assert(pipelineOutput.claimsCount >= 1, `Extracted ${pipelineOutput.claimsCount} claims in database`);
  assert(pipelineOutput.status === SubmissionStatus.AI_SUGGESTED, "Submission status progressed to AI_SUGGESTED");

  // Verify PipelineRun records
  const runs = await prisma.pipelineRun.findMany({
    where: { submissionId: testSub.id },
    orderBy: { startedAt: "asc" },
  });

  assert(runs.length >= 3, `Logged ${runs.length} PipelineRun steps in database`);

  const step1 = runs.find((r) => r.step === "CONTENT_EXTRACTION");
  const step2 = runs.find((r) => r.step === "CLAIM_EXTRACTION");
  const step3 = runs.find((r) => r.step === "EMBEDDING_GENERATION");

  assert(step1?.status === PipelineRunStatus.COMPLETED, "Step 1 (CONTENT_EXTRACTION) completed");
  assert(step2?.status === PipelineRunStatus.COMPLETED, "Step 2 (CLAIM_EXTRACTION) completed");
  assert(step2?.promptVersion === PROMPT_VERSION, `Step 2 recorded promptVersion = ${PROMPT_VERSION}`);
  assert(step3?.status === PipelineRunStatus.COMPLETED, "Step 3 (EMBEDDING_GENERATION) completed");

  // Verify Claims in Database
  const dbClaims = await prisma.claim.findMany({
    where: { submissionId: testSub.id },
  });

  assert(dbClaims.length >= 1, `Verified ${dbClaims.length} Claim records saved in database`);
  assert(["UNVERIFIED", "CONTRADICTED", "SUPPORTED", "MISLEADING", "NOT_CHECKABLE"].includes(dbClaims[0].aiVerdict), `Claim has valid aiVerdict assigned (${dbClaims[0].aiVerdict})`);

  console.log("\n==================================================");
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase2Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
