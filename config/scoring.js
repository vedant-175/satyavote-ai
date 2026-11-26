/**
 * Config-driven weights and thresholds for explainable evidence scoring.
 * Used by Module 3 (AI Verification) to score claims based on corroborating and contradicting evidence.
 */

export const SCORING_CONFIG = {
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
