import { prisma } from "../db/prisma";
import {
  extractDomain,
  getSourceCredibility,
  detectLookalikeDomain,
} from "../../config/sources";

const KNOWN_DOMAIN_AGES = {
  "eci.gov.in": 9600,
  "pib.gov.in": 8800,
  "ceodelhi.gov.in": 7100,
  "ceopunjab.gov.in": 6900,
  "altnews.in": 2900,
  "boomlive.in": 3500,
  "thequint.com": 3700,
  "indiatoday.in": 9200,
  "thehindu.com": 9900,
  "timesofindia.indiatimes.com": 9500,
};

/**
 * Analyzes domain credibility, checks allowlist/blocklist tiers,
 * inspects lookalike/typosquatting signals, and persists a SourceProfile in the database.
 */
export async function analyzeDomainCredibility(domainOrUrl) {
  const domain = extractDomain(domainOrUrl);
  const credibility = getSourceCredibility(domain);
  const lookalike = detectLookalikeDomain(domain);

  let ageDays = KNOWN_DOMAIN_AGES[domain] || 365;
  if (lookalike.isSuspicious) {
    ageDays = 14;
  }

  let reputationTier = credibility.tier;
  let stance = "NEUTRAL";
  let notes = credibility.notes;

  if (lookalike.isSuspicious) {
    reputationTier = "UNRELIABLE";
    stance = "CONTRADICTS";
    notes = `CRITICAL WARNING: ${lookalike.reason}`;
  } else if (credibility.tier === "OFFICIAL") {
    stance = "SUPPORTS";
    notes = `${credibility.name} is a recognized constitutional/statutory election authority.`;
  } else if (credibility.tier === "CREDIBLE") {
    stance = "SUPPORTS";
    notes = `${credibility.name} is an IFCN-certified independent fact-checker.`;
  } else if (credibility.tier === "UNRELIABLE") {
    stance = "CONTRADICTS";
  }

  const profileAnalysis = {
    domain,
    reputationTier,
    ageDays,
    isLookalike: lookalike.isSuspicious,
    lookalikeTarget: lookalike.impersonatingDomain,
    notes,
  };

  try {
    await prisma.sourceProfile.upsert({
      where: { domain },
      update: {
        reputationTier,
        ageDays,
        notes,
        checkedAt: new Date(),
      },
      create: {
        domain,
        reputationTier,
        ageDays,
        notes,
        checkedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(`[SourceProfile] Failed to upsert profile for ${domain}:`, err);
  }

  const evidence = {
    kind: "SOURCE_CREDIBILITY",
    sourceName: `Domain Credibility: ${domain}`,
    url: `https://${domain}`,
    title: `Source Profile Audit for ${domain} (${reputationTier})`,
    snippet: `Reputation Tier: ${reputationTier}. Domain Age: ${ageDays} days. ${notes}`,
    stance,
    rawJson: {
      domain,
      reputationTier,
      ageDays,
      lookalike,
    },
  };

  return { evidence, profile: profileAnalysis };
}
