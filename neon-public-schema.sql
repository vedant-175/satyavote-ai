--
-- PostgreSQL database dump
--

\restrict urHT7fp8vl5z08ptUXfbevXfZsBcejvO7eHnUBkaHCp5LU1juC9lWwddQS4Azhu

-- Dumped from database version 18.7 (3190d2f)
-- Dumped by pg_dump version 19.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActorType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActorType" AS ENUM (
    'SYSTEM',
    'USER'
);


--
-- Name: EvidenceKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."EvidenceKind" AS ENUM (
    'FACT_CHECK',
    'WEB',
    'OFFICIAL',
    'SOURCE_CREDIBILITY',
    'IMAGE'
);


--
-- Name: PipelineRunStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PipelineRunStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: ReviewActionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReviewActionType" AS ENUM (
    'APPROVE',
    'OVERRIDE',
    'ESCALATE',
    'NOTE'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'SUBMITTER',
    'REVIEWER',
    'ADMIN'
);


--
-- Name: Stance; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Stance" AS ENUM (
    'SUPPORTS',
    'CONTRADICTS',
    'NEUTRAL'
);


--
-- Name: SubmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubmissionStatus" AS ENUM (
    'RECEIVED',
    'PROCESSING',
    'AI_SUGGESTED',
    'IN_REVIEW',
    'PUBLISHED',
    'REJECTED',
    'ESCALATED',
    'FAILED'
);


--
-- Name: SubmissionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubmissionType" AS ENUM (
    'LINK',
    'TEXT',
    'IMAGE'
);


--
-- Name: Verdict; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Verdict" AS ENUM (
    'SUPPORTED',
    'CONTRADICTED',
    'MISLEADING',
    'UNVERIFIED',
    'NOT_CHECKABLE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorType" public."ActorType" DEFAULT 'SYSTEM'::public."ActorType" NOT NULL,
    "actorId" text,
    event text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Claim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Claim" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    text text NOT NULL,
    "originalText" text,
    language text DEFAULT 'en'::text NOT NULL,
    checkable boolean DEFAULT true NOT NULL,
    embedding double precision[],
    "aiVerdict" public."Verdict" DEFAULT 'UNVERIFIED'::public."Verdict" NOT NULL,
    "aiConfidence" double precision DEFAULT 0.0 NOT NULL,
    "aiReasoning" text,
    "finalVerdict" public."Verdict",
    "finalNote" text,
    "reviewedById" text,
    "publishedAt" timestamp(3) without time zone,
    "matchedClaimId" text,
    "similarityScore" double precision,
    "repeatCount" integer DEFAULT 1 NOT NULL,
    topic text DEFAULT 'General'::text,
    state text DEFAULT 'National'::text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Evidence" (
    id text NOT NULL,
    "claimId" text NOT NULL,
    kind public."EvidenceKind" NOT NULL,
    "sourceName" text NOT NULL,
    url text,
    title text,
    snippet text,
    stance public."Stance" DEFAULT 'NEUTRAL'::public."Stance" NOT NULL,
    "retrievedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rawJson" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ImageAnalysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ImageAnalysis" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    "ocrText" text,
    "exifJson" jsonb,
    "reverseSearchJson" jsonb,
    "aiGeneratedScore" double precision,
    "perceptualHash" text,
    flags text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PipelineRun; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PipelineRun" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    step text NOT NULL,
    status public."PipelineRunStatus" DEFAULT 'PENDING'::public."PipelineRunStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    error text,
    "promptVersion" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ReviewAction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReviewAction" (
    id text NOT NULL,
    "claimId" text NOT NULL,
    "reviewerId" text NOT NULL,
    action public."ReviewActionType" NOT NULL,
    "fromVerdict" public."Verdict",
    "toVerdict" public."Verdict",
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SourceProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SourceProfile" (
    id text NOT NULL,
    domain text NOT NULL,
    "ageDays" integer,
    "reputationTier" text DEFAULT 'UNKNOWN'::text NOT NULL,
    notes text,
    "checkedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    type public."SubmissionType" NOT NULL,
    "rawText" text,
    url text,
    "imageUrl" text,
    language text DEFAULT 'en'::text NOT NULL,
    status public."SubmissionStatus" DEFAULT 'RECEIVED'::public."SubmissionStatus" NOT NULL,
    "submitterId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'SUBMITTER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Claim Claim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Claim"
    ADD CONSTRAINT "Claim_pkey" PRIMARY KEY (id);


--
-- Name: Evidence Evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_pkey" PRIMARY KEY (id);


--
-- Name: ImageAnalysis ImageAnalysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImageAnalysis"
    ADD CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY (id);


