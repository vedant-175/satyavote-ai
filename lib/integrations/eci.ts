import { Stance, EvidenceKind } from "@prisma/client";
import { DiscoveredEvidence } from "./factcheck";
import { searchWeb } from "./search";

/**
 * Targeted official query for the Election Commission of India (ECI)
 * and State Chief Electoral Officer portals.
 */
export async function searchOfficialEci(claimText: string): Promise<DiscoveredEvidence[]> {
  const useMocks = process.env.USE_MOCKS === "true";
  const clean = claimText.toLowerCase();

  // If in mock mode or running offline
  if (useMocks || !process.env.SEARCH_API_KEY) {
    if (clean.includes("voter id") || clean.includes("epic") || clean.includes("photo") || clean.includes("roll")) {
      return [
        {
          kind: EvidenceKind.OFFICIAL,
          sourceName: "Election Commission of India (ECI)",
          url: "https://eci.gov.in/voter-education/faq-identification",
          title: "ECI Handbook & FAQ: Electors Photo Identity Card (EPIC) & Alternative Documents",
          snippet: "Official ECI Notification: All electors who have been issued EPIC shall produce the EPIC for their identification at the polling station. Those electors who are not able to produce the EPIC shall produce one of the following 12 alternative photo identity documents: Aadhaar Card, MNREGA Job Card, Passbooks with photo, Driving License, PAN Card, Indian Passport, Pension document, Service ID cards, etc.",
          stance: Stance.CONTRADICTS,
          rawJson: {
            domain: "eci.gov.in",
            authorityTier: "CONSTITUTIONAL_BODY",
            directiveRef: "ECI/LET/FUNC/EPS/2024",
          },
        },
      ];
    }

    if (clean.includes("evm") || clean.includes("battery") || clean.includes("tamper")) {
      return [
        {
          kind: EvidenceKind.OFFICIAL,
          sourceName: "Election Commission of India (ECI)",
          url: "https://eci.gov.in/evm-facts/status-of-evm-batteries",
          title: "ECI Manual on Electronic Voting Machine (EVM) and VVPAT Protocols",
          snippet: "Technical Clarification: The power pack (battery) inside the Control Unit is an ordinary non-rechargeable alkaline pack (7.5V) designed purely to operate the electronic circuitry without any external power grid connection. Battery percentage does not affect firmware logic or vote counts.",
          stance: Stance.CONTRADICTS,
          rawJson: {
            domain: "eci.gov.in",
            authorityTier: "CONSTITUTIONAL_BODY",
            chapter: "EVM Hardware & Power Specification",
          },
        },
      ];
    }

    return [
      {
        kind: EvidenceKind.OFFICIAL,
        sourceName: "Election Commission of India (ECI)",
        url: "https://eci.gov.in/important-instructions",
        title: "Election Commission of India Official Compendium of Instructions",
        snippet: "Official guidelines, statutory notices, and standard operating procedures published by the Election Commission of India.",
        stance: Stance.NEUTRAL,
        rawJson: { domain: "eci.gov.in" },
      },
    ];
  }

  // Real query restricted to eci.gov.in
  const query = `site:eci.gov.in ${claimText.slice(0, 100)}`;
  try {
    const rawResults = await searchWeb(query, { limit: 2 });
    return rawResults.map((r) => ({
      ...r,
      kind: EvidenceKind.OFFICIAL,
      sourceName: "Election Commission of India (ECI)",
    }));
  } catch (err) {
    console.warn(`[ECI Search] Error querying eci.gov.in:`, err);
    return [];
  }
}
