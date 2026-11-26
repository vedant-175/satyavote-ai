/**
 * Source credibility tiers and official Indian election authority registries.
 * Module 3: AI Verification - Vedant
 */

export const OFFICIAL_ELECTION_DOMAINS = [
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

export const CREDIBLE_FACTCHECKERS = [
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

export const FLAGGED_UNRELIABLE_DOMAINS = [
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
export function extractDomain(input) {
  try {
    let raw = (input || "").trim().toLowerCase();
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
    return (input || "").toLowerCase().trim();
  }
}

/**
 * Returns source profile definition or computes credibility tier.
 */
export function getSourceCredibility(domainOrUrl) {
  const domain = extractDomain(domainOrUrl);

  const official = OFFICIAL_ELECTION_DOMAINS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (official) return official;

  const credible = CREDIBLE_FACTCHECKERS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (credible) return credible;

  const flagged = FLAGGED_UNRELIABLE_DOMAINS.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`)
  );
  if (flagged) return flagged;

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
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

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

/**
 * Detects deceptive or typosquatted domains pretending to be official election websites
 */
export function detectLookalikeDomain(domainOrUrl) {
  const domain = extractDomain(domainOrUrl);
  const officialTargets = ["eci.gov.in", "pib.gov.in", "ceodelhi.gov.in", "ceopunjab.gov.in"];

  for (const official of officialTargets) {
    if (domain === official) {
      return { isSuspicious: false };
    }

    const officialBase = official.replace(".gov.in", "");

    if (domain.includes(`${officialBase}-`) || domain.includes(`-${officialBase}`)) {
      return {
        isSuspicious: true,
        impersonatingDomain: official,
        reason: `Deceptive hyphenated domain imitating official authority '${official}'.`,
      };
    }

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
