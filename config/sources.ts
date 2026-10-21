export type ReputationTier = "OFFICIAL" | "CREDIBLE" | "QUESTIONABLE" | "UNRELIABLE" | "UNKNOWN";

export interface SourceDefinition {
  domain: string;
  name: string;
  tier: ReputationTier;
  notes: string;
  officialFor?: string;
  ifcnSignatory?: boolean;
}

/**
 * Official Indian election authorities and state election commission domains.
 */
export const OFFICIAL_ELECTION_DOMAINS: SourceDefinition[] = [
  {
    domain: "eci.gov.in",
    name: "Election Commission of India (ECI)",
    tier: "OFFICIAL",
    notes: "Constitutional authority responsible for administering election processes in India.",
    officialFor: "India Federal Elections",
  },
  {
    domain: "pib.gov.in",
    name: "Press Information Bureau (PIB) Fact Check Unit",
    tier: "OFFICIAL",
    notes: "Official Government of India nodal agency for fact-checking viral statements.",
    officialFor: "Government of India",
  },
  {
    domain: "ceodelhi.gov.in",
    name: "Chief Electoral Officer Delhi",
    tier: "OFFICIAL",
    notes: "State election authority for National Capital Territory of Delhi.",
    officialFor: "Delhi State Elections",
  },
  {
    domain: "ceopunjab.gov.in",
    name: "Chief Electoral Officer Punjab",
    tier: "OFFICIAL",
    notes: "State election authority for Punjab.",
    officialFor: "Punjab State Elections",
  },
  {
    domain: "ceouttarpradesh.nic.in",
    name: "Chief Electoral Officer Uttar Pradesh",
    tier: "OFFICIAL",
    notes: "State election authority for Uttar Pradesh.",
    officialFor: "UP State Elections",
  },
  {
    domain: "ceo.maharashtra.gov.in",
    name: "Chief Electoral Officer Maharashtra",
    tier: "OFFICIAL",
    notes: "State election authority for Maharashtra.",
    officialFor: "Maharashtra State Elections",
  },
  {
    domain: "ceobihar.nic.in",
    name: "Chief Electoral Officer Bihar",
    tier: "OFFICIAL",
    notes: "State election authority for Bihar.",
    officialFor: "Bihar State Elections",
  },
];

/**
 * IFCN-certified independent fact-checking organizations in India.
 */
export const CREDIBLE_FACTCHECKERS: SourceDefinition[] = [
  {
    domain: "altnews.in",
    name: "Alt News",
    tier: "CREDIBLE",
    notes: "IFCN-signatory independent non-profit fact-checking website.",
    ifcnSignatory: true,
  },
  {
    domain: "boomlive.in",
    name: "BOOM Live",
    tier: "CREDIBLE",
    notes: "IFCN-certified fact-checking organization operating in English, Hindi, and Bengali.",
    ifcnSignatory: true,
  },
  {
    domain: "thequint.com",
    name: "The Quint (WebQoof)",
    tier: "CREDIBLE",
    notes: "IFCN-accredited news and fact-checking division.",
    ifcnSignatory: true,
  },
  {
    domain: "vishvasnews.com",
    name: "Vishvas News",
    tier: "CREDIBLE",
    notes: "Jagran Group's IFCN-certified multilingual fact-checking portal.",
    ifcnSignatory: true,
  },
  {
    domain: "indiatoday.in",
    name: "India Today Fact Check",
    tier: "CREDIBLE",
    notes: "AFCL/IFCN certified fact-check division of India Today Group.",
    ifcnSignatory: true,
  },
  {
    domain: "factly.in",
    name: "Factly",
    tier: "CREDIBLE",
    notes: "IFCN-certified Indian public data and fact-checking portal.",
    ifcnSignatory: true,
  },
  {
    domain: "newschecker.in",
    name: "Newschecker",
    tier: "CREDIBLE",
    notes: "IFCN-certified fact-checking platform covering multiple Indian regional languages.",
    ifcnSignatory: true,
  },
];

