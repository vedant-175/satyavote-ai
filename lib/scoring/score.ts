import { Verdict, Stance, EvidenceKind } from "@prisma/client";
import { SCORING_CONFIG, ScoringConfig } from "../../config/scoring";
import { ClaimJudgementResult, SubmissionSummary } from "../ai/schemas";

export interface ScoredEvidenceInput {
  id: string;
  kind: EvidenceKind;
  sourceName: string;
  title?: string | null;
  snippet?: string | null;
  stance: Stance;
  url?: string | null;
}

export interface ClaimScoringInput {
  text: string;
  checkable: boolean;
  language?: string;
  evidence: ScoredEvidenceInput[];
  imageFlags?: string[];
  customConfig?: Partial<ScoringConfig>;
}

/**
 * Computes an explainable verdict and confidence score per claim
 * based on weighted multi-source evidence signals (§3.4).
 */
export function computeClaimScoreAndVerdict(input: ClaimScoringInput): ClaimJudgementResult {
  const config = {
    ...SCORING_CONFIG,
    ...input.customConfig,
    weights: { ...SCORING_CONFIG.weights, ...input.customConfig?.weights },
    thresholds: { ...SCORING_CONFIG.thresholds, ...input.customConfig?.thresholds },
  };

  const { weights, thresholds } = config;
  const { text, checkable, evidence, imageFlags = [] } = input;

  // 1. Hard Rule: Non-Checkable Claims (Opinions, Predictions, Hyperbole)
  if (!checkable) {
    return {
      verdict: Verdict.NOT_CHECKABLE,
      confidence: 1.0,
      reasoning: "Statement identified as a subjective political opinion, rhetorical hyperbole, or future prediction rather than a verifiable factual claim.",
      usedEvidenceIds: [],
    };
  }

  // 2. Hard Rule: Zero Evidence Found
  if (!evidence || evidence.length === 0) {
    return {
      verdict: Verdict.UNVERIFIED,
      confidence: 0.0,
      reasoning: "No corroborating or refuting evidence could be identified across official election databases, fact-checking archives, or web news sources.",
      usedEvidenceIds: [],
    };
  }

  // 3. Partition Evidence by Stance & Kind
  const contradictItems: ScoredEvidenceInput[] = [];
  const supportItems: ScoredEvidenceInput[] = [];
  const neutralItems: ScoredEvidenceInput[] = [];

  for (const item of evidence) {
    if (item.stance === Stance.CONTRADICTS) {
      contradictItems.push(item);
    } else if (item.stance === Stance.SUPPORTS) {
      supportItems.push(item);
    } else {
      neutralItems.push(item);
    }
  }

  // 4. Calculate Weighted Signal Accumulators
  let contradictWeight = 0;
  let supportWeight = 0;

  // Fact check matching
  const factCheckContradicts = contradictItems.filter((e) => e.kind === EvidenceKind.FACT_CHECK);
  const factCheckSupports = supportItems.filter((e) => e.kind === EvidenceKind.FACT_CHECK);
  contradictWeight += Math.min(1.0, factCheckContradicts.length * 0.7) * weights.matchingFactCheck;
  supportWeight += Math.min(1.0, factCheckSupports.length * 0.7) * weights.matchingFactCheck;

  // Official source corroboration (ECI / PIB)
  const officialContradicts = contradictItems.filter((e) => e.kind === EvidenceKind.OFFICIAL);
  const officialSupports = supportItems.filter((e) => e.kind === EvidenceKind.OFFICIAL);
  contradictWeight += Math.min(1.0, officialContradicts.length * 0.7) * weights.officialSource;
  supportWeight += Math.min(1.0, officialSupports.length * 0.7) * weights.officialSource;

  // Independent web sources
  const webContradicts = contradictItems.filter((e) => e.kind === EvidenceKind.WEB);
  const webSupports = supportItems.filter((e) => e.kind === EvidenceKind.WEB);
  contradictWeight += Math.min(1.0, webContradicts.length * 0.5) * weights.independentCredibleAgreement;
  supportWeight += Math.min(1.0, webSupports.length * 0.5) * weights.independentCredibleAgreement;

  // Source credibility / lookalike domain flags
  const sourceCredContradicts = contradictItems.filter((e) => e.kind === EvidenceKind.SOURCE_CREDIBILITY);
  contradictWeight += Math.min(1.0, sourceCredContradicts.length) * weights.sourceCredibility;

  // Image forensic discrepancy impact (recycled media / timestamp older than event)
  const hasRecycledMedia = imageFlags.some((f) => f.toLowerCase().includes("recycled") || f.toLowerCase().includes("older than"));
  const hasAiGeneratedImage = imageFlags.some((f) => f.toLowerCase().includes("ai / synthetic"));
  if (hasRecycledMedia || hasAiGeneratedImage) {
    contradictWeight += weights.imageForensicsPenalty;
    // Suppress pure support weight if image is proven recycled or synthetic
    supportWeight = Math.max(0, supportWeight - 0.2);
  }

  // Normalize total score
  const totalScore = contradictWeight + supportWeight;
  const usedEvidenceIds = [...contradictItems, ...supportItems].map((e) => e.id);

  // 5. Edge Case: Conflicting Evidence Across Sources
  const isConflicting =
    contradictItems.length > 0 &&
    supportItems.length > 0 &&
    contradictWeight > 0.05 &&
    supportWeight > 0.05 &&
    Math.abs(contradictWeight - supportWeight) < 0.35;

  if (isConflicting || hasRecycledMedia) {
    const reasons: string[] = [];
    if (hasRecycledMedia) {
      reasons.push("Forensic analysis detected recycled historical media attributed to current election cycle");
    }
    if (isConflicting) {
      reasons.push(
        `Retrieved evidence presents conflicting or divergent statements across sources (${contradictItems.length} contradict, ${supportItems.length} support)`
      );
    }
    return {
      verdict: Verdict.MISLEADING,
      confidence: Math.round(Math.min(0.85, Math.max(0.60, totalScore)) * 100) / 100,
      reasoning: reasons.join(". ") + ". Claim is misleading or out of context.",
      usedEvidenceIds,
    };
  }

  // 6. Edge Case: Single Weak Source or Very Low Total Weight (< minConfidence)
  // If only a single weak/isolated web hit was found without corroboration, confidence will be low.
  const rawConfidence = Math.min(0.99, Math.max(0.1, totalScore));

  if (rawConfidence < thresholds.minConfidence || totalScore === 0) {
    return {
      verdict: Verdict.UNVERIFIED,
      confidence: Math.round(rawConfidence * 100) / 100,
      reasoning: `Insufficient authoritative evidence found to verify or refute this claim with certainty (${evidence.length} total source item(s) found, but lacking official or certified fact-check corroboration).`,
      usedEvidenceIds: evidence.map((e) => e.id),
    };
  }

  // 7. Contradiction Dominance (Debunked / False Claim)
  if (contradictWeight > supportWeight) {
    const confidence = Math.round(
      Math.min(
        0.98,
        Math.max(
          thresholds.minConfidence,
          contradictWeight + (factCheckContradicts.length > 0 || officialContradicts.length > 0 ? 0.2 : 0)
        )
      ) * 100
    ) / 100;

    const topDebunker = factCheckContradicts[0]?.sourceName || officialContradicts[0]?.sourceName || contradictItems[0]?.sourceName;
    const reasons: string[] = [];

    if (officialContradicts.length > 0) {
      reasons.push(`Contradicted by official election authority (${officialContradicts[0].sourceName})`);
    }
    if (factCheckContradicts.length > 0) {
      reasons.push(`Debunked by verified fact-checking organization (${factCheckContradicts[0].sourceName})`);
    }
    if (reasons.length === 0) {
      reasons.push(`Disproven by independent reporting from ${topDebunker || "credible sources"}`);
    }

    return {
      verdict: Verdict.CONTRADICTED,
      confidence,
      reasoning: reasons.join(". ") + ".",
      usedEvidenceIds,
    };
  }

  // 8. Support Dominance (Verified / Accurate Claim)
  if (supportWeight > contradictWeight) {
    const confidence = Math.round(
      Math.min(
        0.98,
        Math.max(
          thresholds.minConfidence,
          supportWeight + (officialSupports.length > 0 || factCheckSupports.length > 0 ? 0.2 : 0)
        )
      ) * 100
    ) / 100;

    const topSupporter = officialSupports[0]?.sourceName || factCheckSupports[0]?.sourceName || supportItems[0]?.sourceName;
    const reasons: string[] = [];

    if (officialSupports.length > 0) {
      reasons.push(`Directly corroborated by official election directives from ${officialSupports[0].sourceName}`);
    }
    if (factCheckSupports.length > 0) {
      reasons.push(`Confirmed by verified fact-checking analysis from ${factCheckSupports[0].sourceName}`);
    }
    if (webSupports.length >= thresholds.minCredibleSourcesForConsensus) {
      reasons.push(`Corroborated across ${webSupports.length} independent credible news reports`);
    }
    if (reasons.length === 0) {
      reasons.push(`Supported by reported context from ${topSupporter || "established sources"}`);
    }

    return {
      verdict: Verdict.SUPPORTED,
      confidence,
      reasoning: reasons.join(". ") + ".",
      usedEvidenceIds,
    };
  }

  // 9. Fallback: Default to UNVERIFIED
  return {
    verdict: Verdict.UNVERIFIED,
    confidence: 0.4,
    reasoning: "Retrieved evidence was inconclusive or did not contain definitive corroboration or refutation.",
    usedEvidenceIds: evidence.map((e) => e.id),
  };
}

