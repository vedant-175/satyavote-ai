import { prisma } from "../lib/db/prisma";
import { mapRatingToStance, searchFactCheckDatabase, DiscoveredEvidence } from "../lib/integrations/factcheck";
import { searchWeb } from "../lib/integrations/search";
import { searchOfficialEci } from "../lib/integrations/eci";
import { searchOfficialPib } from "../lib/integrations/pib";
import { analyzeDomainCredibility } from "../lib/integrations/whois";
import {
  getSourceCredibility,
  detectLookalikeDomain,
  extractDomain,
} from "../config/sources";
import { runVerificationPipeline } from "../lib/pipeline/orchestrator";
import {
  Stance,
  EvidenceKind,
  SubmissionType,
  SubmissionStatus,
  PipelineRunStatus,
} from "@prisma/client";

async function runPhase3Tests() {
  console.log("========================================================");
  console.log("🧪 RUNNING PHASE 3 TEST SUITE: MULTI-SOURCE EVIDENCE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Stance Mapping from Fact-Checker Textual Ratings
  console.log("--- 1. Rating to Stance Mapping Tests ---");
  assert(mapRatingToStance("False") === Stance.CONTRADICTS, "Rating 'False' maps to CONTRADICTS");
  assert(mapRatingToStance("Fake News / Fabricated") === Stance.CONTRADICTS, "Rating 'Fake News / Fabricated' maps to CONTRADICTS");
  assert(mapRatingToStance("Misleading & Out of Context") === Stance.CONTRADICTS, "Rating 'Misleading' maps to CONTRADICTS");
  assert(mapRatingToStance("Debunked") === Stance.CONTRADICTS, "Rating 'Debunked' maps to CONTRADICTS");
  assert(mapRatingToStance("यह दावा पूरी तरह से गलत है") === Stance.CONTRADICTS, "Hindi rating with 'गलत' maps to CONTRADICTS");
  assert(mapRatingToStance("ਸੋਸ਼ਲ ਮੀਡੀਆ ਤੇ ਇਹ ਦਾਅਵਾ ਫਰਜ਼ੀ ਹੈ") === Stance.CONTRADICTS, "Punjabi rating with 'ਫਰਜ਼ੀ' maps to CONTRADICTS");

  assert(mapRatingToStance("True") === Stance.SUPPORTS, "Rating 'True' maps to SUPPORTS");
  assert(mapRatingToStance("Accurate and Verified") === Stance.SUPPORTS, "Rating 'Verified' maps to SUPPORTS");
  assert(mapRatingToStance("ਸੱਚ") === Stance.SUPPORTS, "Punjabi rating with 'ਸੱਚ' maps to SUPPORTS");

  assert(mapRatingToStance("Unverified Explainer") === Stance.NEUTRAL, "Rating 'Unverified Explainer' maps to NEUTRAL");
  assert(mapRatingToStance("") === Stance.NEUTRAL, "Empty rating string maps to NEUTRAL");

  // TEST 2: Google Fact Check Tools API Client
  console.log("\n--- 2. Fact Check Database Client Tests ---");
  const factCheckResults = await searchFactCheckDatabase("voter ID card mandatory to vote");
  assert(Array.isArray(factCheckResults), "Fact check search returns array of evidence");
  assert(factCheckResults.length > 0, `Retrieved ${factCheckResults.length} fact check evidence item(s)`);
  if (factCheckResults.length > 0) {
    const first = factCheckResults[0];
    assert(first.kind === EvidenceKind.FACT_CHECK, "Evidence kind is FACT_CHECK");
    assert(typeof first.sourceName === "string" && first.sourceName.length > 0, `Source name present: ${first.sourceName}`);
    assert(first.stance === Stance.CONTRADICTS, "Viral voter ID myth stance is CONTRADICTS");
    assert(first.snippet !== null && first.snippet !== undefined, "Evidence snippet present");
  }

  // TEST 3: Web Search Provider Abstraction
  console.log("\n--- 3. Web Search Provider Abstraction Tests ---");
  const webResults = await searchWeb("voter identification guidelines alternative documents");
  assert(Array.isArray(webResults), "Web search returns array of results");
  assert(webResults.length > 0, `Retrieved ${webResults.length} web search result(s)`);
  if (webResults.length > 0) {
    assert(webResults[0].kind === EvidenceKind.WEB, "Evidence kind is WEB");
    assert(typeof webResults[0].title === "string", "Search result has a title");
    assert(typeof webResults[0].snippet === "string", "Search result has an extracted snippet");
  }

  // TEST 4: Targeted Official Retrieval (ECI & PIB)
  console.log("\n--- 4. Official Election Portals Targeted Search Tests ---");
  const eciResults = await searchOfficialEci("voter id alternative documents");
  assert(eciResults.length > 0, `Retrieved ${eciResults.length} official ECI document(s)`);
  if (eciResults.length > 0) {
    assert(eciResults[0].kind === EvidenceKind.OFFICIAL, "ECI evidence kind is OFFICIAL");
    assert(eciResults[0].sourceName.includes("Election Commission"), "Source identifies as Election Commission of India");
    assert(eciResults[0].url?.includes("eci.gov.in") ?? false, "URL references official eci.gov.in domain");
  }

  const pibResults = await searchOfficialPib("voter id compulsory");
  assert(pibResults.length > 0, `Retrieved ${pibResults.length} official PIB Fact Check alert(s)`);
  if (pibResults.length > 0) {
    assert(pibResults[0].kind === EvidenceKind.OFFICIAL, "PIB evidence kind is OFFICIAL");
    assert(pibResults[0].sourceName.includes("PIB"), "Source identifies as PIB Fact Check Unit");
    assert(pibResults[0].url?.includes("pib.gov.in") ?? false, "URL references official pib.gov.in domain");
  }

  // TEST 5: Source Credibility Tiers & Lookalike Detection
  console.log("\n--- 5. Domain Credibility & Lookalike Detection Tests ---");
  const eciCred = getSourceCredibility("https://eci.gov.in/important-instructions");
  assert(eciCred.tier === "OFFICIAL", "eci.gov.in classified as OFFICIAL reputation tier");

  const pibCred = getSourceCredibility("pib.gov.in");
  assert(pibCred.tier === "OFFICIAL", "pib.gov.in classified as OFFICIAL reputation tier");

  const altNewsCred = getSourceCredibility("https://www.altnews.in/fact-check");
  assert(altNewsCred.tier === "CREDIBLE" && altNewsCred.ifcnSignatory === true, "altnews.in classified as CREDIBLE IFCN signatory");

  const fauxyCred = getSourceCredibility("https://thefauxy.com/articles");
  assert(fauxyCred.tier === "QUESTIONABLE", "thefauxy.com classified as QUESTIONABLE (satire)");

  const unknownCred = getSourceCredibility("https://random-blog-12345.xyz/news");
  assert(unknownCred.tier === "UNKNOWN", "Unregistered domain categorized as UNKNOWN");

  // Deceptive lookalike / typosquatting detection
  const lookalike1 = detectLookalikeDomain("https://eci-gov.in/voter-list");
  assert(lookalike1.isSuspicious === true, "Detected hyphenated lookalike 'eci-gov.in'");
  assert(lookalike1.impersonatingDomain === "eci.gov.in", "Correctly identified target 'eci.gov.in'");

  const lookalike2 = detectLookalikeDomain("https://eci.org/portal");
  assert(lookalike2.isSuspicious === true, "Detected commercial TLD lookalike 'eci.org'");

  const lookalike3 = detectLookalikeDomain("https://pib-india.com");
  assert(lookalike3.isSuspicious === true, "Detected deceptive 'pib-india.com'");

  const legitDomain = detectLookalikeDomain("https://eci.gov.in/welcome");
  assert(legitDomain.isSuspicious === false, "Legitimate 'eci.gov.in' correctly marked not suspicious");

  // TEST 6: Domain Credibility Analysis & Database Upsert
  console.log("\n--- 6. SourceProfile Database Audit Tests ---");
  const { evidence: eciEv, profile: eciProf } = await analyzeDomainCredibility("https://eci.gov.in/rules");
  assert(eciProf.reputationTier === "OFFICIAL", "Analyzed domain profile tier is OFFICIAL");
  assert(eciEv.kind === EvidenceKind.SOURCE_CREDIBILITY, "Evidence item kind is SOURCE_CREDIBILITY");

  // Verify SourceProfile persisted in database
  const savedProfile = await prisma.sourceProfile.findUnique({
    where: { domain: "eci.gov.in" },
  });
  assert(savedProfile !== null, "SourceProfile record successfully upserted into PostgreSQL");
  assert(savedProfile?.reputationTier === "OFFICIAL", "SourceProfile reputationTier matches in DB");

  // TEST 7: Promise.allSettled Fault-Tolerance
  console.log("\n--- 7. Promise.allSettled Fault-Tolerance Tests ---");
  const simulatedTasks = [
    searchOfficialEci("voter id alternative documents"),
    Promise.reject(new Error("Simulated network failure on third-party factcheck API")),
    searchWeb("election voter slip"),
    Promise.reject(new Error("Simulated 503 rate-limit on external crawler")),
  ];

  const settled = await Promise.allSettled(simulatedTasks);
  const fulfilledCount = settled.filter((s) => s.status === "fulfilled").length;
  const rejectedCount = settled.filter((s) => s.status === "rejected").length;

  assert(fulfilledCount === 2, "Fault-tolerant batch successfully resolved 2 healthy promises");
  assert(rejectedCount === 2, "2 simulated API failures caught without throwing unhandled rejection");

  // TEST 8: Full End-to-End Pipeline Execution with Database Evidence Rows
  console.log("\n--- 8. End-to-End Pipeline Verification with Evidence Persistence ---");
  const testSub = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Claim: Electors without physical voter ID card cannot vote in elections. Supreme Court ruled that Aadhaar is compulsory.",
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });

  const pipelineOutput = await runVerificationPipeline(testSub.id);
  assert(pipelineOutput.success === true, "Pipeline execution returned success=true");
  assert(pipelineOutput.status === SubmissionStatus.AI_SUGGESTED, "Pipeline advanced status to AI_SUGGESTED");
  assert((pipelineOutput.evidenceCount ?? 0) > 0, `Gathered ${pipelineOutput.evidenceCount} total evidence records`);

  // Verify PipelineRun records
  const runs = await prisma.pipelineRun.findMany({
    where: { submissionId: testSub.id },
    orderBy: { startedAt: "asc" },
  });
  const stepNames = runs.map((r) => r.step);
  assert(stepNames.includes("CONTENT_EXTRACTION"), "CONTENT_EXTRACTION step logged");
  assert(stepNames.includes("CLAIM_EXTRACTION"), "CLAIM_EXTRACTION step logged");
  assert(stepNames.includes("EMBEDDING_GENERATION"), "EMBEDDING_GENERATION step logged");
  assert(stepNames.includes("EVIDENCE_GATHERING"), "EVIDENCE_GATHERING step logged");

  const evidenceRun = runs.find((r) => r.step === "EVIDENCE_GATHERING");
  assert(evidenceRun?.status === PipelineRunStatus.COMPLETED, "EVIDENCE_GATHERING step marked COMPLETED");

  // Verify Claims and their linked Evidence rows
  const claims = await prisma.claim.findMany({
    where: { submissionId: testSub.id },
    include: { evidence: true },
  });

  assert(claims.length > 0, `Extracted ${claims.length} claim(s) from submission`);

  let allClaimsHaveEvidence = true;
  let totalEvidenceRows = 0;
  for (const c of claims) {
    if (!c.evidence || c.evidence.length === 0) {
      allClaimsHaveEvidence = false;
    }
    totalEvidenceRows += c.evidence.length;
    for (const ev of c.evidence) {
      assert(typeof ev.sourceName === "string" && ev.sourceName.length > 0, `Evidence #${ev.id.slice(0, 8)} has sourceName`);
      assert(ev.snippet !== null && ev.snippet !== undefined, `Evidence #${ev.id.slice(0, 8)} has snippet`);
      assert(Object.values(Stance).includes(ev.stance), `Evidence #${ev.id.slice(0, 8)} has valid stance (${ev.stance})`);
      assert(Object.values(EvidenceKind).includes(ev.kind), `Evidence #${ev.id.slice(0, 8)} has valid kind (${ev.kind})`);
    }
  }

  assert(allClaimsHaveEvidence, "Done When: Each claim shows an evidence list with source, snippet, link, and stance");
  assert(totalEvidenceRows > 0, `Total evidence rows persisted in database: ${totalEvidenceRows}`);

  // Verify AuditLog record
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityId: testSub.id },
  });
  const evidenceAudit = auditLogs.find((a) => a.event === "PIPELINE_EVIDENCE_GATHERED");
  assert(evidenceAudit !== undefined, "AuditLog recorded 'PIPELINE_EVIDENCE_GATHERED' event");

  // Clean up test submission
  await prisma.submission.delete({
    where: { id: testSub.id },
  });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 3 TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Tests()
  .catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
