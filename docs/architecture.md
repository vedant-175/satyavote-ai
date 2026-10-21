# System Architecture & Specifications

## 3.1 High-Level Architecture Diagram

```
                          ┌──────────────────────────────┐
                          │        Next.js Frontend       │
                          │ Submit • Result • Reviewer •  │
                          │ Admin • Public Claims • Stats │
                          └──────────────┬───────────────┘
                                         │ HTTPS
                          ┌──────────────▼───────────────┐
                          │ Next.js Server Layer          │
                          │ Route Handlers / Server Actions│
                          │ Auth • RBAC • Validation •    │
                          │ Rate limit                    │
                          └───────┬───────────────┬───────┘
                                  │               │
                    enqueue job   │               │ read/write
                                  ▼               ▼
                     ┌────────────────┐   ┌──────────────────┐
                     │ Job Queue       │   │ PostgreSQL       │
                     │ (Inngest/BullMQ)│   │ + pgvector       │
                     └───────┬────────┘   └──────────────────┘
                             │                      ▲
                             ▼                      │
        ┌──────────────────────────────────────────┴──────────┐
        │              VERIFICATION PIPELINE (worker)          │
        │                                                      │
        │ 1 Ingest ─► 2 Extract content ─► 3 Claim extraction  │
        │      │            (URL scrape /      (LLM → atomic   │
        │      │             OCR / text)        claims)        │
        │      ▼                                               │
        │ 4 Dedup check (embeddings) ──► reuse prior verdict?  │
        │      ▼                                               │
        │ 5 Evidence gathering (parallel)                      │
        │    ├─ Fact-check DB (Google Fact Check API)          │
        │    ├─ Web search (Tavily/Brave/SerpAPI)              │
        │    ├─ Official sources (ECI/PIB search)              │
        │    └─ Source credibility (domain, WHOIS, reputation) │
        │      ▼                                               │
        │ 6 Image analysis (if image)                          │
        │    ├─ OCR  ├─ EXIF  ├─ Reverse image search          │
        │    ├─ AI-generated likelihood  └─ Perceptual hash    │
        │      ▼                                               │
        │ 7 Evidence-grounded LLM judgement per claim          │
        │      ▼                                               │
        │ 8 Scoring & aggregation ─► status = AI_SUGGESTED     │
        └──────────────────────────────┬───────────────────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ Human Review Queue      │
                          │ approve / override /    │
                          │ add notes / escalate    │
                          └────────────┬───────────┘
                                       ▼
                          ┌────────────────────────┐
                          │ PUBLISHED verdict       │
                          │ Public claims page      │
                          └────────────────────────┘
```

## 3.2 Submission State Machine

```
RECEIVED → PROCESSING → AI_SUGGESTED → IN_REVIEW → PUBLISHED
                │                           │
                └──► FAILED (retryable)     └──► REJECTED / ESCALATED
```

## 3.3 Roles & Permissions

| Role | Permissions |
|---|---|
| **Submitter** (or anonymous) | Submit election content (link/text/image), view own submission results (status: "pending review" until published) |
| **Reviewer** | View review queue, inspect evidence & confidence metrics, approve/override verdicts, add notes, escalate claims |
| **Admin** | Full system access, manage users & roles, manage source allowlists, inspect audit logs, analytics |

## 3.4 Evidence Scoring Model (Explainable)

Per claim, compute an explainable score from weighted signals:

| Signal | Weight | Description |
|---|---|---|
| Matching published fact-check | High | Direct match with recognized fact-checking organizations |
| Official source corroboration/contradiction | High | Direct corroboration or contradiction from ECI, PIB, or State CEOs |
| Multiple independent credible sources agree | Medium | Cross-verified news reports from established organizations |
| Source credibility of the submitted link | Medium | Domain age, reputation tier, historical accuracy |
| Image forensic flags | Medium | Detection of image reuse, tampering, or AI-generation |
| LLM entailment on retrieved evidence | Medium | Evidence-grounded entailment (SUPPORTS / CONTRADICTS / NEUTRAL) |

**Output Schema**: `{ verdict, confidence (0–1), reasons[], evidenceIds[] }`.  
**Hard Rule**: If `confidence < threshold` OR `evidence count == 0` → status becomes `UNVERIFIED`.

## 3.5 Database Schema Entities

- **User**: Authentication, role assignments (`SUBMITTER`, `REVIEWER`, `ADMIN`), creation timestamps.
- **Submission**: Ingested item (`LINK`, `TEXT`, `IMAGE`), payload, status lifecycle, submitter relation.
- **Claim**: Decomposed atomic claims, embeddings for deduplication, AI verdict & confidence, reviewer resolution.
- **Evidence**: Extracted items (`FACT_CHECK`, `WEB`, `OFFICIAL`, `SOURCE_CREDIBILITY`, `IMAGE`), stance, URL, raw JSON.
- **ImageAnalysis**: OCR text, EXIF metadata, reverse image search results, AI likelihood score, perceptual hash.
- **SourceProfile**: Domain authority, registration age, reputation tier, credibility notes.
- **ReviewAction**: Audit trail of human reviewer actions (`APPROVE`, `OVERRIDE`, `ESCALATE`, `NOTE`).
- **AuditLog**: Complete system & user event log with before/after state diffs.
- **PipelineRun**: Step-by-step pipeline execution logs, status, error trace, prompt version.

## 3.6 Directory Structure

```
/app
  /(public)        home, submit, result/[id], claims (public), methodology
  /(auth)          login, register
  /(reviewer)      queue, review/[claimId]
  /(admin)         users, sources, audit, analytics
  /api             submissions, claims, review, webhooks/jobs, health
/components        ui (shadcn), evidence-card, verdict-badge, claim-list, image-panel
/lib
  /ai              provider.ts, prompts/, schemas.ts
  /integrations    factcheck.ts, search.ts, eci.ts, pib.ts, reverse-image.ts, whois.ts, ocr.ts
  /pipeline        steps/*.ts, orchestrator.ts
  /scoring         score.ts, config
  /security        ssrf.ts, rate-limit.ts, rbac.ts
  /db              prisma client, queries
/config            scoring.ts, sources.ts
/jobs              inngest functions
/tests
/docs              architecture.md, methodology.md, limitations.md
```