/**
 * High-risk or flagged disreputable domains known for election misinformation or satire.
 */
export const FLAGGED_UNRELIABLE_DOMAINS: SourceDefinition[] = [
  {
    domain: "fake-election-news.com",
    name: "Flagged Disinformation Site",
    tier: "UNRELIABLE",
    notes: "Known coordinated disinfo outlet.",
  },
  {
    domain: "thefauxy.com",
    name: "The Fauxy (Satire)",
    tier: "QUESTIONABLE",
    notes: "Satirical entertainment website; not a factual source.",
  },
];

/**
 * Normalizes a URL or host into a lowercase domain name.
 */
export function extractDomain(input: string): string {
  try {
    let raw = input.trim().toLowerCase();
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }
    const parsed = new URL(raw);
    let host = parsed.hostname;
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    return host;
  } catch {
    return input.toLowerCase().trim();
  }
}

/**
 * Returns source profile definition or computes credibility tier.
 */
export function getSourceCredibility(domainOrUrl: string): SourceDefinition {
  const domain = extractDomain(domainOrUrl);

  // Check official government / election domains
  const official = OFFICIAL_ELECTION_DOMAINS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (official) return official;

  // Check certified fact-checkers
  const credible = CREDIBLE_FACTCHECKERS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (credible) return credible;

  // Check flagged/unreliable
  const flagged = FLAGGED_UNRELIABLE_DOMAINS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (flagged) return flagged;

  // General .gov.in or .nic.in domains are official
  if (domain.endsWith(".gov.in") || domain.endsWith(".nic.in")) {
    return {
      domain,
      name: "Government of India Portal",
      tier: "OFFICIAL",
      notes: "Official Indian government or statutory body domain.",
    };
  }

  return {
    domain,
    name: domain,
    tier: "UNKNOWN",
    notes: "Uncategorized domain. Subject to independent corroboration.",
  };
}

/**
 * Levenshtein distance helper for detecting lookalike / typosquatted domains.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export interface LookalikeDetectionResult {
  isSuspicious: boolean;
  impersonatingDomain?: string;
  reason?: string;
}

/**
 * Detects deceptive or typosquatted domains pretending to be official election websites
 * (e.g. eci-gov.in, eci-election.com, ecii.gov.in, pib-factcheck.org).
 */
export function detectLookalikeDomain(domainOrUrl: string): LookalikeDetectionResult {
  const domain = extractDomain(domainOrUrl);

  const officialTargets = ["eci.gov.in", "pib.gov.in", "ceodelhi.gov.in", "ceopunjab.gov.in"];

  for (const official of officialTargets) {
    if (domain === official) {
      return { isSuspicious: false };
    }

    const officialBase = official.replace(".gov.in", ""); // "eci", "pib"

    // Hyphenated deceptive variations (e.g. eci-gov.in, pib-india.com)
    if (domain.includes(`${officialBase}-`) || domain.includes(`-${officialBase}`)) {
      return {
        isSuspicious: true,
        impersonatingDomain: official,
        reason: `Deceptive hyphenated domain imitating official authority '${official}'.`,
      };
    }

    // Unofficial TLDs for official brand (e.g. eci.com, eci.org, eci.net, eci.co)
    if (
      domain.startsWith(`${officialBase}.`) &&
      !domain.endsWith(".gov.in") &&
      !domain.endsWith(".nic.in")
    ) {
      return {
        isSuspicious: true,
        impersonatingDomain: official,
        reason: `Commercial or unofficial top-level domain spoofing official government '${official}'.`,
      };
    }

    // Levenshtein close distance (< 2 edits)
    const dist = levenshteinDistance(domain, official);
    if (dist > 0 && dist <= 2) {
      return {
        isSuspicious: true,
        impersonatingDomain: official,
        reason: `Typosquatted domain with high similarity to '${official}' (edit distance: ${dist}).`,
      };
    }
  }

  return { isSuspicious: false };
}
