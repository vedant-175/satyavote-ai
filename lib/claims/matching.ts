import { prisma } from "@/lib/db/prisma";
import { cosineSimilarity } from "@/lib/ai/provider";
import { Claim, Evidence, ActorType } from "@prisma/client";

export const DEFAULT_SIMILARITY_THRESHOLD = 0.65;

export interface SimilarClaimMatch {
  matchFound: boolean;
  matchedClaim: (Claim & { evidence: Evidence[] }) | null;
  similarityScore: number;
}

/**
 * Classifies an election claim into structured topics and geographical state jurisdiction.
 */
export function classifyClaimTopicAndState(text: string): { topic: string; state: string } {
  const lower = text.toLowerCase();

  let topic = "General Election Information";
  if (/evm|electronic voting|vvpat|voting machine|tamper|hack|battery/.test(lower)) {
    topic = "EVM & Voting Technology";
  } else if (/voter id|epic|aadhaar|identity|document|form 6|voter slip|electoral roll/.test(lower)) {
    topic = "Voter Identification & Rolls";
  } else if (/model code|mcc|bribe|liquor|cash distribution|freebie|hate speech|rally|campaign/.test(lower)) {
    topic = "Model Code of Conduct";
  } else if (/timing|hours|booth|queue|polling station|turnout|holiday|phase|dry day/.test(lower)) {
    topic = "Polling Operations & Schedule";
  } else if (/result|counting|postal ballot|margin|exit poll/.test(lower)) {
    topic = "Counting & Results";
  }

  let state = "National";
  const stateKeywords: Record<string, RegExp> = {
    "Maharashtra": /maharashtra|mumbai|pune|nagpur|thane/,
    "Uttar Pradesh": /uttar pradesh|\bup\b|lucknow|varanasi|ayodhya|kanpur/,
    "Punjab": /punjab|amritsar|ludhiana|jalandhar|chandigarh/,
    "West Bengal": /west bengal|kolkata|bengal/,
    "Delhi": /delhi|ncr|new delhi/,
    "Bihar": /bihar|patna|gaya/,
    "Karnataka": /karnataka|bengaluru|bangalore|mysuru/,
    "Tamil Nadu": /tamil nadu|chennai|coimbatore/,
    "Rajasthan": /rajasthan|jaipur|jodhpur/,
    "Gujarat": /gujarat|ahmedabad|surat/,
    "Kerala": /kerala|kochi|thiruvananthapuram/,
  };

  for (const [st, regex] of Object.entries(stateKeywords)) {
    if (regex.test(lower)) {
      state = st;
      break;
    }
  }

  return { topic, state };
}

/**
 * Searches published, reviewer-approved claims for semantic duplicates above the cosine threshold.
 */
export async function findSimilarPublishedClaim(
  embedding: number[],
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
  excludeClaimId?: string
): Promise<SimilarClaimMatch> {
  if (!embedding || embedding.length === 0) {
    return { matchFound: false, matchedClaim: null, similarityScore: 0 };
  }

  // Fetch all reviewer-approved published claims
  const publishedClaims = await prisma.claim.findMany({
    where: {
      finalVerdict: { not: null },
      publishedAt: { not: null },
      ...(excludeClaimId ? { id: { not: excludeClaimId } } : {}),
    },
    include: {
      evidence: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 100, // Search recent pool of published verified claims
  });

  let bestMatch: (Claim & { evidence: Evidence[] }) | null = null;
  let highestScore = 0;

  for (const candidate of publishedClaims) {
    if (!candidate.embedding || candidate.embedding.length === 0) continue;

    const score = cosineSimilarity(embedding, candidate.embedding);
    if (score > highestScore) {
      highestScore = score;
      if (score >= threshold) {
        bestMatch = candidate;
      }
    }
  }

  return {
    matchFound: bestMatch !== null,
    matchedClaim: bestMatch,
    similarityScore: Number(highestScore.toFixed(4)),
  };
}

/**
 * Increments repeat submission count on a viral claim and writes an immutable audit record.
 */
export async function registerClaimRecurrence(
  canonicalClaimId: string,
  newSubmissionId: string,
  similarityScore: number
): Promise<number> {
  const updated = await prisma.claim.update({
    where: { id: canonicalClaimId },
    data: {
      repeatCount: { increment: 1 },
    },
    select: { id: true, repeatCount: true, text: true, finalVerdict: true },
  });

  // Log recirculation to immutable audit trail
  await prisma.auditLog.create({
    data: {
      actorType: ActorType.SYSTEM,
      event: "CLAIM_RECIRCULATION_DETECTED",
      entity: "Claim",
      entityId: canonicalClaimId,
      metadata: {
        newSubmissionId,
        repeatCount: updated.repeatCount,
        similarityScore,
        isViral: updated.repeatCount >= 3,
        verdict: updated.finalVerdict,
      },
    },
  });

  return updated.repeatCount;
}