--
-- Name: PipelineRun PipelineRun_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PipelineRun"
    ADD CONSTRAINT "PipelineRun_pkey" PRIMARY KEY (id);


--
-- Name: ReviewAction ReviewAction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewAction"
    ADD CONSTRAINT "ReviewAction_pkey" PRIMARY KEY (id);


--
-- Name: SourceProfile SourceProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SourceProfile"
    ADD CONSTRAINT "SourceProfile_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog_actorType_actorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorType_actorId_idx" ON public."AuditLog" USING btree ("actorType", "actorId");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entity_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entity_entityId_idx" ON public."AuditLog" USING btree (entity, "entityId");


--
-- Name: AuditLog_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_event_idx" ON public."AuditLog" USING btree (event);


--
-- Name: Claim_aiVerdict_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_aiVerdict_idx" ON public."Claim" USING btree ("aiVerdict");


--
-- Name: Claim_finalVerdict_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_finalVerdict_idx" ON public."Claim" USING btree ("finalVerdict");


--
-- Name: Claim_publishedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_publishedAt_idx" ON public."Claim" USING btree ("publishedAt");


--
-- Name: Claim_repeatCount_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_repeatCount_idx" ON public."Claim" USING btree ("repeatCount");


--
-- Name: Claim_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_state_idx" ON public."Claim" USING btree (state);


--
-- Name: Claim_submissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_submissionId_idx" ON public."Claim" USING btree ("submissionId");


--
-- Name: Claim_topic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Claim_topic_idx" ON public."Claim" USING btree (topic);


--
-- Name: Evidence_claimId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Evidence_claimId_idx" ON public."Evidence" USING btree ("claimId");


--
-- Name: Evidence_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Evidence_kind_idx" ON public."Evidence" USING btree (kind);


--
-- Name: Evidence_stance_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Evidence_stance_idx" ON public."Evidence" USING btree (stance);


--
-- Name: ImageAnalysis_perceptualHash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ImageAnalysis_perceptualHash_idx" ON public."ImageAnalysis" USING btree ("perceptualHash");


--
-- Name: ImageAnalysis_submissionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ImageAnalysis_submissionId_key" ON public."ImageAnalysis" USING btree ("submissionId");


--
-- Name: PipelineRun_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PipelineRun_status_idx" ON public."PipelineRun" USING btree (status);


--
-- Name: PipelineRun_step_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PipelineRun_step_idx" ON public."PipelineRun" USING btree (step);


--
-- Name: PipelineRun_submissionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PipelineRun_submissionId_idx" ON public."PipelineRun" USING btree ("submissionId");


--
-- Name: ReviewAction_claimId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReviewAction_claimId_idx" ON public."ReviewAction" USING btree ("claimId");


--
-- Name: ReviewAction_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReviewAction_createdAt_idx" ON public."ReviewAction" USING btree ("createdAt");


--
-- Name: ReviewAction_reviewerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReviewAction_reviewerId_idx" ON public."ReviewAction" USING btree ("reviewerId");


--
-- Name: SourceProfile_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceProfile_domain_idx" ON public."SourceProfile" USING btree (domain);


--
-- Name: SourceProfile_domain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SourceProfile_domain_key" ON public."SourceProfile" USING btree (domain);


--
-- Name: SourceProfile_reputationTier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SourceProfile_reputationTier_idx" ON public."SourceProfile" USING btree ("reputationTier");


--
-- Name: Submission_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_createdAt_idx" ON public."Submission" USING btree ("createdAt");


--
-- Name: Submission_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_status_idx" ON public."Submission" USING btree (status);


--
-- Name: Submission_submitterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_submitterId_idx" ON public."Submission" USING btree ("submitterId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: Claim Claim_matchedClaimId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Claim"
    ADD CONSTRAINT "Claim_matchedClaimId_fkey" FOREIGN KEY ("matchedClaimId") REFERENCES public."Claim"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Claim Claim_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Claim"
    ADD CONSTRAINT "Claim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Claim Claim_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Claim"
    ADD CONSTRAINT "Claim_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Evidence Evidence_claimId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES public."Claim"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ImageAnalysis ImageAnalysis_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ImageAnalysis"
    ADD CONSTRAINT "ImageAnalysis_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PipelineRun PipelineRun_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PipelineRun"
    ADD CONSTRAINT "PipelineRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReviewAction ReviewAction_claimId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewAction"
    ADD CONSTRAINT "ReviewAction_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES public."Claim"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReviewAction ReviewAction_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReviewAction"
    ADD CONSTRAINT "ReviewAction_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_submitterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict urHT7fp8vl5z08ptUXfbevXfZsBcejvO7eHnUBkaHCp5LU1juC9lWwddQS4Azhu

