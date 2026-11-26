import { SCORING_CONFIG } from "../../config/scoring";

/**
 * Computes an explainable verdict and confidence score per claim
 * based on weighted multi-source evidence signals.
 * Primary logic for Module 3 (AI Verification) & Task 01 scoring repairs.
 */
export function computeClaimScoreAndVerdict(input) {
  const config = {
    ...SCORING_CONFIG,
    ...input.customConfig,
    weights: { ...SCORING_CONFIG.weights, ...input.customConfig?.weights },
    thresholds: { ...SCORING_CONFIG.thresholds, ...input.customConfig?.thresholds },
  };

  const { weights, thresholds } = config;
  const { text, checkable, evidence = [], imageFlags = [] } = input;

  // 1. Hard Rule: Non-Checkable Claims (Opinions, Predictions, Hyperbole)
  if (!checkable) {
    return {
      verdict: "NOT_CHECKABLE",
      confidence: 1.0,
      reasoning: "Statement identified as a subjective political opinion, rhetorical hyperbole, or future prediction rather than a verifiable factual claim.",
      usedEvidenceIds: [],
    };
  }

  // 2. Hard Rule: Zero Evidence Found
  if (!evidence || evidence.length === 0) {
    return {
      verdict: "UNVERIFIED",
      confidence: 0.0,
      reasoning: "No corroborating or refuting evidence could be identified across official election databases, fact-checking archives, or web news sources.",
      usedEvidenceIds: [],
    };
  }

  // 3. Partition Evidence by Stance & Kind (group by unique domain to prevent duplicate source inflation)
  const contradictItems = [];
  const supportItems = [];
  const neutralItems = [];
  const seenContradictDomains = new Set();
  const seenSupportDomains = new Set();

  for (const item of evidence) {
    const rawDomain = item.url ? new URL(item.url.startsWith("http") ? item.url : `https://${item.url}`).hostname.replace("www.", "") : item.sourceName;

    if (item.stance === "CONTRADICTS") {
      contradictItems.push(item);
      seenContradictDomains.add(rawDomain);
    } else if (item.stance === "SUPPORTS") {
      supportItems.push(item);
      seenSupportDomains.add(rawDomain);
    } else {
      neutralItems.push(item);
    }
  }

  // If only neutral evidence exists
  if (contradictItems.length === 0 && supportItems.length === 0) {
    return {
      verdict: "UNVERIFIED",
      confidence: 0.2,
      reasoning: "Retrieved references are neutral or background context without direct confirmation or refutation.",
      usedEvidenceIds: neutralItems.map((e) => e.id),
    };
  }

  // 4. Calculate Weighted Signal Accumulators (counting independent sources)
  let contradictWeight = 0;
  let supportWeight = 0;

  // Fact check matching
  const factCheckContradicts = contradictItems.filter((e) => e.kind === "FACT_CHECK");
  const factCheckSupports = supportItems.filter((e) => e.kind === "FACT_CHECK");
  contradictWeight += Math.min(1.0, factCheckContradicts.length * 0.7) * weights.matchingFactCheck;
  supportWeight += Math.min(1.0, factCheckSupports.length * 0.7) * weights.matchingFactCheck;

  // Official source corroboration (ECI / PIB)
  const officialContradicts = contradictItems.filter((e) => e.kind === "OFFICIAL");
  const officialSupports = supportItems.filter((e) => e.kind === "OFFICIAL");
  contradictWeight += Math.min(1.0, officialContradicts.length * 0.7) * weights.officialSource;
  supportWeight += Math.min(1.0, officialSupports.length * 0.7) * weights.officialSource;

  // Independent web sources (scaled by independent domains)
  const webContradicts = contradictItems.filter((e) => e.kind === "WEB");
  const webSupports = supportItems.filter((e) => e.kind === "WEB");
  contradictWeight += Math.min(1.0, seenContradictDomains.size * 0.4) * weights.independentCredibleAgreement;
  supportWeight += Math.min(1.0, seenSupportDomains.size * 0.4) * weights.independentCredibleAgreement;

  // Source credibility / lookalike domain flags
  const sourceCredContradicts = contradictItems.filter((e) => e.kind === "SOURCE_CREDIBILITY");
  contradictWeight += Math.min(1.0, sourceCredContradicts.length) * weights.sourceCredibility;

  // Image forensic discrepancy impact (recycled media / timestamp older than event)
  const hasRecycledMedia = imageFlags.some((f) => f.toLowerCase().includes("recycled") || f.toLowerCase().includes("older than"));
  const hasAiGeneratedImage = imageFlags.some((f) => f.toLowerCase().includes("ai / synthetic"));
  if (hasRecycledMedia) {
    contradictWeight += weights.imageForensicsPenalty;
    supportWeight = Math.max(0, supportWeight - 0.2);
  }

  // Normalize total score
  const totalScore = contradictWeight + supportWeight;
  const usedEvidenceIds = [...contradictItems, ...supportItems].map((e) => e.id);

  // 5. Conflicting Credible Evidence: If both sides have substantial credible weight
  const isConflicting =
    contradictItems.length > 0 &&
    supportItems.length > 0 &&
    contradictWeight >= 0.3 &&
    supportWeight >= 0.3 &&
    Math.abs(contradictWeight - supportWeight) < 0.25;

  if (isConflicting) {
    return {
      verdict: "UNVERIFIED",
      confidence: 0.40,
      reasoning: `Conflicting evidence detected across credible sources (${contradictItems.length} contradicting, ${supportItems.length} supporting). Human review required to resolve factual dispute.`,
      usedEvidenceIds,
    };
  }

  if (hasRecycledMedia) {
    return {
      verdict: "MISLEADING",
      confidence: Math.round(Math.min(0.85, Math.max(0.60, totalScore)) * 100) / 100,
      reasoning: "Forensic analysis established that historical imagery has been recycled and re-attributed to this election cycle without factual context.",
      usedEvidenceIds,
    };
  }

  // 6. Low Confidence / Insufficient Corroboration Fallback
  const rawConfidence = Math.min(0.99, Math.max(0.1, totalScore));

  if (rawConfidence < thresholds.minConfidence || totalScore === 0) {
    return {
      verdict: "UNVERIFIED",
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
    const reasons = [];

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
      verdict: "CONTRADICTED",
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
    const reasons = [];

    if (officialSupports.length > 0) {
      reasons.push(`Directly corroborated by official election directives from ${officialSupports[0].sourceName}`);
    }
    if (factCheckSupports.length > 0) {
      reasons.push(`Confirmed by verified fact-checking analysis from ${factCheckSupports[0].sourceName}`);
    }
    if (webSupports.length >= thresholds.minCredibleSourcesForConsensus) {
      reasons.push(`Corroborated across ${seenSupportDomains.size} independent credible sources`);
    }
    if (reasons.length === 0) {
      reasons.push(`Supported by reported context from ${topSupporter || "established sources"}`);
    }

    return {
      verdict: "SUPPORTED",
      confidence,
      reasoning: reasons.join(". ") + ".",
      usedEvidenceIds,
    };
  }

  // 9. Fallback: Default to UNVERIFIED
  return {
    verdict: "UNVERIFIED",
    confidence: 0.4,
    reasoning: "Retrieved evidence was inconclusive or did not contain definitive corroboration or refutation.",
    usedEvidenceIds: evidence.map((e) => e.id),
  };
}

/**
 * Aggregates individual atomic claim verdicts into a submission-level summary.
 */
export function aggregateSubmissionVerdicts(claims = []) {
  const totalClaimsCount = claims.length;
  const checkableClaims = claims.filter((c) => c.checkable);
  const checkableClaimsCount = checkableClaims.length;

  const verdictCounts = {
    SUPPORTED: 0,
    CONTRADICTED: 0,
    MISLEADING: 0,
    UNVERIFIED: 0,
    NOT_CHECKABLE: 0,
  };

  for (const c of claims) {
    const v = c.verdict || c.aiVerdict || "UNVERIFIED";
    verdictCounts[v] = (verdictCounts[v] || 0) + 1;
  }

  if (totalClaimsCount === 0) {
    return {
      summaryVerdict: "UNVERIFIED",
      overallConfidence: 0.0,
      summaryText: "No verifiable claims could be extracted from the submission.",
      totalClaimsCount: 0,
      checkableClaimsCount: 0,
      verdictCounts,
    };
  }

  if (checkableClaimsCount === 0) {
    return {
      summaryVerdict: "NOT_CHECKABLE",
      overallConfidence: 1.0,
      summaryText: "All statements in this submission represent non-factual opinions, predictions, or personal commentary.",
      totalClaimsCount,
      checkableClaimsCount,
      verdictCounts,
    };
  }

  const totalConf = checkableClaims.reduce((sum, c) => {
    const val = c.confidence !== undefined ? c.confidence : (c.aiConfidence ?? 0.0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const overallConfidence = Math.round((totalConf / checkableClaimsCount) * 100) / 100;

  let summaryVerdict = "UNVERIFIED";
  let summaryText = "";

  if (verdictCounts.CONTRADICTED > 0) {
    if (verdictCounts.SUPPORTED > 0 || verdictCounts.MISLEADING > 0) {
      summaryVerdict = "MISLEADING";
      summaryText = `Submission contains a mixture of disproven claims (${verdictCounts.CONTRADICTED}) and partially corroborated context. Readers are cautioned against misleading framing.`;
    } else {
      summaryVerdict = "CONTRADICTED";
      summaryText = `Core claim(s) disproven by official election authorities or certified fact-checkers (${verdictCounts.CONTRADICTED} contradicted claim(s)).`;
    }
  } else if (verdictCounts.MISLEADING > 0) {
    summaryVerdict = "MISLEADING";
    summaryText = `Submission contains misleading statements or recycled media lacking necessary context (${verdictCounts.MISLEADING} misleading claim(s)).`;
  } else if (verdictCounts.SUPPORTED > 0 && verdictCounts.UNVERIFIED === 0) {
    summaryVerdict = "SUPPORTED";
    summaryText = `All checkable claims confirmed accurate and corroborated by official guidelines or credible reporting (${verdictCounts.SUPPORTED} supported claim(s)).`;
  } else if (verdictCounts.SUPPORTED > 0) {
    summaryVerdict = "SUPPORTED";
    summaryText = `Key claims corroborated by available evidence (${verdictCounts.SUPPORTED} supported, ${verdictCounts.UNVERIFIED} unverified).`;
  } else {
    summaryVerdict = "UNVERIFIED";
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
