# SatyaVote AI — AI-Assisted Election Information Verification Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-indigo?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%204-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Academic Project & Engineering Prototype**  
> An explainable, evidence-grounded verification system designed for Indian electoral misinformation, featuring atomic claim extraction, parallel source retrieval (ECI, PIB Fact Check, State CEOs), multimodal image forensics, mandatory Human-In-The-Loop review, vector similarity knowledge reuse, and real-time statistical analytics.

---

## 1. System Overview & Core Philosophy

Election misinformation in India spreads across private messaging apps, public social feeds, and hyper-local media in multiple languages (English, Hindi, Punjabi, Marathi, Bengali, Tamil, etc.). Automated black-box AI fact-checkers are prone to hallucinations, lack legal accountability, and struggle with regional context.

**SatyaVote AI operates on a fundamental governing principle:**
> **"AI assists; accredited human fact-checkers decide."**

- **Provisional AI Outputs**: Every AI assessment enters the provisional state of `AI_SUGGESTED` with an explainable confidence score ($0.0 - 1.0$) and cited evidence URLs.
- **Mandatory Human Review**: Only reviewer-approved items advance to `PUBLISHED`. Unapproved or escalated claims are completely shielded from the public database.
- **Zero-Hallucination Fallback**: When authoritative evidence is absent, the system strictly defaults to `UNVERIFIED` rather than fabricating an answer.
- **Vector Knowledge Reuse**: Historical human-approved verdicts are indexed using 128-dimensional embedding vectors. Resubmitted claims surface prior verified results instantly in **< 100ms**.

---

## 2. High-Level Architecture

```
                          ┌──────────────────────────────┐
                          │   Next.js 16 (App Router)    │
                          │ Submit • Result • Reviewer • │
                          │ Admin • Public Claims • Stats│
                          └──────────────┬───────────────┘
                                         │ HTTPS / NextAuth JWT
                          ┌──────────────▼───────────────┐
                          │ Next.js Server Layer          │
                          │ SSRF Guard • Rate Limiter •  │
                          │ Server Actions • RBAC Matrix │
                          └───────┬───────────────┬───────┘
                                  │               │
                    enqueue job   │               │ read/write
                                  ▼               ▼
                     ┌────────────────┐   ┌──────────────────┐
                     │ Job Queue      │   │ PostgreSQL 16    │
                     │ (Inngest/Bull) │   │ + Prisma Client  │
                     └───────┬────────┘   └──────────────────┘
                             │                      ▲
                             ▼                      │
        ┌──────────────────────────────────────────┴──────────┐
        │             VERIFICATION PIPELINE (WORKER)          │
        │                                                     │
        │ 1 Ingestion ─► 2 Readability/OCR ─► 3 Claims Extr.  │
        │    (Link/Text/Image)  (Language Detect)  (Atomic)   │
        │                                                     │
        │ 4 Vector Similarity Dedup ──► Match? Reuse Verdict! │
        │                                                     │
        │ 5 Parallel Evidence Retrieval (Promise.allSettled)  │
        │    ├─ Google Fact Check API  ├─ Web Search API      │
        │    ├─ ECI / PIB Fact Check   └─ WHOIS Credibility   │
        │                                                     │
        │ 6 Multimodal Image Forensics                        │
        │    ├─ dHash Perceptual Hash  ├─ EXIF GPS Strip      │
        │    ├─ Reverse Image Search   └─ AI Likelihood Score │
        │                                                     │
        │ 7 Evidence-Grounded Scoring (§3.4)                  │
        │    └─ Verdict + Confidence + Explanation + Sources  │
        └──────────────────────────────┬──────────────────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ Human Review Desk      │
                          │ 1-Click Approve        │
                          │ Reasoned Override      │
                          │ Escalation             │
                          └────────────┬───────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ PUBLISHED Status       │
                          │ Public Claims Permalinks│
                          │ Live Recharts Analytics│
                          └────────────────────────┘
```

---

## 3. Quickstart — One-Command Local Setup

### Prerequisites
- **Node.js**: v18.17+ or v20+
- **PostgreSQL**: Running locally or via cloud (Neon, Supabase)
- **Git**

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/election-verification-platform.git
   cd election-verification-platform
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or configure your database credentials):
   ```ini
   DATABASE_URL="postgresql://postgres:password@localhost:5432/election_verification?schema=public"
   AUTH_SECRET="your-super-secret-random-key-at-least-32-chars-long"
   NEXTAUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Initialize Database & Seed Demo Data**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open **`http://localhost:3000`** in your browser.

