import { prisma } from "../lib/db/prisma";
import { hasRole } from "../lib/security/rbac";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING PHASE 0 TEST SUITE: DB & RBAC SECURITY");
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

  // TEST 1: Database Connectivity and Models
  console.log("--- 1. Database & Schema Verification ---");
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  assert(users.length >= 3, `Found ${users.length} seeded users (expected at least 3)`);

  const submitter = users.find((u) => u.role === Role.SUBMITTER);
  const reviewer = users.find((u) => u.role === Role.REVIEWER);
  const admin = users.find((u) => u.role === Role.ADMIN);

  assert(!!submitter, "SUBMITTER user exists in database");
  assert(!!reviewer, "REVIEWER user exists in database");
  assert(!!admin, "ADMIN user exists in database");

  const sources = await prisma.sourceProfile.findMany();
  assert(sources.length >= 7, `Authoritative sources seeded (${sources.length} sources)`);

  const claims = await prisma.claim.findMany({ include: { evidence: true } });
  assert(claims.length >= 1, `Atomic claims seeded (${claims.length} claims)`);
  assert(
    claims[0]?.evidence?.length >= 2,
    `Claim #${claims[0]?.id?.slice(0, 8)} has ${claims[0]?.evidence?.length} grounded evidence items`
  );

  const audits = await prisma.auditLog.findMany();
  assert(audits.length >= 1, `System audit logs seeded (${audits.length} logs)`);

  // TEST 2: Password Security & Credentials Verification
  console.log("\n--- 2. Credentials & Password Hashing ---");
  if (submitter) {
    const valid = await bcrypt.compare("Submitter@123", submitter.passwordHash);
    const invalid = await bcrypt.compare("WrongPassword", submitter.passwordHash);
    assert(valid, "Submitter password matches hashed salt");
    assert(!invalid, "Invalid password correctly rejected");
  }

  if (reviewer) {
    const valid = await bcrypt.compare("Reviewer@123", reviewer.passwordHash);
    assert(valid, "Reviewer password matches hashed salt");
  }

  if (admin) {
    const valid = await bcrypt.compare("Admin@123", admin.passwordHash);
    assert(valid, "Admin password matches hashed salt");
  }

  // TEST 3: RBAC Role Logic & Permission Hierarchy
  console.log("\n--- 3. Role-Based Access Control (RBAC) Logic ---");

  // Admin routes: ONLY ADMIN
  assert(hasRole(Role.ADMIN, [Role.ADMIN]), "ADMIN can access /admin route");
  assert(!hasRole(Role.REVIEWER, [Role.ADMIN]), "REVIEWER cannot access /admin route");
  assert(!hasRole(Role.SUBMITTER, [Role.ADMIN]), "SUBMITTER cannot access /admin route");
  assert(!hasRole(undefined, [Role.ADMIN]), "Guest/Anonymous cannot access /admin route");

  // Reviewer routes: REVIEWER and ADMIN
  assert(hasRole(Role.REVIEWER, [Role.REVIEWER, Role.ADMIN]), "REVIEWER can access /reviewer queue");
  assert(hasRole(Role.ADMIN, [Role.REVIEWER, Role.ADMIN]), "ADMIN can access /reviewer queue");
  assert(!hasRole(Role.SUBMITTER, [Role.REVIEWER, Role.ADMIN]), "SUBMITTER cannot access /reviewer queue");
  assert(!hasRole(null, [Role.REVIEWER, Role.ADMIN]), "Guest/Anonymous cannot access /reviewer queue");

  // Submitter routes: Any authenticated user
  assert(hasRole(Role.SUBMITTER, [Role.SUBMITTER, Role.REVIEWER, Role.ADMIN]), "SUBMITTER can access user submission areas");
  assert(hasRole(Role.REVIEWER, [Role.SUBMITTER, Role.REVIEWER, Role.ADMIN]), "REVIEWER can access user submission areas");
  assert(hasRole(Role.ADMIN, [Role.SUBMITTER, Role.REVIEWER, Role.ADMIN]), "ADMIN can access user submission areas");

  console.log("\n==================================================");
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
