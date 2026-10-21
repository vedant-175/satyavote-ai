import { PrismaClient, Role, ActorType, SubmissionType, SubmissionStatus, Verdict, EvidenceKind, Stance } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clean existing records for idempotent runs
  await prisma.reviewAction.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.imageAnalysis.deleteMany();
  await prisma.pipelineRun.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.sourceProfile.deleteMany();
  await prisma.user.deleteMany();

  // 2. Hash passwords for demo users
  const salt = await bcrypt.genSalt(10);
  const submitterPassword = await bcrypt.hash("Submitter@123", salt);
  const reviewerPassword = await bcrypt.hash("Reviewer@123", salt);
  const adminPassword = await bcrypt.hash("Admin@123", salt);

  // 3. Seed Demo Users (One per role)
  const submitter = await prisma.user.create({
    data: {
      name: "Aarav Sharma (Citizen)",
      email: "submitter@electionverify.org",
      passwordHash: submitterPassword,
      role: Role.SUBMITTER,
    },
  });

  const reviewer = await prisma.user.create({
    data: {
      name: "Priya Nair (ECI Reviewer)",
      email: "reviewer@electionverify.org",
      passwordHash: reviewerPassword,
      role: Role.REVIEWER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Devendra Verma (Chief Admin)",
      email: "admin@electionverify.org",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`✅ Seeded 3 Demo Users:
  - SUBMITTER: ${submitter.email} (Password: Submitter@123)
  - REVIEWER:  ${reviewer.email}  (Password: Reviewer@123)
  - ADMIN:     ${admin.email}     (Password: Admin@123)`);

  // 4. Seed Known Official & Credible Source Profiles (Indian Election Context)
  const sourceProfiles = [
    {
      domain: "eci.gov.in",
      ageDays: 9500,
      reputationTier: "OFFICIAL",
      notes: "Official Portal of Election Commission of India (ECI). High authority source.",
    },
    {
      domain: "pib.gov.in",
      ageDays: 8500,
      reputationTier: "OFFICIAL",
      notes: "Press Information Bureau (PIB) Fact Check Unit. High authority government debunker.",
    },
    {
      domain: "ceodelhi.gov.in",
      ageDays: 7000,
      reputationTier: "OFFICIAL",
      notes: "Chief Electoral Officer Delhi official portal.",
    },
    {
      domain: "ceopunjab.gov.in",
      ageDays: 6800,
      reputationTier: "OFFICIAL",
      notes: "Chief Electoral Officer Punjab official portal.",
    },
    {
      domain: "altnews.in",
      ageDays: 2800,
      reputationTier: "CERTIFIED_FACT_CHECKER",
      notes: "IFCN certified independent Indian fact-checking organization.",
    },
    {
      domain: "boomlive.in",
      ageDays: 3400,
      reputationTier: "CERTIFIED_FACT_CHECKER",
      notes: "IFCN certified fact-checker specialized in multilingual debunks (English, Hindi, Bengali).",
    },
    {
      domain: "thequint.com",
      ageDays: 3600,
      reputationTier: "MAINSTREAM_NEWS",
      notes: "WebQoof fact-check division, certified by IFCN.",
    },
  ];

  for (const src of sourceProfiles) {
    await prisma.sourceProfile.create({ data: src });
  }
  console.log(`✅ Seeded ${sourceProfiles.length} authoritative source profiles.`);

  // 5. Seed Published Certified Claims for Public Library Demo
  const sub1 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Citizens without physical EPIC card are strictly banned from voting even if registered on electoral roll.",
      language: "en",
      status: SubmissionStatus.PUBLISHED,
      submitterId: submitter.id,
    },
  });

  const claim1 = await prisma.claim.create({
    data: {
      submissionId: sub1.id,
      text: "Citizens without a physical voter ID card cannot vote under any circumstances.",
      language: "en",
      checkable: true,
      embedding: [0.012, -0.045, 0.089, -0.003],
      topic: "Voter Identification & Rolls",
      state: "National",
      repeatCount: 14,
      aiVerdict: Verdict.CONTRADICTED,
      aiConfidence: 0.98,
      aiReasoning: "Debunked by Election Commission of India guidelines and PIB Fact Check.",
      finalVerdict: Verdict.CONTRADICTED,
      finalNote: "Debunked: ECI statutory instructions explicitly permit 12 alternative government-issued photo identity documents (Aadhaar, Passport, Driving License, PAN card, etc.) if elector name appears on voter list.",
      reviewedById: reviewer.id,
      publishedAt: new Date(Date.now() - 3600000 * 24),
    },
  });

  await prisma.evidence.createMany({
    data: [
      {
        claimId: claim1.id,
        kind: EvidenceKind.OFFICIAL,
        sourceName: "Election Commission of India (ECI)",
        url: "https://eci.gov.in/voter-education/faq/",
        title: "Voting without EPIC (Voter ID Card) Statutory FAQ",
        snippet: "If your name is on the electoral roll, you can cast your vote by presenting any of the 12 approved alternative photo ID documents.",
        stance: Stance.CONTRADICTS,
      },
      {
        claimId: claim1.id,
        kind: EvidenceKind.FACT_CHECK,
        sourceName: "PIB Fact Check Unit",
        url: "https://pib.gov.in/factcheck",
        title: "Clarification: Physical EPIC card is not mandatory for registered electors",
        snippet: "Clarification: 12 alternative documents including Aadhaar card are valid for identity verification at the polling booth.",
        stance: Stance.CONTRADICTS,
      },
    ],
  });

  // Second Published Claim: EVM Battery
  const sub2 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "EVMs with 99% battery charge are pre-programmed with tampered votes.",
      language: "en",
      status: SubmissionStatus.PUBLISHED,
      submitterId: submitter.id,
    },
  });

  const claim2 = await prisma.claim.create({
    data: {
      submissionId: sub2.id,
      text: "EVM machines with 99% battery charge have been pre-programmed with biased votes.",
      language: "en",
      checkable: true,
      embedding: [0.05, 0.12, -0.03, 0.08],
      topic: "EVM & Voting Technology",
      state: "National",
      repeatCount: 8,
      aiVerdict: Verdict.CONTRADICTED,
      aiConfidence: 0.96,
      aiReasoning: "ECI manual clarifies control unit battery provides power only and holds no programmatic or logic connection to counting memory.",
      finalVerdict: Verdict.CONTRADICTED,
      finalNote: "ECI technical compendium confirms Control Unit battery is an off-the-shelf standard alkaline power pack powering the display. It has zero data bus or micro-controller write access to vote memory chips.",
      reviewedById: reviewer.id,
      publishedAt: new Date(Date.now() - 3600000 * 12),
    },
  });

  await prisma.evidence.create({
    data: {
      claimId: claim2.id,
      kind: EvidenceKind.OFFICIAL,
      sourceName: "Election Commission of India (ECI)",
      url: "https://eci.gov.in/evm-faq",
      title: "Technical FAQ on EVM Battery & Standalone Security Architecture",
      snippet: "Control unit battery only provides 7.5V electric current to LCD screen and buzzer. Memory chips are one-time programmable (OTP) and immutable.",
      stance: Stance.CONTRADICTS,
    },
  });

  // Third Published Claim: Maharashtra Polling Hours
  const sub3 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Voting hours in rural Gadchiroli polling booths conclude at 3 PM due to daylight security protocol.",
      language: "en",
      status: SubmissionStatus.PUBLISHED,
      submitterId: submitter.id,
    },
  });

  const claim3 = await prisma.claim.create({
    data: {
      submissionId: sub3.id,
      text: "Voting hours in designated remote booths in Gadchiroli close at 3 PM.",
      language: "en",
      checkable: true,
      embedding: [-0.02, 0.04, 0.11, 0.01],
      topic: "Polling Operations & Schedule",
      state: "Maharashtra",
      repeatCount: 3,
      aiVerdict: Verdict.SUPPORTED,
      aiConfidence: 0.94,
      aiReasoning: "Chief Electoral Officer Maharashtra official circular sets modified voting hours for sensitive forest constituencies.",
      finalVerdict: Verdict.SUPPORTED,
      finalNote: "Verified: Maharashtra CEO notification mandates 7 AM to 3 PM for designated interior left-wing affected polling booths for security personnel escort.",
      reviewedById: reviewer.id,
      publishedAt: new Date(Date.now() - 3600000 * 4),
    },
  });

  await prisma.evidence.create({
    data: {
      claimId: claim3.id,
      kind: EvidenceKind.OFFICIAL,
      sourceName: "CEO Maharashtra Gazette",
      url: "https://ceomaharashtra.gov.in/notifications",
      title: "Statutory Order on Polling Hours for Remote Booths",
      snippet: "In exercise of powers under Section 56 of RP Act 1951, poll hours fixed from 7:00 AM to 3:00 PM for sensitive booths.",
      stance: Stance.SUPPORTS,
    },
  });

  // Fourth Published Claim: Multilingual Hindi Misleading EVM Video
  const sub4 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "निजी वाहनों का उपयोग मतदान समाप्ति के बाद ईवीएम ले जाने के लिए किया गया।",
      language: "hi",
      status: SubmissionStatus.PUBLISHED,
      submitterId: submitter.id,
    },
  });

  const claim4 = await prisma.claim.create({
    data: {
      submissionId: sub4.id,
      text: "Private vehicles were used to transport voting machines after voting concluded.",
      originalText: "निजी वाहनों का उपयोग मतदान समाप्ति के बाद ईवीएम ले जाने के लिए किया गया।",
      language: "hi",
      checkable: true,
      embedding: [0.03, -0.01, 0.09, 0.04],
      topic: "EVM & Voting Technology",
      state: "National",
      repeatCount: 5,
      aiVerdict: Verdict.MISLEADING,
      aiConfidence: 0.88,
      aiReasoning: "Forensic image & video analysis detected recycled historical footage from 2019 attributed deceptively to current polling day.",
      finalVerdict: Verdict.MISLEADING,
      finalNote: "Misleading: Video dates back to 2019 Assam election following an official vehicle breakdown. It has been recirculated out of context.",
      reviewedById: reviewer.id,
      publishedAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  await prisma.evidence.createMany({
    data: [
      {
        claimId: claim4.id,
        kind: EvidenceKind.FACT_CHECK,
        sourceName: "BOOM FactCheck Hindi",
        url: "https://boomlive.in/hindi/evm-recycled-video-debunk",
        title: "पुराना 2019 वीडियो हालिया चुनाव का बताकर भ्रामक दावे के साथ वायरल",
        snippet: "जांच में पाया गया कि यह वीडियो 2019 का है और इसका वर्तमान चुनाव से कोई संबंध नहीं है।",
        stance: Stance.CONTRADICTS,
      },
      {
        claimId: claim4.id,
        kind: EvidenceKind.IMAGE,
        sourceName: "Forensic Media Verification",
        url: "https://eci.gov.in/factcheck",
        title: "Perceptual Hash Duplicate Match: Earliest Recorded 2019-04-18",
        snippet: "Keyframes match archived footage from 2019 Lok Sabha phase 2.",
        stance: Stance.CONTRADICTS,
      },
    ],
  });

  // Fifth Published Claim: Multilingual Punjabi Home Voting
  const sub5 = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "85 ਸਾਲ ਅਤੇ ਇਸ ਤੋਂ ਵੱਧ ਉਮਰ ਦੇ ਬਜ਼ੁਰਗ ਨਾਗਰਿਕ ਘਰ ਬੈਠੇ ਵੋਟ ਪਾ ਸਕਦੇ ਹਨ।",
      language: "pa",
      status: SubmissionStatus.PUBLISHED,
      submitterId: submitter.id,
    },
  });

  const claim5 = await prisma.claim.create({
    data: {
      submissionId: sub5.id,
      text: "Elderly citizens aged 85 and above can vote from home using postal ballot facility.",
      originalText: "85 ਸਾਲ ਅਤੇ ਇਸ ਤੋਂ ਵੱਧ ਉਮਰ ਦੇ ਬਜ਼ੁਰਗ ਨਾਗਰਿਕ ਘਰ ਬੈਠੇ ਵੋਟ ਪਾ ਸਕਦੇ ਹਨ।",
      language: "pa",
      checkable: true,
      embedding: [-0.01, 0.08, 0.03, -0.05],
      topic: "Voter Identification & Rolls",
      state: "Punjab",
      repeatCount: 4,
      aiVerdict: Verdict.SUPPORTED,
      aiConfidence: 0.95,
      aiReasoning: "Chief Electoral Officer Punjab circular formally confirms home voting facility for 85+ voters.",
      finalVerdict: Verdict.SUPPORTED,
      finalNote: "Verified: Election Commission guidelines under Rule 27A permit electors aged 85+ to exercise franchise via home postal ballot.",
      reviewedById: reviewer.id,
      publishedAt: new Date(Date.now() - 3600000 * 1),
    },
  });

  await prisma.evidence.create({
    data: {
      claimId: claim5.id,
      kind: EvidenceKind.OFFICIAL,
      sourceName: "Chief Electoral Officer Punjab",
      url: "https://ceopunjab.gov.in/home-voting-elderly",
      title: "ਵੋਟਿੰਗ ਪ੍ਰਕਿਰਿਆ: 85 ਸਾਲ ਤੋਂ ਵੱਧ ਉਮਰ ਦੇ ਬਜ਼ੁਰਗਾਂ ਲਈ ਘਰ ਬੈਠੇ ਵੋਟਿੰਗ ਦੀ ਸਹੂਲਤ",
      snippet: "ਚੋਣ ਕਮਿਸ਼ਨ ਵੱਲੋਂ ਫਾਰਮ 12ਡੀ ਰਾਹੀਂ ਘਰ ਬੈਠੇ ਵੋਟ ਪਾਉਣ ਦੀ ਨਵੀਂ ਸਹੂਲਤ ਜਾਰੀ ਕੀਤੀ ਗਈ ਹੈ।",
      stance: Stance.SUPPORTS,
    },
  });

  // 6. Log Initial Seed in AuditLog
  await prisma.auditLog.create({
    data: {
      actorType: ActorType.SYSTEM,
      actorId: admin.id,
      event: "DATABASE_SEEDED",
      entity: "SYSTEM",
      entityId: "INIT",
      metadata: {
        timestamp: new Date().toISOString(),
        demoUsers: 3,
        sources: sourceProfiles.length,
        publishedClaims: 3,
        version: "1.0.0",
      },
    },
  });

  console.log("🎉 Seeding completed successfully with 3 certified published election claims!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
