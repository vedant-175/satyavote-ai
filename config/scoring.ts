/**
 * Config-driven weights and thresholds for explainable evidence scoring (§3.4).
 */
export interface ScoringConfig {
  weights: {
    matchingFactCheck: number;
    officialSource: number;
    independentCredibleAgreement: number;
    sourceCredibility: number;
    imageForensicsPenalty: number;
    llmEntailment: number;
  };
  thresholds: {
    minConfidence: number; // Claims with confidence below this fall to UNVERIFIED
    highConfidence: number;
    contradictionDominance: number; // Ratio of contradiction signals needed for CONTRADICTED
    supportDominance: number; // Ratio of support signals needed for SUPPORTED
    minCredibleSourcesForConsensus: number;
  };
}

export const SCORING_CONFIG: ScoringConfig = {
  weights: {
    matchingFactCheck: 0.80, // High: direct match with published fact-checkers (Alt News, BOOM, etc.)
    officialSource: 0.85, // High: direct official corroboration/contradiction from ECI or PIB
    independentCredibleAgreement: 0.35, // Medium: multiple credible independent news organizations
    sourceCredibility: 0.25, // Medium: reputation tier and domain age of the originating link
    imageForensicsPenalty: 0.40, // Medium: forensic flags (recycled media, timestamp mismatch, AI synthetic)
    llmEntailment: 0.30, // Medium: semantic entailment of retrieved evidence against claim text
  },
  thresholds: {
    minConfidence: 0.45, // Hard Rule: confidence < 0.45 automatically defaults to UNVERIFIED
    highConfidence: 0.80,
    contradictionDominance: 0.60,
    supportDominance: 0.60,
    minCredibleSourcesForConsensus: 2,
  },
};
