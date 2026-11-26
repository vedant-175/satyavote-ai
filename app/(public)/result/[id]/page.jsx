"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Link2,
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Camera,
  Fingerprint,
  Search,
  Calendar,
  Cpu,
  AlertTriangle,
} from "lucide-react";

const PIPELINE_STEPS = [
  { key: "RECEIVED", label: "1. Intake & Security Scan", desc: "Stored with SSRF & size validation passed" },
  { key: "PROCESSING", label: "2. Content & Claim Extraction", desc: "URL scraping, OCR, and atomic claim extraction" },
  { key: "AI_SUGGESTED", label: "3. Multi-Source Evidence Grounding", desc: "ECI/PIB fact-check retrieval and claim scoring" },
  { key: "IN_REVIEW", label: "4. Human Reviewer Desk", desc: "Human fact-checker adjudicating evidence" },
  { key: "PUBLISHED", label: "5. Published Verdict", desc: "Final verdict accessible in public database" },
];

export default function SubmissionResultPage({ params }) {
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/submissions/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Submission not found. Please verify the ID.");
        } else {
          setError("Failed to retrieve submission details.");
        }
        return;
      }
      const json = await res.json();
      setData(json.data);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Network error while polling status.");
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 3 seconds if status is pending
    const interval = setInterval(() => {
      if (data?.status === "RECEIVED" || data?.status === "PROCESSING") {
        fetchStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, data?.status]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs text-slate-400 font-mono">Loading submission #{id ? id.slice(0, 8) : ""}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-100">Unable to Load Submission</h1>
          <p className="text-xs text-slate-400">{error || "Submission record does not exist."}</p>
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Submit New Claim</span>
          </Link>
        </div>
      </div>
    );
  }

  const getStepIndex = (status) => {
    switch (status) {
      case "RECEIVED":
        return 0;
      case "PROCESSING":
        return 1;
      case "AI_SUGGESTED":
        return 2;
      case "IN_REVIEW":
        return 3;
      case "PUBLISHED":
        return 4;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(data.status);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800">
              ID: #{data.id.slice(0, 10)}
            </span>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                data.status === "RECEIVED"
                  ? "bg-blue-950 text-blue-300 border-blue-800"
                  : data.status === "PROCESSING"
                  ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                  : data.status === "AI_SUGGESTED"
                  ? "bg-purple-950 text-purple-300 border-purple-800"
                  : data.status === "PUBLISHED"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              Status: {data.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-2">
            Election Verification Status Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingested on {new Date(data.createdAt).toLocaleString()} &bull; Primary language: <strong className="uppercase">{data.language}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/submit"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>New Submission</span>
          </Link>
        </div>
      </div>

      {/* Pipeline Progress Stepper */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Verification Pipeline Stepper
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Last polled: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={step.key}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  isCurrent
                    ? "bg-blue-950/40 border-blue-500/60 shadow-sm"
                    : isCompleted
                    ? "bg-emerald-950/20 border-emerald-900/40"
                    : "bg-slate-950/40 border-slate-800/80 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                    Step {idx + 1}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                </div>
                <h3
                  className={`text-xs font-semibold leading-tight ${
                    isCurrent ? "text-blue-300" : isCompleted ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{step.desc}</p>
              </div>
            );
          })}
        </div>

        {data.status === "RECEIVED" && (
          <div className="p-3.5 rounded-lg bg-blue-950/30 border border-blue-900/50 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <span>
                Submission safely received. Ingestion complete. Background pipeline worker active.
              </span>
            </div>
            <span className="text-[11px] font-mono text-blue-400">Queue: INGESTION</span>
          </div>
        )}

        {data.status === "AI_SUGGESTED" && (
          <div className="p-4 rounded-lg bg-purple-950/30 border border-purple-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <span className="font-semibold text-purple-200 block text-sm">
                  AI Grounded Judgement Complete &bull; Pushed to Human Review Desk
                </span>
                <span className="text-slate-400 text-xs">
                  Automated evidence grounding and explainable scoring have assigned preliminary verdicts. Final determination is pending reviewer desk adjudication.
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono px-3 py-1 rounded bg-purple-900/50 text-purple-300 border border-purple-700 font-semibold shrink-0">
              Queue: AWAITING_REVIEWER
            </span>
          </div>
        )}
      </div>

      {/* Submitted Content Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          {data.type === "LINK" ? (
            <Link2 className="w-4 h-4 text-blue-400" />
          ) : data.type === "IMAGE" ? (
            <ImageIcon className="w-4 h-4 text-purple-400" />
          ) : (
            <FileText className="w-4 h-4 text-emerald-400" />
          )}
          <span>Submitted Input Content ({data.type})</span>
        </h2>

        {data.url && (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="truncate max-w-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Source URL:</span>
              <span className="text-blue-400 font-mono truncate">{data.url}</span>
            </div>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 ml-2"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {data.rawText && (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
            <span className="text-slate-400 block text-[10px] uppercase font-mono mb-1">Raw Text / Context:</span>
            <p className="whitespace-pre-wrap font-sans">"{data.rawText}"</p>
          </div>
        )}

        {data.imageUrl && (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Image Asset:</span>
            <div className="max-h-72 overflow-hidden rounded bg-black flex items-center justify-center p-2">
              <img
                src={data.imageUrl}
                alt="Submitted election flyer"
                className="max-h-64 object-contain rounded"
              />
            </div>
          </div>
        )}
      </div>

      {/* Image Forensics & Visual Verification Panel */}
      {data.imageAnalysis && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Image Forensics & Visual Analysis
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {data.imageAnalysis.perceptualHash && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1">
                  <Fingerprint className="w-3 h-3 text-purple-400" />
                  <span>dHash: {data.imageAnalysis.perceptualHash}</span>
                </span>
              )}
              {data.imageAnalysis.aiGeneratedScore !== null &&
                data.imageAnalysis.aiGeneratedScore !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                      data.imageAnalysis.aiGeneratedScore >= 0.65
                        ? "bg-rose-950 text-rose-300 border-rose-800"
                        : data.imageAnalysis.aiGeneratedScore >= 0.35
                        ? "bg-amber-950 text-amber-300 border-amber-800"
                        : "bg-emerald-950 text-emerald-300 border-emerald-800"
                    }`}
                  >
                    <Cpu className="w-3 h-3" />
                    <span>
                      AI Likelihood: {Math.round(data.imageAnalysis.aiGeneratedScore * 100)}% (Estimate)
                    </span>
                  </span>
                )}
            </div>
          </div>

          {/* Forensic Discrepancy & Alert Flags */}
          {data.imageAnalysis.flags && data.imageAnalysis.flags.length > 0 && (
            <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/50 space-y-2">
              <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5 uppercase font-mono tracking-wide">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Forensic Warnings & Context Flags ({data.imageAnalysis.flags.length})</span>
              </span>
              <ul className="space-y-1.5 pt-1">
                {data.imageAnalysis.flags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-rose-200/90 flex items-start gap-2 bg-rose-950/40 p-2 rounded border border-rose-900/40 leading-relaxed font-sans"
                  >
                    <span className="text-rose-400 font-mono font-bold text-[11px] mt-0.5">&bull;</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Forensic Technical Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* EXIF Metadata Card */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>EXIF Metadata</span>
              </span>
              <div className="space-y-1.5 text-slate-400 pt-1">
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Capture Date:</span>
                  <span className="text-slate-200 font-mono">
                    {data.imageAnalysis.exifJson?.captureDate || "None / Stripped"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Camera / Device:</span>
                  <span className="text-slate-200">
                    {[data.imageAnalysis.exifJson?.make, data.imageAnalysis.exifJson?.model]
                      .filter(Boolean)
                      .join(" ") || "Unspecified"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Software / Tool:</span>
                  <span className="text-slate-200">
                    {data.imageAnalysis.exifJson?.software || "None recorded"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">GPS Privacy:</span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    {data.imageAnalysis.exifJson?.hasGps
                      ? "Coordinates stripped before public display"
                      : "No GPS tags embedded"}
                  </span>
                </div>
              </div>
            </div>

            {/* Reverse Image Search Card */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reverse Image Search</span>
              </span>
              <div className="space-y-1.5 text-slate-400 pt-1">
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Earliest Appearance:</span>
                  <span className="text-slate-200 font-mono">
                    {data.imageAnalysis.reverseSearchJson?.earliestAppearanceDate || "Current election cycle"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Web Occurrences:</span>
                  <span className="text-slate-200">
                    {data.imageAnalysis.reverseSearchJson?.totalMatches ?? 0} historical match(es)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] block uppercase font-mono text-slate-500">Recycled Status:</span>
                  <span
                    className={`font-semibold ${
                      data.imageAnalysis.reverseSearchJson?.isRecycledMedia
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {data.imageAnalysis.reverseSearchJson?.isRecycledMedia
                      ? "Recycled Media Detected"
                      : "No historical mismatch found"}
                  </span>
                </div>
              </div>
            </div>

            {/* Extracted OCR Transcription Card */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>OCR Extracted Text</span>
              </span>
              <div className="space-y-1.5 pt-1">
                <p className="text-slate-200 bg-slate-900 p-2.5 rounded border border-slate-800/80 max-h-36 overflow-y-auto leading-relaxed text-xs">
                  {data.imageAnalysis.ocrText || "No visible text detected"}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Transcribed poster text decomposed into atomic claims below.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Atomic Claims & Evidence */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Extracted Atomic Claims ({data.claims.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {data.claims.length === 0 ? "Awaiting Claim Extractor" : `${data.claims.length} Claim(s)`}
          </span>
        </div>

        {data.claims.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-400 space-y-2">
            <Clock className="w-6 h-6 text-slate-500 mx-auto" />
            <p className="font-semibold text-slate-300">Claims Extraction in Progress</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              The verification pipeline is currently processing the content, scraping web text, and decomposing statements into atomic claims.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.claims.map((claim) => (
              <div
                key={claim.id}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200 font-mono">
                      Claim #{claim.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                        claim.checkable
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                          : "bg-purple-950 text-purple-300 border-purple-800"
                      }`}
                    >
                      {claim.checkable ? "Checkable Factual" : "Non-Checkable (Opinion/Prediction)"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Lang: {claim.language}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {claim.finalVerdict ? (
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border uppercase shadow-sm ${
                          claim.finalVerdict === "CONTRADICTED"
                            ? "bg-rose-950 text-rose-300 border-rose-800"
                            : claim.finalVerdict === "SUPPORTED"
                            ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                            : claim.finalVerdict === "MISLEADING"
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        OFFICIAL VERDICT: {claim.finalVerdict} (Human Certified)
                      </span>
                    ) : (
                      <>
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border uppercase ${
                            claim.aiVerdict === "CONTRADICTED"
                              ? "bg-rose-950 text-rose-300 border-rose-800"
                              : claim.aiVerdict === "SUPPORTED"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : claim.aiVerdict === "MISLEADING"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : claim.aiVerdict === "NOT_CHECKABLE"
                              ? "bg-purple-950 text-purple-300 border-purple-800"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          AI SUGGESTED: {claim.aiVerdict}
                        </span>
                        {claim.aiConfidence > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                            Confidence: {Math.round(claim.aiConfidence * 100)}%
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          Pending Review
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium text-slate-100 leading-relaxed">
                  "{claim.text}"
                </p>

                {claim.matchedClaimId && (
                  <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/40 text-xs text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>
                        <strong>Similar Claim Already Verified:</strong> Matched previous fact-check ({Math.round((claim.similarityScore ?? 0.9) * 100)}% similarity).
                      </span>
                    </div>
                    <Link
                      href={`/claims/${claim.matchedClaimId}`}
                      target="_blank"
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 shrink-0 underline"
                    >
                      <span>View Verified Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {claim.finalNote && (
                  <div className="text-xs text-slate-200 bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/60 space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Reviewer Adjudication Determination:</span>
                    </span>
                    <p className="leading-relaxed text-slate-200">{claim.finalNote}</p>
                  </div>
                )}

                {claim.aiReasoning && !claim.finalNote && (
                  <div className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>AI Grounded Judgement & Explanation:</span>
                    </span>
                    <p className="leading-relaxed text-slate-200">{claim.aiReasoning}</p>
                  </div>
                )}

                {/* Evidence Sources List */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span>Retrieved Evidence ({claim.evidence?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ECI / Fact-Check / Web / Domain
                    </span>
                  </div>

                  {!claim.evidence || claim.evidence.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-slate-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                      <span>Evidence gathering in progress for this claim...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {claim.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                                  ev.kind === "OFFICIAL"
                                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                    : ev.kind === "FACT_CHECK"
                                    ? "bg-purple-950 text-purple-300 border-purple-800"
                                    : ev.kind === "SOURCE_CREDIBILITY"
                                    ? "bg-amber-950 text-amber-300 border-amber-800"
                                    : "bg-blue-950 text-blue-300 border-blue-800"
                                }`}
                              >
                                {ev.kind === "OFFICIAL"
                                  ? "Official Authority"
                                  : ev.kind === "FACT_CHECK"
                                  ? "Fact Check"
                                  : ev.kind === "SOURCE_CREDIBILITY"
                                  ? "Domain Audit"
                                  : "Web Search"}
                              </span>
                              <span className="text-xs font-semibold text-slate-200">
                                {ev.sourceName}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${
                                ev.stance === "SUPPORTS"
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : ev.stance === "CONTRADICTS"
                                  ? "bg-rose-950 text-rose-300 border-rose-800"
                                  : "bg-slate-800 text-slate-300 border-slate-700"
                              }`}
                            >
                              {ev.stance === "SUPPORTS" ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>SUPPORTS</span>
                                </>
                              ) : ev.stance === "CONTRADICTS" ? (
                                <>
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  <span>CONTRADICTS</span>
                                </>
                              ) : (
                                <span>NEUTRAL CONTEXT</span>
                              )}
                            </span>
                          </div>

                          {ev.title && (
                            <div className="text-xs font-medium text-slate-200">
                              {ev.url ? (
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{ev.title}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ) : (
                                <span>{ev.title}</span>
                              )}
                            </div>
                          )}

                          {ev.snippet && (
                            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-2.5 rounded border border-slate-800/50">
                              "{ev.snippet}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Runs Audit & Telemetry */}
      {data.pipelineRuns && data.pipelineRuns.length > 0 && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Pipeline Execution Runs ({data.pipelineRuns.length} steps logged)</span>
          </h2>
          <div className="space-y-2">
            {data.pipelineRuns.map((run) => (
              <div
                key={run.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      run.status === "COMPLETED"
                        ? "bg-emerald-400"
                        : run.status === "RUNNING"
                        ? "bg-amber-400 animate-ping"
                        : "bg-rose-400"
                    }`}
                  />
                  <span className="font-mono text-slate-200 font-semibold">{run.step}</span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    started: {new Date(run.startedAt).toLocaleTimeString()}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                    run.status === "COMPLETED"
                      ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                      : run.status === "RUNNING"
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-rose-950 text-rose-300 border-rose-800"
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
        <Link href="/claims" className="hover:text-slate-200 flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Browse Public Verified Claims</span>
        </Link>
        <Link href="/methodology" className="hover:text-slate-200 flex items-center gap-1.5 transition-colors">
          <span>Methodology & Limitations</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