---

## 4. Demo Accounts & Credentials

The database seed (`npm run db:seed`) provides pre-configured credentials representing all 3 platform roles:

| Role | Email Address | Password | Permissions & Surface |
|---|---|---|---|
| **Submitter** | `submitter@electionverify.org` | `Submitter@123` | Submit election links/text/images; track own submission status (`/submit`, `/result/[id]`). |
| **Reviewer** | `reviewer@electionverify.org` | `Reviewer@123` | Inspect 3-column verification desk; 1-click Approve; Reasoned Override with notes; Escalate claims (`/reviewer`). |
| **Admin** | `admin@electionverify.org` | `Admin@123` | Full administrative governance; user role manager; authoritative source allowlist editor; immutable audit log viewer (`/admin`). |

> **Quick Login**: The `/login` page features **1-Click Demo Buttons** allowing evaluators to switch roles instantly without typing.

---

## 5. Step-by-Step Presentation & Demo Script

Follow this script during academic presentations or evaluator walk-throughs:

### Step 1: Browse Public Certified Claims & Multilingual Toggle
1. Navigate to **`http://localhost:3000/claims`**.
2. Notice the certified claims verified by accredited fact-checkers.
3. In the top navbar, click **`हिन्दी`** or **`ਪੰਜਾਬੀ`**.
   - Observe the entire interface (navigation, search bar, verdict pills, categories) seamlessly translate into Hindi or Punjabi.
4. Click **`View Full Verification Report`** on any claim to see the shareable permalink with dynamic social OpenGraph cards, reviewer determination notes, and primary ECI/PIB citations.

### Step 2: Live Analytics & Disinformation Trends
1. Navigate to **`http://localhost:3000/analytics`**.
2. Inspect live database statistics:
   - **Published Verdict Distribution**: Interactive Recharts Donut chart.
   - **Trending Election Topics**: Stacked BarChart showing claims across EVM, Voter ID, Model Code of Conduct, etc.
   - **Geographic Spread**: BarChart of jurisdictional spread across Indian states.
   - **AI-vs-Human Agreement Rate**: Real-time concordance rate (e.g., $96\%$) with breakdown of human overrides.
   - **Average Review Time**: Real-time turnaround tracker.

### Step 3: Intake & Real-Time Pipeline Processing
1. Navigate to **`http://localhost:3000/submit`**.
2. Test input across any of the 3 tabs:
   - **Text Tab**: Paste an election claim (e.g. *"Citizens without voter ID card are banned from voting in 2026 Lok Sabha elections."*).
   - **Link Tab**: Enter a public election news URL (protected by SSRF guard against private IPs).
   - **Image Tab**: Upload a forwarded poster image (forensic pipeline extracts text, checks dHash perceptual hash, strips EXIF GPS, and evaluates AI synthesis).
3. Click **`Submit for Verification`**.
4. Watch the real-time **Pipeline Stepper** on `/result/[id]` poll through:
   - `Content Extraction` $\to$ `Claim Extraction` $\to$ `Vector Dedup` $\to$ `Evidence Gathering` $\to$ `AI Judgement`.

### Step 4: Knowledge Reuse & Viral Claim Detection (Done-When Condition)
1. Re-submit a known election claim in `/submit`:
   > *"Electors without physical voter ID card are prohibited from voting."*
2. The vector similarity engine identifies the canonical claim, adopts the certified verdict, and surfaces:
   > **`⚡ Knowledge Reuse: Similar claim already verified by human fact-checker`** with an instant link to the public report in **< 100ms**!
3. Observe the claim's **Virality Counter** increment (`🔥 Viral Recirculation: 15x`).

### Step 5: Human Reviewer Adjudication Desk
1. Log in as **Reviewer** (`reviewer@electionverify.org`).
2. Navigate to **`http://localhost:3000/reviewer`**.
3. View the priority queue (sorted by urgency, viral duplicate volume, or low confidence).
4. Click **`Review Claim`** to enter the 3-column verification workspace:
   - **Column 1**: Original submission context and image panel.
   - **Column 2**: Evidence list with stances, domain credibility tiers, and snippets.
   - **Column 3**: AI recommendation, confidence score, and adjudication buttons.
5. Demonstrate **1-Click Approve** or **Reasoned Override** (type justification note and select corrected verdict).
6. Verify the claim immediately becomes public at `/claims`.

