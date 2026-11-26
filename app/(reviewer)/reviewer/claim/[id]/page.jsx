"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  AlertOctagon,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  History,
} from "lucide-react";

export default function ClaimReviewPage({ params }) {
  const { id: claimId } = use(params);
  const router = useRouter();

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeAction, setActiveAction] = useState("APPROVE");
  const [overrideVerdict, setOverrideVerdict] = useState("MISLEADING");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchClaim = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviewer/claims/${claimId}`);
      if (!res.ok) {
        throw new Error("Failed to load claim review details.");
      }
      const data = await res.json();
      setClaim(data.data);
      if (data.data.finalVerdict) {
        setOverrideVerdict(data.data.finalVerdict);
      } else {
        setOverrideVerdict(data.data.aiVerdict);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading claim.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaim();
  }, [claimId]);

  const handleAdjudicate = async () => {
    if (activeAction === "OVERRIDE") {
      if (!note || note.trim().length < 5) {
        alert("Please provide a justification note (at least 5 characters) for overriding the AI verdict.");
        return;
      }
    } else if (activeAction === "ESCALATE") {
      if (!note || note.trim().length < 3) {
        alert("Please provide an escalation note (at least 3 characters) for senior review.");
        return;
      }
    }

    setSubmitting(true);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/reviewer/claims/${claimId}/adjudicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: activeAction,
          newVerdict: activeAction === "OVERRIDE" ? overrideVerdict : undefined,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        alert(errJson.error?.message || "Failed to submit adjudication.");
        return;
      }

      setActionSuccess(`Claim successfully ${activeAction.toLowerCase()}d and audit log entry created.`);
      await fetchClaim();
    } catch {
      alert("Network error submitting review.");
    } finally {
      setSubmitting(false);
    }
  };

  const getVerdictStyle = (v) => {
    switch (v) {
      case "SUPPORTED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "CONTRADICTED":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "MISLEADING":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "NOT_CHECKABLE":
        return "bg-purple-950/80 text-purple-300 border-purple-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getStanceStyle = (stance) => {
    switch (stance) {
      case "SUPPORTS":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "CONTRADICTS":
        return "bg-rose-950 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 space-y-3">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono">Loading claim review workspace...</p>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-200">Unable to load claim</h2>
        <p className="text-xs text-slate-400">{error || "Claim record not found."}</p>
        <Link
          href="/reviewer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Reviewer Queue</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/reviewer"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Link href="/reviewer" className="hover:text-slate-200">Reviewer Queue</Link>
            <span>/</span>
            <span className="text-slate-200 font-bold">Claim #{claim.id.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Submission Status: <strong className="text-slate-200 font-mono">{claim.submission.status}</strong>
          </span>
          {claim.finalVerdict && (
            <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-semibold border ${getVerdictStyle(claim.finalVerdict)}`}>
              PUBLISHED: {claim.finalVerdict}
            </span>
          )}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-300 font-bold ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Original Submission</span>
            </h2>

            <div className="text-xs space-y-2 text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Type</span>
                <span className="font-mono uppercase text-slate-200">{claim.submission.type}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Language</span>
                <span className="font-mono uppercase text-slate-200">{claim.submission.language}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-500">Submitted</span>
                <span className="font-mono text-slate-200">{new Date(claim.submission.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Raw Input Content:</span>
              {claim.submission.url && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs break-all">
                  <a
                    href={claim.submission.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{claim.submission.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-auto" />
                  </a>
                </div>
              )}

              {claim.submission.imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-800">
                  <img
                    src={claim.submission.imageUrl}
                    alt="Submitted Election Media"
                    className="w-full max-h-48 object-cover bg-slate-950"
                  />
                </div>
              )}

              {claim.submission.rawText && (
                <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-56 overflow-y-auto">
                  {claim.submission.rawText}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>Extracted Claims ({claim.submission.claims.length})</span>
            </h2>
            <div className="space-y-2">
              {claim.submission.claims.map((sc, idx) => (
                <Link
                  key={sc.id}
                  href={`/reviewer/claim/${sc.id}`}
                  className={`block p-2.5 rounded-lg text-xs transition-all border ${
                    sc.id === claim.id
                      ? "bg-blue-950/40 border-blue-600/60 text-slate-100"
                      : "bg-slate-950 hover:bg-slate-800/40 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-500">Claim #{idx + 1}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getVerdictStyle(sc.finalVerdict || sc.aiVerdict)}`}>
                      {sc.finalVerdict || sc.aiVerdict}
                    </span>
                  </div>
                  <p className="line-clamp-2">{sc.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
                Atomic Claim Under Adjudication
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Language: {claim.language.toUpperCase()}
              </span>
            </div>

            <p className="text-lg font-bold text-slate-100 leading-snug">
              "{claim.text}"
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>AI Suggested Grounding</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border ${getVerdictStyle(claim.aiVerdict)}`}>
                    {claim.aiVerdict}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {(claim.aiConfidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
              </div>

              {claim.aiReasoning && (
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {claim.aiReasoning}
                </p>
              )}
            </div>
          </div>

          {claim.submission.imageAnalysis && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>Forensic Image Analysis</span>
              </h3>

              {claim.submission.imageAnalysis.flags.length > 0 && (
                <div className="space-y-1.5">
                  {claim.submission.imageAnalysis.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">Perceptual Hash (dHash)</span>
                  <span className="font-mono text-slate-300 truncate block">
                    {claim.submission.imageAnalysis.perceptualHash || "N/A"}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block">AI Generation Likelihood</span>
                  <span className="font-mono text-slate-300">
                    {claim.submission.imageAnalysis.aiGeneratedScore !== null
                      ? `${(claim.submission.imageAnalysis.aiGeneratedScore * 100).toFixed(0)}% (Estimate)`
                      : "N/A"}
                  </span>
                </div>
              </div>

              {claim.submission.imageAnalysis.ocrText && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">OCR Transcribed Text:</span>
                  <p className="text-slate-300 italic line-clamp-3">"{claim.submission.imageAnalysis.ocrText}"</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Retrieved Primary Evidence ({claim.evidence.length})</span>
              </h3>
            </div>

            {claim.evidence.length === 0 ? (
              <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
                No primary evidence retrieved for this claim.
              </div>
            ) : (
              <div className="space-y-2.5">
                {claim.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200">{ev.sourceName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {ev.kind}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${getStanceStyle(ev.stance)}`}>
                        {ev.stance}
                      </span>
                    </div>

                    {ev.title && (
                      <h4 className="text-xs font-medium text-slate-300">{ev.title}</h4>
                    )}

                    {ev.snippet && (
                      <p className="text-xs text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                        {ev.snippet}
                      </p>
                    )}

                    {ev.url && (
                      <div className="pt-1">
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1 max-w-full truncate"
                        >
                          <span>{ev.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Adjudication Control</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Certify this claim for public verification or override the automated assessment.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveAction("APPROVE")}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeAction === "APPROVE"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("OVERRIDE")}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeAction === "OVERRIDE"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Override
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("ESCALATE")}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  activeAction === "ESCALATE"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Escalate
              </button>
            </div>

            {activeAction === "APPROVE" && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-xs text-emerald-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Approve AI-Suggested Verdict</span>
                  </p>
                  <p className="text-emerald-400/90 text-[11px] leading-relaxed">
                    This accepts <strong>{claim.aiVerdict}</strong> with {(claim.aiConfidence * 100).toFixed(0)}% confidence and certifies it for the public verification database.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Optional Reviewer Note:</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="E.g., Corroborated against ECI standard instructions compendium."
                    rows={3}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  onClick={handleAdjudicate}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? "Publishing..." : "Approve & Publish Claim"}</span>
                </button>
              </div>
            )}

            {activeAction === "OVERRIDE" && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-900/50 text-xs text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Override AI Verdict</span>
                  </p>
                  <p className="text-amber-400/90 text-[11px] leading-relaxed">
                    Select a new official verdict. A justification note is <strong>mandatory</strong> for audit transparency.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-semibold">New Certified Verdict:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["CONTRADICTED", "SUPPORTED", "MISLEADING", "UNVERIFIED"].map((vd) => (
                      <button
                        key={vd}
                        type="button"
                        onClick={() => setOverrideVerdict(vd)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                          overrideVerdict === vd
                            ? `${getVerdictStyle(vd)} ring-2 ring-amber-500`
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {vd}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-semibold">
                    Mandatory Justification Note: <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Provide specific reason why AI suggestion is being overridden..."
                    rows={4}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Minimum 5 characters required for compliance.
                  </span>
                </div>

                <button
                  onClick={handleAdjudicate}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{submitting ? "Recording Override..." : "Save Override & Publish"}</span>
                </button>
              </div>
            )}

            {activeAction === "ESCALATE" && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-900/50 text-xs text-purple-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-purple-400" />
                    <span>Escalate to Senior Administration</span>
                  </p>
                  <p className="text-purple-400/90 text-[11px] leading-relaxed">
                    Flags submission for high-level legal/administrative review before public release.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1 font-semibold">
                    Escalation Rationale: <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Detail legal doubt, jurisdiction conflict, or pending clarification from CEO office..."
                    rows={4}
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  onClick={handleAdjudicate}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>{submitting ? "Escalating..." : "Escalate Submission"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>Adjudication Audit Trail ({claim.reviewActions.length})</span>
            </h3>

            {claim.reviewActions.length === 0 ? (
              <div className="p-4 text-center bg-slate-950 border border-slate-800/80 rounded-lg text-slate-500 text-xs">
                No human review actions recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {claim.reviewActions.map((ra) => (
                  <div
                    key={ra.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{ra.reviewer.name || ra.reviewer.email}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {ra.action}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                      <span>{ra.fromVerdict || "NONE"}</span>
                      <span>&rarr;</span>
                      <span className="text-slate-200 font-bold">{ra.toVerdict || "ESCALATED"}</span>
                    </div>

                    {ra.note && (
                      <p className="text-slate-300 text-[11px] italic pt-0.5">
                        "{ra.note}"
                      </p>
                    )}

                    <span className="text-[10px] text-slate-500 block pt-1 font-mono">
                      {new Date(ra.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
