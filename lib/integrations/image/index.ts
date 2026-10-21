import { prisma } from "../../db/prisma";
import { computePerceptualHash, isNearDuplicateImage } from "./perceptual-hash";
import { extractAndSanitizeExif, SanitizedExifData } from "./exif";
import { searchReverseImage, ReverseImageSearchResult } from "./reverse-search";
import { detectAiGeneratedImage, AiGenerationAssessment } from "./ai-detector";
import { extractTextFromImage, OcrResult } from "./ocr";

export interface ImageAnalysisResult {
  perceptualHash: string;
  isDuplicate: boolean;
  duplicateSubmissionId?: string | null;
  exif: SanitizedExifData;
  reverseSearch: ReverseImageSearchResult;
  aiGeneration: AiGenerationAssessment;
  ocr: OcrResult;
  flags: string[];
}

/**
 * Executes the complete forensic image verification pipeline:
 * 1. Perceptual Hashing (dHash) & Duplicate Verification
 * 2. EXIF Metadata Extraction & Privacy Sanitization
 * 3. Reverse Image Search (Earliest appearance & Recycled Media Detection)
 * 4. AI-Generated Image Likelihood Estimation (Clearly Labeled Estimate)
 * 5. OCR Poster Text Transcription for Claim Extraction
 */
export async function analyzeImageSubmission(
  imageBufferOrBase64: Buffer | string,
  userProvidedHint?: string | null,
  currentSubmissionId?: string
): Promise<ImageAnalysisResult> {
  const flags: string[] = [];

  // 1. Perceptual Hashing & Duplicate Detection
  const perceptualHash = computePerceptualHash(imageBufferOrBase64);

  let isDuplicate = false;
  let duplicateSubmissionId: string | null = null;

  try {
    const existing = await prisma.imageAnalysis.findFirst({
      where: {
        perceptualHash,
        ...(currentSubmissionId ? { submissionId: { not: currentSubmissionId } } : {}),
      },
      select: {
        submissionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      isDuplicate = true;
      duplicateSubmissionId = existing.submissionId;
      flags.push(
        `Duplicate Image Detected: Previously submitted for verification on ${existing.createdAt.toLocaleDateString()}.`
      );
    }
  } catch (err) {
    console.warn("[Image Analysis] Failed to query duplicate hashes:", err);
  }

  // 2. EXIF Extraction & Privacy Sanitization
  const exif = extractAndSanitizeExif(imageBufferOrBase64);

  if (exif.isOlderThanEvent && exif.captureDate) {
    flags.push(`Image appears older than the claimed event: EXIF timestamp is ${exif.captureDate}.`);
  }

  if (exif.software) {
    flags.push(`Image modified with external editing software: ${exif.software}.`);
  }

  // 3. Reverse Image Search & Historical Corroboration
  const reverseSearch = await searchReverseImage(imageBufferOrBase64);

  if (reverseSearch.isRecycledMedia && reverseSearch.earliestAppearanceDate) {
    flags.push(
      `Recycled Media: Earliest known online appearance was in ${reverseSearch.earliestAppearanceDate.slice(0, 4)}, but it is circulating as current election content.`
    );
  }

  // 4. AI Generation Likelihood Assessment
  const aiGeneration = await detectAiGeneratedImage(imageBufferOrBase64, exif.software);

  if (aiGeneration.isLikelyAiGenerated) {
    flags.push(`ESTIMATE: High likelihood of AI / synthetic media generation (${Math.round(aiGeneration.score * 100)}%).`);
  } else if (aiGeneration.confidenceTier === "MODERATE") {
    flags.push(`ESTIMATE: Inconclusive synthetic media markers (${Math.round(aiGeneration.score * 100)}%).`);
  }

  // 5. OCR Text Transcription
  const ocr = await extractTextFromImage(imageBufferOrBase64, userProvidedHint);

  if (!ocr.text || ocr.text.trim().length === 0) {
    flags.push("No legible text identified in the visual asset.");
  }

  return {
    perceptualHash,
    isDuplicate,
    duplicateSubmissionId,
    exif,
    reverseSearch,
    aiGeneration,
    ocr,
    flags,
  };
}