export interface ClaimSummaryInput {
  text: string;
  checkable: boolean;
  verdict?: Verdict;
  aiVerdict?: Verdict;
  confidence?: number;
  aiConfidence?: number;
  reasoning?: string | null;
  aiReasoning?: string | null;
}

/**
 * Aggregates individual atomic claim verdicts into a submission-level summary.
 */
export function aggregateSubmissionVerdicts(claims: ClaimSummaryInput[]): SubmissionSummary {
  const totalClaimsCount = claims.length;
  const checkableClaims = claims.filter((c) => c.checkable);
  const checkableClaimsCount = checkableClaims.length;

  const verdictCounts: Record<Verdict, number> = {
    [Verdict.SUPPORTED]: 0,
    [Verdict.CONTRADICTED]: 0,
    [Verdict.MISLEADING]: 0,
    [Verdict.UNVERIFIED]: 0,
    [Verdict.NOT_CHECKABLE]: 0,
  };

  for (const c of claims) {
    const v = c.verdict || c.aiVerdict || Verdict.UNVERIFIED;
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  }

  // If no claims exist
  if (totalClaimsCount === 0) {
    return {
      summaryVerdict: Verdict.UNVERIFIED,
      overallConfidence: 0.0,
      summaryText: "No verifiable claims could be extracted from the submission.",
      totalClaimsCount: 0,
      checkableClaimsCount: 0,
      verdictCounts,
    };
  }

  // If all claims are non-checkable
  if (checkableClaimsCount === 0) {
    return {
      summaryVerdict: Verdict.NOT_CHECKABLE,
      overallConfidence: 1.0,
      summaryText: "All statements in this submission represent non-factual opinions, predictions, or personal commentary.",
      totalClaimsCount,
      checkableClaimsCount,
      verdictCounts,
    };
  }

  // Calculate weighted average confidence across checkable claims
  const totalConf = checkableClaims.reduce((sum, c) => {
    const val = c.confidence !== undefined ? c.confidence : (c.aiConfidence ?? 0.0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const overallConfidence = Math.round((totalConf / checkableClaimsCount) * 100) / 100;

  // Determine overall summary verdict
  let summaryVerdict: Verdict = Verdict.UNVERIFIED;
  let summaryText = "";

  if (verdictCounts[Verdict.CONTRADICTED] > 0) {
    if (verdictCounts[Verdict.SUPPORTED] > 0 || verdictCounts[Verdict.MISLEADING] > 0) {
      summaryVerdict = Verdict.MISLEADING;
      summaryText = `Submission contains a mixture of disproven claims (${verdictCounts[Verdict.CONTRADICTED]}) and partially corroborated context. Readers are cautioned against misleading framing.`;
    } else {
      summaryVerdict = Verdict.CONTRADICTED;
      summaryText = `Core claim(s) disproven by official election authorities or certified fact-checkers (${verdictCounts[Verdict.CONTRADICTED]} contradicted claim(s)).`;
    }
  } else if (verdictCounts[Verdict.MISLEADING] > 0) {
    summaryVerdict = Verdict.MISLEADING;
    summaryText = `Submission contains misleading statements or recycled media lacking necessary context (${verdictCounts[Verdict.MISLEADING]} misleading claim(s)).`;
  } else if (verdictCounts[Verdict.SUPPORTED] > 0 && verdictCounts[Verdict.UNVERIFIED] === 0) {
    summaryVerdict = Verdict.SUPPORTED;
    summaryText = `All checkable claims confirmed accurate and corroborated by official guidelines or credible reporting (${verdictCounts[Verdict.SUPPORTED]} supported claim(s)).`;
  } else if (verdictCounts[Verdict.SUPPORTED] > 0) {
    summaryVerdict = Verdict.SUPPORTED;
    summaryText = `Key claims corroborated by available evidence (${verdictCounts[Verdict.SUPPORTED]} supported, ${verdictCounts[Verdict.UNVERIFIED]} unverified).`;
  } else {
    summaryVerdict = Verdict.UNVERIFIED;
    summaryText = "Insufficient public evidence available to independently verify or disprove the extracted claims.";
  }

  return {
    summaryVerdict,
    overallConfidence,
    summaryText,
    totalClaimsCount,
    checkableClaimsCount,
    verdictCounts,
  };
}
