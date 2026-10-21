import { prisma } from "../lib/db/prisma";
import { computePerceptualHash, calculateHammingDistance, isNearDuplicateImage } from "../lib/integrations/image/perceptual-hash";
import { extractAndSanitizeExif } from "../lib/integrations/image/exif";
import { searchReverseImage } from "../lib/integrations/image/reverse-search";
import { detectAiGeneratedImage } from "../lib/integrations/image/ai-detector";
import { extractTextFromImage } from "../lib/integrations/image/ocr";
import { analyzeImageSubmission } from "../lib/integrations/image/index";
import { runVerificationPipeline } from "../lib/pipeline/orchestrator";
import { SubmissionType, SubmissionStatus, PipelineRunStatus } from "@prisma/client";

async function runPhase4Tests() {
  console.log("========================================================");
  console.log("🧪 RUNNING PHASE 4 TEST SUITE: IMAGE ANALYSIS PIPELINE");
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

  // Sample synthetic election poster buffers for testing
  // Buffer 1: Old 2019 booth image with EXIF date and GPS tags
  const old2019PosterBuffer = Buffer.from(
    "FFD8FFE1005845786966000049492A0008000000" + // JPEG APP1 Exif header
    Buffer.from("2019:04:18 10:22:15").toString("hex") + // DateTimeOriginal 2019
    Buffer.from(" Apple iPhone 11 Pro ").toString("hex") + // Device
    Buffer.from(" GPSVersionID GPSLatitude ").toString("hex") + // GPS markers
    Buffer.from(" Election Commission of India Official Notification Voter ID ").toString("hex"),
    "hex"
  );

  // Buffer 2: AI-Generated synthetic flyer with Midjourney tag
  const aiGeneratedFlyerBuffer = Buffer.from(
    "FFD8FFE1005845786966000049492A0008000000" +
    Buffer.from("2024:03:15 14:00:00").toString("hex") +
    Buffer.from(" Midjourney v6 ").toString("hex") +
    Buffer.from(" 99% Battery in EVM Control Units indicates pre-rigged votes ").toString("hex"),
    "hex"
  );

  // TEST 1: Perceptual Hashing (dHash) & Hamming Distance
  console.log("--- 1. Perceptual Hashing & Hamming Distance Tests ---");
  const hash1 = computePerceptualHash(old2019PosterBuffer);
  const hash2 = computePerceptualHash(old2019PosterBuffer);
  const hash3 = computePerceptualHash(aiGeneratedFlyerBuffer);

  assert(typeof hash1 === "string" && hash1.length === 16, `Hash 1 is 16-hex characters: ${hash1}`);
  assert(hash1 === hash2, "Identical buffers produce identical perceptual hash");
  assert(calculateHammingDistance(hash1, hash2) === 0, "Identical image Hamming distance is 0");

  const diffDistance = calculateHammingDistance(hash1, hash3);
  assert(diffDistance > 0, `Different images produce non-zero Hamming distance (${diffDistance})`);
  assert(isNearDuplicateImage(hash1, hash2, 5) === true, "isNearDuplicateImage returns true for identical images");

  // TEST 2: EXIF Metadata Extraction & GPS Privacy Stripping
  console.log("\n--- 2. EXIF Extraction & GPS Privacy Stripping Tests ---");
  const exif = extractAndSanitizeExif(old2019PosterBuffer);

  assert(exif.captureDate === "2019-04-18 10:22:15", `EXIF capture date extracted: ${exif.captureDate}`);
  assert(exif.detectedYear === 2019, "EXIF year detected as 2019");
  assert(exif.isOlderThanEvent === true, "Image flagged as older than current election event");
  assert(exif.make === "Apple", "Device make detected as Apple");
  assert(exif.hasGps === true, "GPS presence accurately detected");
  assert(exif.gpsRedacted === true, "GPS coordinates flagged as stripped/redacted for public safety");

  // TEST 3: Reverse Image Search & Recycled Media Detection
  console.log("\n--- 3. Reverse Image Search Tests ---");
  const reverseSearchRecycled = await searchReverseImage(
    "data:image/jpeg;base64," + Buffer.from("recycled 2019 election booth").toString("base64")
  );
  assert(reverseSearchRecycled.totalMatches > 0, `Found ${reverseSearchRecycled.totalMatches} historical matches`);
  assert(reverseSearchRecycled.isRecycledMedia === true, "Old 2019 photo circulating in 2024 flagged as Recycled Media");
  assert(reverseSearchRecycled.earliestAppearanceDate?.startsWith("2019") ?? false, "Earliest known appearance verified in 2019");

  const reverseSearchFresh = await searchReverseImage(
    "data:image/jpeg;base64," + Buffer.from("fresh 2024 campaign poster").toString("base64")
  );
  assert(reverseSearchFresh.isRecycledMedia === false, "Current-cycle poster not flagged as recycled media");

  // TEST 4: AI-Generated Image Likelihood Estimation
  console.log("\n--- 4. AI-Generated Image Likelihood Assessment Tests ---");
  const aiAssessment = await detectAiGeneratedImage(aiGeneratedFlyerBuffer, "Midjourney v6");
  assert(aiAssessment.score >= 0.7, `AI likelihood score is high (${aiAssessment.score * 100}%)`);
  assert(aiAssessment.isLikelyAiGenerated === true, "Flagged as likely AI-generated");
  assert(aiAssessment.label.includes("ESTIMATE"), "Label explicitly contains 'ESTIMATE'");
  assert(aiAssessment.disclaimer.length > 20, "Verification ethics disclaimer attached");

  const naturalAssessment = await detectAiGeneratedImage(old2019PosterBuffer, null);
  assert(naturalAssessment.score < 0.4, `Natural photo score is low (${naturalAssessment.score * 100}%)`);
  assert(naturalAssessment.isLikelyAiGenerated === false, "Authentic photo not flagged as AI-generated");

  // TEST 5: OCR Poster Text Transcription
  console.log("\n--- 5. OCR Poster Text Transcription Tests ---");
  const ocrVoterId = await extractTextFromImage("data:image/jpeg;base64," + Buffer.from("voter id poster").toString("base64"));
  assert(ocrVoterId.text.length > 20, `OCR transcribed poster text (${ocrVoterId.text.length} chars)`);
  assert(/EPIC|voter/i.test(ocrVoterId.text), "OCR transcribed voter identification keywords");
  assert(ocrVoterId.confidence > 0.8, "OCR confidence above 80%");

  const ocrEvm = await extractTextFromImage("data:image/jpeg;base64," + Buffer.from("evm battery graphic").toString("base64"));
  assert(/battery|evm/i.test(ocrEvm.text), "OCR transcribed EVM battery keywords from flyer");

  // TEST 6: Unified Image Analysis & Duplicate Hashing in DB
  console.log("\n--- 6. Unified Image Analysis & Database Duplicate Check Tests ---");
  const initialAnalysis = await analyzeImageSubmission(old2019PosterBuffer);
  assert(initialAnalysis.perceptualHash === hash1, "Unified pipeline generated matching dHash");
  assert(initialAnalysis.flags.length > 0, `Unified analysis produced ${initialAnalysis.flags.length} warning flag(s)`);

  const hasOlderFlag = initialAnalysis.flags.some((f) => f.includes("older than the claimed event"));
  assert(hasOlderFlag, "Flags include: 'Image appears older than the claimed event'");

  // TEST 7: End-to-End Pipeline with Poster Image
  console.log("\n--- 7. End-to-End Image Verification Pipeline Execution ---");
  const testImageSub = await prisma.submission.create({
    data: {
      type: SubmissionType.IMAGE,
      imageUrl: "data:image/jpeg;base64," + old2019PosterBuffer.toString("base64"),
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const pipelineOutput = await runVerificationPipeline(testImageSub.id);
  assert(pipelineOutput.success === true, "Pipeline execution returned success=true");
  assert(pipelineOutput.status === SubmissionStatus.AI_SUGGESTED, "Pipeline advanced status to AI_SUGGESTED");
  assert(pipelineOutput.claimsCount > 0, `Extracted ${pipelineOutput.claimsCount} atomic claims from OCR text`);

  // Verify ImageAnalysis record in database
  const savedImageAnalysis = await prisma.imageAnalysis.findUnique({
    where: { submissionId: testImageSub.id },
  });
  assert(savedImageAnalysis !== null, "ImageAnalysis record persisted in PostgreSQL");
  assert(savedImageAnalysis?.perceptualHash === hash1, "ImageAnalysis perceptualHash matches");
  assert(typeof savedImageAnalysis?.ocrText === "string" && savedImageAnalysis.ocrText.length > 0, "OCR text persisted in database");
  assert((savedImageAnalysis?.flags.length ?? 0) > 0, `Persisted ${savedImageAnalysis?.flags.length} flags in database`);

  // Verify PipelineRun records
  const runs = await prisma.pipelineRun.findMany({
    where: { submissionId: testImageSub.id },
    orderBy: { startedAt: "asc" },
  });
  const stepNames = runs.map((r) => r.step);
  assert(stepNames.includes("IMAGE_ANALYSIS"), "IMAGE_ANALYSIS step logged in PipelineRun");
  assert(stepNames.includes("CONTENT_EXTRACTION"), "CONTENT_EXTRACTION step logged");
  assert(stepNames.includes("CLAIM_EXTRACTION"), "CLAIM_EXTRACTION step logged");
  assert(stepNames.includes("EVIDENCE_GATHERING"), "EVIDENCE_GATHERING step logged");

  const imageRun = runs.find((r) => r.step === "IMAGE_ANALYSIS");
  assert(imageRun?.status === PipelineRunStatus.COMPLETED, "IMAGE_ANALYSIS marked COMPLETED");

  // Verify Claims and Evidence generated from the image
  const claims = await prisma.claim.findMany({
    where: { submissionId: testImageSub.id },
    include: { evidence: true },
  });
  assert(claims.length > 0, "Claims extracted from image OCR text");
  assert(claims[0].evidence.length > 0, `First claim has ${claims[0].evidence.length} evidence rows gathered`);

  // TEST 8: Duplicate Image Detection on Second Submission
  console.log("\n--- 8. Duplicate Image Submission Detection ---");
  const duplicateImageSub = await prisma.submission.create({
    data: {
      type: SubmissionType.IMAGE,
      imageUrl: "data:image/jpeg;base64," + old2019PosterBuffer.toString("base64"),
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const dupPipelineOutput = await runVerificationPipeline(duplicateImageSub.id);
  assert(dupPipelineOutput.success === true, "Duplicate pipeline run succeeded");

  const dupAnalysis = await prisma.imageAnalysis.findUnique({
    where: { submissionId: duplicateImageSub.id },
  });
  const hasDupFlag = dupAnalysis?.flags.some((f) => f.includes("Duplicate Image Detected"));
  assert(hasDupFlag === true, "Flags include 'Duplicate Image Detected' on recirculated image");

  // Clean up test submissions
  await prisma.submission.delete({ where: { id: testImageSub.id } });
  await prisma.submission.delete({ where: { id: duplicateImageSub.id } });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 4 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests()
  .catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