### Step 6: Administrative Governance & Audit Trail
1. Log in as **Admin** (`admin@electionverify.org`).
2. Navigate to **`http://localhost:3000/admin`**.
3. Demonstrate:
   - **User Role Manager**: Promote or demote users between `SUBMITTER`, `REVIEWER`, and `ADMIN`.
   - **Source Allowlist**: Add, edit, or delete authoritative domains (`eci.gov.in`, `pib.gov.in`, `altnews.in`).
   - **Immutable Audit Log**: Inspect the cryptographic event ledger showing actor attribution, event type, timestamps, and before/after diffs.

---

## 6. Automated Testing & Evaluation Benchmark

The repository features comprehensive end-to-end automated test suites covering all 9 architectural phases:

```bash
# Run all 9 phase test suites (346 tests passing)
npm test

# Run individual phase suites
npm run test:phase0    # RBAC, password hashing, route guards
npm run test:phase1    # SSRF guard, rate limiter, submission intake
npm run test:phase2    # Article scraping, language detection, atomic claims
npm run test:phase3    # Parallel evidence gathering, source credibility
npm run test:phase4    # Image forensics, perceptual hashing, EXIF stripping
npm run test:phase5    # Explainable scoring engine, edge case rules
npm run test:phase6    # Reviewer queue, 1-click approve, override, admin
npm run test:phase7    # Vector similarity, knowledge reuse, viral counter
npm run test:phase8    # Live analytics telemetry, i18n English/Hindi/Punjabi
```

### Benchmark Evaluation (Gold Standard)
Run the 25-claim gold-standard election evaluation benchmark:
```bash
npx tsx scripts/evaluate-benchmark.ts
```

**Evaluation Summary (`docs/evaluation-report.md`)**:
- **Top-1 Categorical Accuracy**: **96.0%** (24/25 claims matching ground truth)
- **Zero-Evidence Fallback Rate**: **12.0%** (3/25 claims correctly fallen back to `UNVERIFIED`)
- **Mean Grounding Confidence**: **73.5%**
- **AI-vs-Human Agreement Rate**: **96.0%**
- **Zero-Hallucination Adherence**: **100%** (zero speculative fabrication when evidence is absent)

---

## 7. Security & Hardening Checklist

Full details documented in **[`docs/security-review.md`](docs/security-review.md)**:

- [x] **SSRF Guard**: Pre-resolves DNS and blocks all private IPv4/IPv6 ranges (RFC 1918, loopbacks, link-local, cloud metadata `169.254.169.254`).
- [x] **RBAC Guards**: Server-side JWT session validation with role checks at middleware, route handler, and server action boundaries.
- [x] **Rate Limiting**: In-memory token-bucket sliding-window rate limiter per client IP/User.
- [x] **Voter Privacy**: Automatic stripping of EXIF GPS coordinates and camera serial numbers.
- [x] **Injection Immunity**: 100% Prisma parameterized SQL queries; React JSX auto-escaping.
- [x] **Immutable Auditing**: Append-only audit table logging every administrative and editorial action with before/after state diffs.

---

## 8. Deployment to Production (Vercel + Managed Postgres)

### 1. Database Provisioning
Provision a managed PostgreSQL database on **Neon**, **Supabase**, or **AWS RDS**:
- Enable pgvector extension (if using native vector columns): `CREATE EXTENSION IF NOT EXISTS vector;`

### 2. Environment Variables on Vercel
Set the following environment variables in your Vercel Project Settings:
```ini
DATABASE_URL="postgresql://user:password@ep-cool-db.us-east-2.aws.neon.tech/neondb?sslmode=require"
AUTH_SECRET="generated-production-auth-secret-32-chars-minimum"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXT_PUBLIC_APP_URL="https://your-domain.vercel.app"
```

### 3. Deploy via Vercel CLI or Git
```bash
vercel --prod
```
The included `vercel.json` automatically triggers `prisma generate && next build` and configures security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

---

## 9. Academic Documentation & References

- **Architecture Specification**: [`docs/architecture.md`](docs/architecture.md)
- **Benchmark Evaluation Report**: [`docs/evaluation-report.md`](docs/evaluation-report.md)
- **Security Review & Hardening**: [`docs/security-review.md`](docs/security-review.md)
- **Methodology & Ethics Charter**: Located online at `/methodology`

---

## 10. License & Ethics Notice

SatyaVote AI is developed strictly for **academic research, education, and public election integrity purposes**. It adheres to the guidelines of the **Election Commission of India (ECI)** and international standards established by the **International Fact-Checking Network (IFCN)**.

Distributed under the **MIT License**.
