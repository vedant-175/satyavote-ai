import { z } from "zod";
import { SubmissionType, SubmissionStatus, Verdict, Stance, EvidenceKind } from "@prisma/client";

/**
 * Zod schema for verifying incoming user submissions.
 */
export const submissionInputSchema = z
  .object({
    type: z.nativeEnum(SubmissionType, {
      message: "Submission type must be LINK, TEXT, or IMAGE.",
    }),
    rawText: z
      .string()
      .max(15000, "Submission text cannot exceed 15,000 characters.")
      .optional()
      .nullable(),
    url: z
      .string()
      .url("Invalid URL format.")
      .max(2048, "URL is too long.")
      .optional()
      .nullable(),
    imageUrl: z
      .string()
      .max(10000000, "Image payload exceeds maximum allowed size.")
      .optional()
      .nullable(),
    language: z
      .string()
      .min(2)
      .max(10)
      .default("en")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === SubmissionType.LINK) {
      if (!data.url || data.url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL is required for LINK submissions.",
          path: ["url"],
        });
      }
    } else if (data.type === SubmissionType.TEXT) {
      if (!data.rawText || data.rawText.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Text content must be at least 5 characters.",
          path: ["rawText"],
        });
      }
    } else if (data.type === SubmissionType.IMAGE) {
      if (!data.imageUrl && (!data.rawText || data.rawText.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Either an image payload or image context text is required for IMAGE submissions.",
          path: ["imageUrl"],
        });
      }
    }
  });

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

/**
 * Atomic Claim Extraction Output Schema
 */
export const extractedClaimSchema = z.object({
  text: z.string().min(5),
  checkable: z.boolean(),
  type: z.enum(["FACTUAL", "OPINION", "PREDICTION", "PROCEDURAL"]).default("FACTUAL"),
  language: z.string().default("en"),
  entities: z.array(z.string()).default([]),
});

export const claimExtractionResultSchema = z.object({
  claims: z.array(extractedClaimSchema),
  extractedContext: z.string().optional(),
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;
export type ClaimExtractionResult = z.infer<typeof claimExtractionResultSchema>;

/**
 * Claim Judgement Output Schema (per Phase 5 requirements)
 * Output JSON: { verdict, confidence, reasoning, usedEvidenceIds[] }
 */
export const claimJudgementResultSchema = z.object({
  verdict: z.nativeEnum(Verdict, {
    message: "Verdict must be SUPPORTED, CONTRADICTED, MISLEADING, UNVERIFIED, or NOT_CHECKABLE.",
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(5, "Reasoning explanation must be provided."),
  usedEvidenceIds: z.array(z.string()).default([]),
});

export type ClaimJudgementResult = z.infer<typeof claimJudgementResultSchema>;

export const claimVerdictSchema = z.object({
  claimId: z.string(),
  verdict: z.nativeEnum(Verdict),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidenceIds: z.array(z.string()),
});

export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

/**
 * Submission-level summary schema aggregating claim verdicts
 */
export const submissionSummarySchema = z.object({
  summaryVerdict: z.nativeEnum(Verdict),
  overallConfidence: z.number().min(0).max(1),
  summaryText: z.string(),
  totalClaimsCount: z.number(),
  checkableClaimsCount: z.number(),
  verdictCounts: z.record(z.nativeEnum(Verdict), z.number()),
});

export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
