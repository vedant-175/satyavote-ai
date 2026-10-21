import { Verdict } from "@prisma/client";
import { ClaimJudgementResult } from "../schemas";
import { ScoredEvidenceInput, computeClaimScoreAndVerdict } from "../../scoring/score";

export const JUDGEMENT_PROMPT_VERSION = "claim-judgement.v1";

export const CLAIM_JUDGEMENT_SYSTEM_PROMPT = `You are a Senior Election Information Verification Adjudicator specializing in Indian elections.
Your mission is to perform strict, evidence-grounded evaluation of extracted political claims against retrieved official and journalistic evidence.

CRITICAL RULES:
1. STRICT GROUNDING: You must judge the claim SOLELY based on the provided evidence items. Do NOT use outside unstated knowledge or assumptions.
2. CITATION REQUIREMENT: Include the exact IDs of all evidence items that directly substantiate or refute the claim in 'usedEvidenceIds'.
3. VERDICT DEFINITIONS:
   - "SUPPORTED": Claim is directly confirmed by authentic official authorities (ECI, PIB) or credible reports.
   - "CONTRADICTED": Claim is directly disproven, fabricated, or rejected by official circulars or certified fact-checkers.
   - "MISLEADING": Claim distorts genuine facts, quotes out of context, or pairs genuine photos with false dates/events.
   - "UNVERIFIED": Insufficient, weak, or zero relevant evidence was retrieved.
   - "NOT_CHECKABLE": Claim expresses a pure subjective opinion, value judgement, or future speculation.
4. CONFIDENCE SCORING:
   - High (0.80 - 0.99): Definitive official statement or certified fact-check directly addressing the claim.
   - Moderate (0.50 - 0.79): Indirect corroboration or multiple independent secondary sources.
   - Low (0.00 - 0.49): Inconclusive or weak isolated sources (verdict MUST be UNVERIFIED).
5. FORMAT: Return strictly valid JSON matching the schema:
   {
     "verdict": "SUPPORTED" | "CONTRADICTED" | "MISLEADING" | "UNVERIFIED" | "NOT_CHECKABLE",
     "confidence": number,
     "reasoning": string,
     "usedEvidenceIds": string[]
   }`;

export interface ClaimJudgementPromptInput {
  claimText: string;
  checkable: boolean;
  language?: string;
  evidence: ScoredEvidenceInput[];
  imageFlags?: string[];
}

export function buildClaimJudgementPrompt(input: ClaimJudgementPromptInput): string {
  const { claimText, checkable, language = "en", evidence, imageFlags = [] } = input;

  const formattedEvidence =
    evidence.length === 0
      ? "No external evidence retrieved."
      : evidence
          .map(
            (e, idx) =>
              `[Evidence #${idx + 1}] ID: ${e.id}
Source: ${e.sourceName} (${e.kind})
URL: ${e.url || "N/A"}
Stance: ${e.stance}
Title: ${e.title || "N/A"}
Snippet: "${e.snippet || "N/A"}"`
          )
          .join("\n\n");

  const formattedImageFlags =
    imageFlags.length > 0
      ? `\nImage Forensics Flags:\n${imageFlags.map((f) => `- ${f}`).join("\n")}`
      : "";

  return `<CLAIM_TO_VERIFY>
Text: "${claimText}"
Checkable: ${checkable ? "TRUE" : "FALSE"}
Language: ${language}
${formattedImageFlags}
</CLAIM_TO_VERIFY>

<RETRIEVED_EVIDENCE_GROUNDING>
${formattedEvidence}
</RETRIEVED_EVIDENCE_GROUNDING>

Carefully evaluate whether the retrieved evidence supports, contradicts, or fails to address the claim.
Output strictly valid JSON with keys: verdict, confidence, reasoning, usedEvidenceIds.`;
}

/**
 * Offline deterministic fallback that applies the scoring model rules.
 */
export function mockClaimJudgement(input: ClaimJudgementPromptInput): ClaimJudgementResult {
  return computeClaimScoreAndVerdict({
    text: input.claimText,
    checkable: input.checkable,
    language: input.language,
    evidence: input.evidence,
    imageFlags: input.imageFlags,
  });
}
