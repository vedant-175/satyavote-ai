import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ShieldCheck,
  ExternalLink,
  ArrowLeft,
  Calendar,
  MapPin,
  Flame,
  FileCheck2,
  Share2,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    select: { text: true, finalVerdict: true },
  });

  if (!claim || !claim.finalVerdict) {
    return { title: "Claim Verification Report — SatyaVote AI" };
  }

  return {
    title: `[${claim.finalVerdict}] ${claim.text.slice(0, 60)}... — SatyaVote AI`,
    description: `Official election fact-check verification: ${claim.text}`,
  };
}

export default async function ShareableClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // STRICT RULE: Only reviewer-approved, published claims are accessible
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      evidence: {
        orderBy: { createdAt: "asc" },
      },
      reviewedBy: {
        select: { name: true, role: true },
      },
      submission: {
        select: { type: true, url: true, createdAt: true },
      },
    },
  });

  if (!claim || !claim.finalVerdict || !claim.publishedAt) {
    notFound();
  }

  const getVerdictStyle = (v: string) => {
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

  const getStanceStyle = (stance: string) => {
    switch (stance) {
      case "SUPPORTS":
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
      case "CONTRADICTS":
        return "bg-rose-950 text-rose-300 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          href="/claims"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Claims Database</span>
        </Link>
        <span className="text-xs font-mono text-slate-500">
          Permalink ID: #{claim.id.slice(0, 8)}
        </span>
      </div>

      {/* Official Certified Verdict Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-lg text-sm font-mono font-bold border uppercase tracking-wide shadow-sm ${getVerdictStyle(claim.finalVerdict)}`}>
              OFFICIAL VERDICT: {claim.finalVerdict}
            </span>

            {claim.repeatCount > 1 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Viral Claim ({claim.repeatCount}x Recirculated)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Certified on {new Date(claim.publishedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Claim Statement & Original Text */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 font-mono">
              Verified Statement (Analysis Translation)
            </span>
            {claim.language !== "en" && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1">
                <span>Source Language: {claim.language.toUpperCase()}</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 leading-snug">
            "{claim.text}"
          </h1>

          {claim.originalText && claim.originalText !== claim.text && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-amber-400 block tracking-wide">
                Original Submitted Text ({claim.language.toUpperCase()} Preserved)
              </span>
              <p className="text-sm font-medium text-slate-300 italic">
                "{claim.originalText}"
              </p>
            </div>
          )}
        </div>

        {/* Reviewer Determination Card */}
        {claim.finalNote && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Human Fact-Checker Determination ({claim.reviewedBy?.name || "Election Review Desk"}):</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {claim.finalNote}
            </p>
          </div>
        )}

        {/* Metadata Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Category</span>
            <span className="font-semibold text-slate-200">{claim.topic || "General"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Jurisdiction</span>
            <span className="font-semibold text-slate-200">{claim.state || "National"}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Language</span>
            <span className="font-mono text-slate-200 uppercase">{claim.language}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block font-mono">Verified Evidence</span>
            <span className="font-semibold text-slate-200">{claim.evidence.length} Citations</span>
          </div>
        </div>
      </div>

      {/* Grounded Evidence Citations */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Primary Statutory & Authoritative Evidence ({claim.evidence.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official instructions, fact-check clarifications, and press releases supporting this verdict determination.
          </p>
        </div>

        <div className="space-y-3">
          {claim.evidence.map((ev) => (
            <div
              key={ev.id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-200">{ev.sourceName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {ev.kind}
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${getStanceStyle(ev.stance)}`}>
                  STANCE: {ev.stance}
                </span>
              </div>

              {ev.title && (
                <h3 className="text-xs font-semibold text-slate-300">{ev.title}</h3>
              )}

              {ev.snippet && (
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  {ev.snippet}
                </p>
              )}

              {ev.url && (
                <div className="pt-1">
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1.5 font-medium"
                  >
                    <span>View Primary Source Document</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
