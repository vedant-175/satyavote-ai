import { z } from "zod";

/**
 * Zod schema for verifying incoming user submissions.
 */
export const submissionInputSchema = z
  .object({
    type: z.enum(["LINK", "TEXT", "IMAGE"], {
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
    if (data.type === "LINK") {
      if (!data.url || data.url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "URL is required for LINK submissions.",
          path: ["url"],
        });
      }
    } else if (data.type === "TEXT") {
      if (!data.rawText || data.rawText.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Text content must be at least 5 characters.",
          path: ["rawText"],
        });
      }
    } else if (data.type === "IMAGE") {
      if (!data.imageUrl && (!data.rawText || data.rawText.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Either an image payload or image context text is required for IMAGE submissions.",
          path: ["imageUrl"],
        });
      }
    }
  });

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

/**
 * Claim Judgement Output Schema
 */
export const claimJudgementResultSchema = z.object({
  verdict: z.enum(["SUPPORTED", "CONTRADICTED", "MISLEADING", "UNVERIFIED", "NOT_CHECKABLE"], {
    message: "Verdict must be SUPPORTED, CONTRADICTED, MISLEADING, UNVERIFIED, or NOT_CHECKABLE.",
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(5, "Reasoning explanation must be provided."),
  usedEvidenceIds: z.array(z.string()).default([]),
});

export const claimVerdictSchema = z.object({
  claimId: z.string(),
  verdict: z.enum(["SUPPORTED", "CONTRADICTED", "MISLEADING", "UNVERIFIED", "NOT_CHECKABLE"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  evidenceIds: z.array(z.string()),
});

/**
 * Submission-level summary schema aggregating claim verdicts
 */
export const submissionSummarySchema = z.object({
  summaryVerdict: z.enum(["SUPPORTED", "CONTRADICTED", "MISLEADING", "UNVERIFIED", "NOT_CHECKABLE"]),
  overallConfidence: z.number().min(0).max(1),
  summaryText: z.string(),
  totalClaimsCount: z.number(),
  checkableClaimsCount: z.number(),
  verdictCounts: z.record(z.string(), z.number()),
});
