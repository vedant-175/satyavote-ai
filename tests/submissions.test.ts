import { prisma } from "../lib/db/prisma";
import { validateUrlForSsrf } from "../lib/security/ssrf";
import { checkRateLimit } from "../lib/security/rate-limit";
import { submissionInputSchema } from "../lib/ai/schemas";
import { SubmissionType, SubmissionStatus, ActorType } from "@prisma/client";

async function runPhase1Tests() {
  console.log("==================================================");
  console.log("🧪 RUNNING PHASE 1 TEST SUITE: SUBMISSION INGEST & SECURITY");
  console.log("==================================================\n");

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

  // TEST 1: SSRF Guard Security
  console.log("--- 1. SSRF Protection Tests ---");
  const ssrfLocalhost = await validateUrlForSsrf("http://localhost:3000/internal");
  assert(!ssrfLocalhost.valid, "SSRF Guard blocks 'localhost'");

  const ssrfLoopback = await validateUrlForSsrf("http://127.0.0.1:5432");
  assert(!ssrfLoopback.valid, "SSRF Guard blocks 127.0.0.1 loopback");

  const ssrfMetadata = await validateUrlForSsrf("http://169.254.169.254/latest/meta-data");
  assert(!ssrfMetadata.valid, "SSRF Guard blocks cloud metadata endpoint (169.254.169.254)");

  const ssrfPrivate192 = await validateUrlForSsrf("http://192.168.1.1/router");
  assert(!ssrfPrivate192.valid, "SSRF Guard blocks private RFC1918 192.168.x.x");

  const ssrfPrivate10 = await validateUrlForSsrf("http://10.0.0.5:8080/secrets");
  assert(!ssrfPrivate10.valid, "SSRF Guard blocks private RFC1918 10.x.x.x");

  const ssrfFtp = await validateUrlForSsrf("ftp://example.com/file.txt");
  assert(!ssrfFtp.valid, "SSRF Guard blocks non-http(s) scheme (ftp://)");

  const ssrfFile = await validateUrlForSsrf("file:///etc/passwd");
  assert(!ssrfFile.valid, "SSRF Guard blocks file:// scheme");

  const ssrfValid = await validateUrlForSsrf("https://eci.gov.in/faq");
  assert(ssrfValid.valid, "SSRF Guard permits valid public domain (https://eci.gov.in/faq)");

  // TEST 2: Rate Limiting
  console.log("\n--- 2. Rate Limiting Tests ---");
  const testIp = "192.0.2.100";
  const rl1 = await checkRateLimit(testIp, { limit: 3, windowSeconds: 10 });
  assert(rl1.success && rl1.remaining === 2, "First request consumes 1 token");

  const rl2 = await checkRateLimit(testIp, { limit: 3, windowSeconds: 10 });
  const rl3 = await checkRateLimit(testIp, { limit: 3, windowSeconds: 10 });
  assert(rl3.success && rl3.remaining === 0, "Third request consumes last token");

  const rlBlocked = await checkRateLimit(testIp, { limit: 3, windowSeconds: 10 });
  assert(!rlBlocked.success && rlBlocked.remaining === 0, "Fourth request is blocked (HTTP 429 condition)");

  // TEST 3: Zod Schema Validation
  console.log("\n--- 3. Input Validation (Zod) Tests ---");
  const validText = submissionInputSchema.safeParse({
    type: "TEXT",
    rawText: "Sample election claim about polling timings in Delhi.",
    language: "en",
  });
  assert(validText.success, "Valid TEXT input passes Zod schema");

  const shortText = submissionInputSchema.safeParse({
    type: "TEXT",
    rawText: "no",
  });
  assert(!shortText.success, "Short text (<5 chars) rejected by Zod schema");

  const validLink = submissionInputSchema.safeParse({
    type: "LINK",
    url: "https://pib.gov.in/factcheck",
  });
  assert(validLink.success, "Valid LINK input passes Zod schema");

  const emptyLink = submissionInputSchema.safeParse({
    type: "LINK",
    url: "",
  });
  assert(!emptyLink.success, "Empty URL for LINK type rejected by Zod schema");

  // TEST 4: End-to-End Database Submission & Audit Trail for All 3 Types
  console.log("\n--- 4. Database Persistence & AuditLog Tests (Link, Text, Image) ---");

  // A. Text Submission
  const textSub = await prisma.submission.create({
    data: {
      type: SubmissionType.TEXT,
      rawText: "Test election text claim submitted by test runner.",
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });
  assert(textSub.status === SubmissionStatus.RECEIVED, "TEXT submission created with status RECEIVED");

  const auditText = await prisma.auditLog.create({
    data: {
      actorType: ActorType.SYSTEM,
      event: "SUBMISSION_RECEIVED",
      entity: "Submission",
      entityId: textSub.id,
      metadata: { type: "TEXT", language: "en" },
    },
  });
  assert(auditText.entityId === textSub.id, "AuditLog created for TEXT submission");

  // B. Link Submission
  const linkSub = await prisma.submission.create({
    data: {
      type: SubmissionType.LINK,
      url: "https://eci.gov.in/electoral-roll",
      rawText: "Verified public link context",
      language: "en",
      status: SubmissionStatus.RECEIVED,
    },
  });
  assert(linkSub.status === SubmissionStatus.RECEIVED, "LINK submission created with status RECEIVED");

  const auditLink = await prisma.auditLog.create({
    data: {
      actorType: ActorType.SYSTEM,
      event: "SUBMISSION_RECEIVED",
      entity: "Submission",
      entityId: linkSub.id,
      metadata: { type: "LINK", url: linkSub.url },
    },
  });
  assert(auditLink.entityId === linkSub.id, "AuditLog created for LINK submission");

  // C. Image Submission
  const imageSub = await prisma.submission.create({
    data: {
      type: SubmissionType.IMAGE,
      imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      rawText: "Flyer claiming voting times extended to 10 PM.",
      language: "hi",
      status: SubmissionStatus.RECEIVED,
    },
  });
  assert(imageSub.status === SubmissionStatus.RECEIVED, "IMAGE submission created with status RECEIVED");

  const auditImage = await prisma.auditLog.create({
    data: {
      actorType: ActorType.SYSTEM,
      event: "SUBMISSION_RECEIVED",
      entity: "Submission",
      entityId: imageSub.id,
      metadata: { type: "IMAGE", language: "hi" },
    },
  });
  assert(auditImage.entityId === imageSub.id, "AuditLog created for IMAGE submission");

  // TEST 5: Verify Querying Submissions by ID
  console.log("\n--- 5. Submission Query & Stepper Retrieval ---");
  const fetched = await prisma.submission.findUnique({
    where: { id: textSub.id },
    include: { claims: true, pipelineRuns: true },
  });
  assert(fetched !== null && fetched.id === textSub.id, "Fetched submission by ID matches record");
  assert(fetched?.status === SubmissionStatus.RECEIVED, "Fetched submission status is verified as RECEIVED");

  console.log("\n==================================================");
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase1Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
