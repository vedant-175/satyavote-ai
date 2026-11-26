import { searchWeb } from "./search";

/**
 * Targeted official query for the Press Information Bureau (PIB) Fact Check Unit.
 */
export async function searchOfficialPib(claimText) {
  const useMocks = process.env.USE_MOCKS === "true";
  const clean = (claimText || "").toLowerCase();

  if (useMocks || !process.env.SEARCH_API_KEY) {
    if (clean.includes("voter id") || clean.includes("epic") || clean.includes("card") || clean.includes("vote without")) {
      return [
        {
          kind: "OFFICIAL",
          sourceName: "PIB Fact Check Unit",
          url: "https://pib.gov.in/PressReleasePage.aspx?PRID=1914285",
          title: "PIB Fact Check: Viral claim on voter identity compulsion is FALSE",
          snippet: "PIB Fact Check Alert: A viral claim asserts that individuals without an EPIC card cannot cast their vote. Fact: This claim is completely false. As clarified by the Election Commission of India, registered voters can vote using 12 approved alternative photo identity cards.",
          stance: "CONTRADICTS",
          rawJson: {
            domain: "pib.gov.in",
            agency: "Press Information Bureau Fact Check",
            rating: "FALSE",
          },
        },
      ];
    }

    if (clean.includes("evm") || clean.includes("battery") || clean.includes("tamper")) {
      return [
        {
          kind: "OFFICIAL",
          sourceName: "PIB Fact Check Unit",
          url: "https://pib.gov.in/PressReleasePage.aspx?PRID=2021481",
          title: "PIB Fact Check: Claims of EVM manipulation via battery levels are misleading and false",
          snippet: "PIB Clarification: Social media messages alleging pre-programmed votes based on 99% battery levels are unfounded. Control unit batteries are sealed in presence of candidate polling agents and have no link to vote memory.",
          stance: "CONTRADICTS",
          rawJson: {
            domain: "pib.gov.in",
            agency: "Press Information Bureau Fact Check",
            rating: "FALSE",
          },
        },
      ];
    }

    if (clean.includes("aadhaar") || clean.includes("delete") || clean.includes("list")) {
      return [
        {
          kind: "OFFICIAL",
          sourceName: "PIB Fact Check Unit",
          url: "https://pib.gov.in/PressReleasePage.aspx?PRID=1958212",
          title: "PIB Fact Check: No names deleted from voter rolls for unlinked Aadhaar",
          snippet: "PIB Fact Check: Rumors that voters who haven't linked Aadhaar with Form 6B have been removed from electoral roll are false. ECI reiterated that non-submission of Aadhaar is not a ground for deletion.",
          stance: "CONTRADICTS",
          rawJson: {
            domain: "pib.gov.in",
            agency: "Press Information Bureau Fact Check",
            rating: "FALSE",
          },
        },
      ];
    }

    return [];
  }

  const query = `site:pib.gov.in "Fact Check" ${claimText.slice(0, 100)}`;
  try {
    const rawResults = await searchWeb(query, { limit: 2 });
    return rawResults.map((r) => ({
      ...r,
      kind: "OFFICIAL",
      sourceName: "PIB Fact Check Unit",
    }));
  } catch (err) {
    console.warn(`[PIB Search] Error querying pib.gov.in:`, err);
    return [];
  }
}
