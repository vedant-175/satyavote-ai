import { prisma } from "../db/prisma";
import { scrapeArticleFromUrl } from "../integrations/scrape";
import { normalizeToEnglish, detectLanguage } from "../integrations/translate";
import { generateStructuredCompletion, generateEmbedding } from "../ai/provider";
import {
  PROMPT_VERSION,
  CLAIM_EXTRACTION_SYSTEM_PROMPT,
  buildClaimExtractionPrompt,
  mockClaimExtraction,
} from "../ai/prompts/claim-extraction.v1";
import { claimExtractionResultSchema, claimJudgementResultSchema } from "../ai/schemas";
import {
  JUDGEMENT_PROMPT_VERSION,
  CLAIM_JUDGEMENT_SYSTEM_PROMPT,
  buildClaimJudgementPrompt,
  mockClaimJudgement,
} from "../ai/prompts/judgement.v1";
import { aggregateSubmissionVerdicts } from "../scoring/score";
import { searchFactCheckDatabase } from "../integrations/factcheck";
import { searchWeb } from "../integrations/search";
import { searchOfficialEci } from "../integrations/eci";
import { searchOfficialPib } from "../integrations/pib";
import { analyzeDomainCredibility } from "../integrations/whois";
import { analyzeImageSubmission } from "../integrations/image";
import {
  classifyClaimTopicAndState,
  findSimilarPublishedClaim,
  registerClaimRecurrence,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "../claims/matching";

/**
 * Executes the complete AI Verification Pipeline (Module 3 - Vedant).
 * Step 1: Content Extraction / Scrape / Image OCR
 * Step 2: Atomic Claim Extraction (Gemini / Claude / Mock)
 * Step 3: 128-dim Embedding Generation & DB Claim Creation
 * Step 4: Multi-Source Evidence Gathering (ECI, PIB, FactCheck, Web, Whois) in parallel
 * Step 5: Evidence-grounded scoring & Aggregated Submission Verdict
 */
export async function runVerificationPipeline(submissionId) {
  const startTime = Date.now();
  console.log(`[Pipeline] Initiating pipeline for submission #${submissionId}`);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error(`Submission #${submissionId} not found.`);
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "PROCESSING" },
  });

  let rawContent = submission.rawText || "";
  let workingLanguage = submission.language || "en";

  // STEP 1: CONTENT EXTRACTION
  const step1Run = await prisma.pipelineRun.create({
    data: {
      submissionId,
      step: "CONTENT_EXTRACTION",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    if (submission.type === "LINK" && submission.url) {
      console.log(`[Pipeline] Scraping web article from ${submission.url}`);
      const article = await scrapeArticleFromUrl(submission.url);
      rawContent = `${article.title}\n\n${article.mainText}`;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          rawText: rawContent.slice(0, 15000),
        },
      });
    } else if (submission.type === "IMAGE" && submission.imageUrl) {
      console.log(`[Pipeline] Performing forensic image analysis for submission #${submissionId}`);
      const imageRun = await prisma.pipelineRun.create({
        data: {
          submissionId,
          step: "IMAGE_ANALYSIS",
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      try {
        const imageAnalysis = await analyzeImageSubmission(
          submission.imageUrl,
          submission.rawText,
          submission.id
        );

        await prisma.imageAnalysis.upsert({
          where: { submissionId },
          update: {
            ocrText: imageAnalysis.ocr.text,
            exifJson: imageAnalysis.exif,
            reverseSearchJson: imageAnalysis.reverseSearch,
            aiGeneratedScore: imageAnalysis.aiGeneration.score,
            perceptualHash: imageAnalysis.perceptualHash,
            flags: imageAnalysis.flags,
          },
          create: {
            submissionId,
            ocrText: imageAnalysis.ocr.text,
            exifJson: imageAnalysis.exif,
            reverseSearchJson: imageAnalysis.reverseSearch,
            aiGeneratedScore: imageAnalysis.aiGeneration.score,
            perceptualHash: imageAnalysis.perceptualHash,
            flags: imageAnalysis.flags,
          },
        });

        if (imageAnalysis.ocr.text && imageAnalysis.ocr.text.trim().length > 0) {
          rawContent = submission.rawText
            ? `${imageAnalysis.ocr.text}\n\n${submission.rawText}`
            : imageAnalysis.ocr.text;

          await prisma.submission.update({
            where: { id: submissionId },
            data: {
              rawText: rawContent.slice(0, 15000),
            },
          });
        }

        await prisma.pipelineRun.update({
          where: { id: imageRun.id },
          data: {
            status: "COMPLETED",
            finishedAt: new Date(),
          },
        });
      } catch (imgErr) {
        const imgErrMsg = imgErr instanceof Error ? imgErr.message : String(imgErr);
        console.error(`[Pipeline] IMAGE_ANALYSIS failed:`, imgErrMsg);
        await prisma.pipelineRun.update({
          where: { id: imageRun.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: imgErrMsg,
          },
        });
      }
    }

    if (!rawContent || rawContent.trim().length === 0) {
      throw new Error("No readable text found for claim extraction.");
    }

    const detected = detectLanguage(rawContent);
    workingLanguage = detected;

    const translation = await normalizeToEnglish(rawContent, detected);
    rawContent = translation.englishText;

    await prisma.pipelineRun.update({
      where: { id: step1Run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step 1 CONTENT_EXTRACTION failed:`, errorMsg);
    await prisma.pipelineRun.update({
      where: { id: step1Run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMsg,
      },
    });
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "FAILED" },
    });
    return {
      success: false,
      submissionId,
      claimsCount: 0,
      status: "FAILED",
      errors: [errorMsg],
    };
  }

  // STEP 2: ATOMIC CLAIM EXTRACTION
  const step2Run = await prisma.pipelineRun.create({
    data: {
      submissionId,
      step: "CLAIM_EXTRACTION",
      status: "RUNNING",
      promptVersion: PROMPT_VERSION,
      startedAt: new Date(),
    },
  });

  let extractedClaimsList = [];

  try {
    const prompt = buildClaimExtractionPrompt({
      rawText: rawContent,
      language: workingLanguage,
      sourceUrl: submission.url,
    });

    const completion = await generateStructuredCompletion({
      prompt,
      systemPrompt: CLAIM_EXTRACTION_SYSTEM_PROMPT,
      schema: claimExtractionResultSchema,
      promptVersion: PROMPT_VERSION,
      fallbackMock: () => mockClaimExtraction(rawContent, workingLanguage),
    });

    extractedClaimsList = completion.data.claims;

    if (extractedClaimsList.length === 0) {
      extractedClaimsList = [
        {
          text: rawContent.slice(0, 250),
          checkable: true,
          type: "FACTUAL",
          language: workingLanguage,
          entities: [],
        },
      ];
    }

    await prisma.pipelineRun.update({
      where: { id: step2Run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        promptVersion: completion.promptVersion,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step 2 CLAIM_EXTRACTION failed:`, errorMsg);
    await prisma.pipelineRun.update({
      where: { id: step2Run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMsg,
      },
    });
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "FAILED" },
    });
    return {
      success: false,
      submissionId,
      claimsCount: 0,
      status: "FAILED",
      errors: [errorMsg],
    };
  }

  // STEP 3: EMBEDDING GENERATION & CLAIM CREATION
  const step3Run = await prisma.pipelineRun.create({
    data: {
      submissionId,
      step: "EMBEDDING_GENERATION",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    for (const item of extractedClaimsList) {
      const embeddingVector = await generateEmbedding(item.text);
      const { topic, state } = classifyClaimTopicAndState(item.text);

      await prisma.claim.create({
        data: {
          submissionId,
          text: item.text,
          originalText: item.originalText || (workingLanguage !== "en" ? rawContent.slice(0, 300) : null),
          language: item.language || workingLanguage,
          checkable: item.checkable,
          embedding: embeddingVector,
          topic,
          state,
          aiVerdict: "UNVERIFIED",
          aiConfidence: 0.0,
          aiReasoning: `Extracted as ${item.type} statement. Entities identified: [${(item.entities || []).join(", ")}]. Pending evidence gathering.`,
        },
      });
    }

    await prisma.pipelineRun.update({
      where: { id: step3Run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step 3 EMBEDDING_GENERATION failed:`, errorMsg);
    await prisma.pipelineRun.update({
      where: { id: step3Run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMsg,
      },
    });
  }

  // DUPLICATE CLAIM CHECK
  let totalEvidenceGathered = 0;

  try {
    const claimsToCheck = await prisma.claim.findMany({
      where: { submissionId },
    });

    for (const c of claimsToCheck) {
      if (c.embedding && c.embedding.length > 0) {
        const similarityResult = await findSimilarPublishedClaim(
          c.embedding,
          DEFAULT_SIMILARITY_THRESHOLD,
          c.id
        );

        if (similarityResult.matchFound && similarityResult.matchedClaim) {
          const matched = similarityResult.matchedClaim;
          const recurrence = await registerClaimRecurrence(
            matched.id,
            submissionId,
            similarityResult.similarityScore
          );

          await prisma.claim.update({
            where: { id: c.id },
            data: {
              matchedClaimId: matched.id,
              similarityScore: similarityResult.similarityScore,
              aiVerdict: matched.finalVerdict || matched.aiVerdict,
              aiConfidence: Math.max(0.95, matched.aiConfidence),
              aiReasoning: `⚡ Similar claim already verified by human fact-checker: "${matched.text}" (Official Verdict: ${matched.finalVerdict}). Matched with ${Math.round(similarityResult.similarityScore * 100)}% semantic similarity. Recirculated ${recurrence} times this election cycle.`,
            },
          });

          if (matched.evidence && matched.evidence.length > 0) {
            for (const prevEv of matched.evidence) {
              await prisma.evidence.create({
                data: {
                  claimId: c.id,
                  kind: prevEv.kind,
                  sourceName: prevEv.sourceName,
                  url: prevEv.url,
                  title: prevEv.title,
                  snippet: prevEv.snippet,
                  stance: prevEv.stance,
                  rawJson: prevEv.rawJson || undefined,
                },
              });
              totalEvidenceGathered++;
            }
          }
        }
      }
    }
  } catch (dupErr) {
    console.warn("[Pipeline] Duplicate detection error:", dupErr);
  }

  // STEP 4: EVIDENCE GATHERING
  const step4Run = await prisma.pipelineRun.create({
    data: {
      submissionId,
      step: "EVIDENCE_GATHERING",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const claims = await prisma.claim.findMany({
      where: { submissionId },
    });

    for (const claim of claims) {
      const urlMatch = claim.text.match(
        /https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.(?:com|org|in|gov\.in|net|edu)/i
      );
      const targetDomain = submission.url || (urlMatch ? urlMatch[0] : "eci.gov.in");

      const settled = await Promise.allSettled([
        searchFactCheckDatabase(claim.text),
        searchOfficialEci(claim.text),
        searchOfficialPib(claim.text),
        searchWeb(claim.text),
        analyzeDomainCredibility(targetDomain).then((res) => [res.evidence]),
      ]);

      const collected = [];

      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          collected.push(...outcome.value);
        } else {
          console.warn(`[Pipeline] Evidence provider error for claim #${claim.id}:`, outcome.reason);
        }
      }

      if (collected.length === 0) {
        collected.push({
          kind: "OFFICIAL",
          sourceName: "Election Commission of India (ECI)",
          url: "https://eci.gov.in/important-instructions",
          title: "Election Commission of India Official Guidelines & Compendium",
          snippet: "Statutory instructions and standard operating procedures published by the Election Commission of India.",
          stance: "NEUTRAL",
          rawJson: { fallback: true, query: claim.text },
        });
      }

      const seen = new Set();
      for (const item of collected) {
        const key = item.url ? item.url.trim().toLowerCase() : `${item.sourceName}:${item.title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        await prisma.evidence.create({
          data: {
            claimId: claim.id,
            kind: item.kind,
            sourceName: item.sourceName,
            url: item.url,
            title: item.title,
            snippet: item.snippet,
            stance: item.stance,
            rawJson: item.rawJson || undefined,
          },
        });
        totalEvidenceGathered++;
      }
    }

    await prisma.pipelineRun.update({
      where: { id: step4Run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        event: "PIPELINE_EVIDENCE_GATHERED",
        entity: "Submission",
        entityId: submissionId,
        metadata: {
          totalEvidenceGathered,
          claimsCount: claims.length,
        },
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step 4 EVIDENCE_GATHERING failed:`, errorMsg);
    await prisma.pipelineRun.update({
      where: { id: step4Run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMsg,
      },
    });
  }

  // STEP 5: AI JUDGEMENT & EVIDENCE SCORING
  const step5Run = await prisma.pipelineRun.create({
    data: {
      submissionId,
      step: "AI_JUDGEMENT",
      status: "RUNNING",
      promptVersion: JUDGEMENT_PROMPT_VERSION,
      startedAt: new Date(),
    },
  });

  try {
    const claimsWithEvidence = await prisma.claim.findMany({
      where: { submissionId },
      include: { evidence: true },
    });

    const imageAnalysis = await prisma.imageAnalysis.findUnique({
      where: { submissionId },
    });
    const imageFlags = imageAnalysis?.flags || [];

    for (const claim of claimsWithEvidence) {
      if (claim.matchedClaimId) {
        continue;
      }

      const prompt = buildClaimJudgementPrompt({
        claimText: claim.text,
        checkable: claim.checkable,
        language: claim.language,
        evidence: claim.evidence,
        imageFlags,
      });

      const judgement = await generateStructuredCompletion({
        prompt,
        systemPrompt: CLAIM_JUDGEMENT_SYSTEM_PROMPT,
        schema: claimJudgementResultSchema,
        promptVersion: JUDGEMENT_PROMPT_VERSION,
        fallbackMock: () =>
          mockClaimJudgement({
            claimText: claim.text,
            checkable: claim.checkable,
            language: claim.language,
            evidence: claim.evidence,
            imageFlags,
          }),
      });

      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          aiVerdict: judgement.data.verdict,
          aiConfidence: judgement.data.confidence,
          aiReasoning: judgement.data.reasoning,
        },
      });
    }

    await prisma.pipelineRun.update({
      where: { id: step5Run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        promptVersion: JUDGEMENT_PROMPT_VERSION,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Pipeline] Step 5 AI_JUDGEMENT failed:`, errorMsg);
    await prisma.pipelineRun.update({
      where: { id: step5Run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: errorMsg,
      },
    });
  }

  // Aggregate Submission-Level Summary
  const allFinalClaims = await prisma.claim.findMany({
    where: { submissionId },
  });
  const summary = aggregateSubmissionVerdicts(allFinalClaims);

  const updatedSubmission = await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "AI_SUGGESTED" },
  });

  const durationMs = Date.now() - startTime;
  await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      event: "PIPELINE_JUDGEMENT_COMPLETED",
      entity: "Submission",
      entityId: submissionId,
      metadata: {
        claimsCount: allFinalClaims.length,
        summaryVerdict: summary.summaryVerdict,
        overallConfidence: summary.overallConfidence,
        summaryText: summary.summaryText,
        verdictCounts: summary.verdictCounts,
        promptVersion: JUDGEMENT_PROMPT_VERSION,
        durationMs,
        finalStatus: updatedSubmission.status,
      },
    },
  });

  console.log(
    `[Pipeline] Successfully completed judgement for submission #${submissionId}: ${summary.summaryVerdict} (${Math.round(summary.overallConfidence * 100)}% confidence) in ${durationMs}ms.`
  );

  return {
    success: true,
    submissionId,
    claimsCount: allFinalClaims.length,
    evidenceCount: totalEvidenceGathered,
    summaryVerdict: summary.summaryVerdict,
    overallConfidence: summary.overallConfidence,
    status: updatedSubmission.status,
  };
}
