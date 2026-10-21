import { z } from "zod";
import { Verdict, Role } from "@prisma/client";

/**
 * Zod schema for human reviewer claim adjudication.
 * Enforces mandatory justification note and newVerdict when overriding AI.
 */
export const claimAdjudicationSchema = z
  .object({
    action: z.enum(["APPROVE", "OVERRIDE", "ESCALATE"], {
      message: "Action must be APPROVE, OVERRIDE, or ESCALATE.",
    }),
    newVerdict: z.nativeEnum(Verdict).optional(),
    note: z
      .string()
      .max(2000, "Review note cannot exceed 2,000 characters.")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "OVERRIDE") {
      if (!data.newVerdict) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "New verdict is required when overriding AI suggestion.",
          path: ["newVerdict"],
        });
      }
      if (!data.note || data.note.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A justification note (at least 5 characters) is required when overriding AI verdict.",
          path: ["note"],
        });
      }
    } else if (data.action === "ESCALATE") {
      if (!data.note || data.note.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A brief reason (at least 3 characters) is required to escalate to senior administration.",
          path: ["note"],
        });
      }
    }
  });

export type ClaimAdjudicationInput = z.infer<typeof claimAdjudicationSchema>;

/**
 * Zod schema for filtering and sorting reviewer queue.
 */
export const reviewerQueueQuerySchema = z.object({
  sort: z.enum(["priority", "viral", "confidence_asc", "recency"]).default("priority"),
  status: z.enum(["AI_SUGGESTED", "IN_REVIEW", "PUBLISHED", "ESCALATED", "ALL"]).default("AI_SUGGESTED"),
  type: z.enum(["LINK", "TEXT", "IMAGE", "ALL"]).default("ALL"),
  verdict: z.enum(["SUPPORTED", "CONTRADICTED", "MISLEADING", "UNVERIFIED", "NOT_CHECKABLE", "ALL"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

export type ReviewerQueueQuery = z.infer<typeof reviewerQueueQuerySchema>;

/**
 * Zod schema for updating user role in Admin Console.
 */
export const userRoleUpdateSchema = z.object({
  role: z.nativeEnum(Role, {
    message: "Invalid role specified.",
  }),
});

/**
 * Zod schema for managing SourceProfile allowlist/reputation tiers.
 */
export const sourceProfileInputSchema = z.object({
  domain: z
    .string()
    .min(3, "Domain must be at least 3 characters.")
    .max(255, "Domain is too long.")
    .transform((d) => d.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")),
  reputationTier: z.enum(
    ["OFFICIAL", "CERTIFIED_FACT_CHECKER", "MAINSTREAM_NEWS", "USER_GENERATED", "UNRELIABLE", "UNKNOWN"],
    { message: "Invalid reputation tier." }
  ),
  ageDays: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
